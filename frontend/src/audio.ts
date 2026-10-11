const BASE = import.meta.env.VITE_API_BASE ?? "";

const player = new Audio();

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

// Prevent cancelled audio from starting another voice.
let generation = 0;

type Language = "en" | "hi";

type Spoken = {
  text_en: string;
  text_local?: string | null;
  lang?: string | null;
  audio_url?: string | null;
};

function selectedLanguage(): Language {
  return localStorage.getItem("steady-language") === "hi" ? "hi" : "en";
}

export function unlockAudio() {
  try {
    player.src = SILENT_WAV;
    void player.play().catch(() => {});
  } catch {
    // ignore
  }
}

export function stopSpeaking() {
  generation += 1;

  try {
    player.pause();
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
}

function speakWithPhoneVoice(
  text: string,
  language: Language,
  mine: number
): Promise<void> {
  return new Promise((resolve) => {
    if (mine !== generation || !("speechSynthesis" in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = language === "hi" ? "hi-IN" : "en-US";
    utterance.rate = 0.9;

    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(language)
    );

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    if (mine !== generation) {
      resolve();
      return;
    }

    window.speechSynthesis.speak(utterance);
  });
}

export function speak(spoken: Spoken): Promise<void> {
  stopSpeaking();

  const mine = generation;
  const language = selectedLanguage();

  const hasHindiText =
    spoken.lang?.toLowerCase().startsWith("hi") &&
    Boolean(spoken.text_local);

  const text =
    language === "hi" && hasHindiText
      ? spoken.text_local!
      : spoken.text_en;

  const audioMatchesLanguage =
    Boolean(spoken.audio_url) &&
    (language === "en"
      ? !spoken.lang || spoken.lang.toLowerCase().startsWith("en")
      : Boolean(spoken.lang?.toLowerCase().startsWith("hi")));

  if (!audioMatchesLanguage || !spoken.audio_url) {
    return speakWithPhoneVoice(text, language, mine);
  }

  return new Promise((resolve) => {
    const done = () => {
      player.onended = null;
      player.onerror = null;
      resolve();
    };

    const fallback = () => {
      player.onended = null;
      player.onerror = null;

      if (mine !== generation) {
        resolve();
        return;
      }

      speakWithPhoneVoice(text, language, mine).then(resolve);
    };

    player.onended = done;
    player.onerror = fallback;

    player.src = BASE + spoken.audio_url;

    player.play().catch((err: DOMException) => {
      if (
        mine !== generation ||
        err?.name === "AbortError" ||
        err?.name === "NotAllowedError"
      ) {
        done();
      } else {
        fallback();
      }
    });
  });
}