const BASE = import.meta.env.VITE_API_BASE ?? "";

// One shared Audio element. Phones only allow sound after a tap,
// so we "unlock" it once with a silent clip, then reuse it.
const player = new Audio();

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

// Every speak() gets a number. Starting a new one cancels the old one, and a cancelled one finishes silently:
// it must never "fall back" to the phone's voice, or two voices talk over each other.
let generation = 0;

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

type Spoken = { text_en: string; audio_url?: string | null };

function speakWithPhoneVoice(text: string, mine: number): Promise<void> {
  return new Promise((resolve) => {
    if (mine !== generation || !("speechSynthesis" in window)) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// Plays audio_url if there is one. Only if that file is missing or broken does the phone's own voice read
// text_en. The promise resolves when speaking has finished (or was cancelled by a newer speak/stop).
export function speak(spoken: Spoken): Promise<void> {
  stopSpeaking();
  const mine = generation;
  if (!spoken.audio_url) return speakWithPhoneVoice(spoken.text_en, mine);

  return new Promise((resolve) => {
    const done = () => {
      player.onended = null;
      player.onerror = null;
      resolve();
    };
    const fallback = () => {
      player.onended = null;
      player.onerror = null;
      if (mine !== generation) return resolve(); // cancelled: stay silent
      speakWithPhoneVoice(spoken.text_en, mine).then(resolve);
    };
    player.onended = done;
    player.onerror = fallback;
    player.src = BASE + spoken.audio_url;
    player.play().catch((err: DOMException) => {
      // AbortError = interrupted by a newer speak; NotAllowedError = no tap yet (the "Hear again" button works).
      if (mine !== generation || err?.name === "AbortError" || err?.name === "NotAllowedError") done();
      else fallback();
    });
  });
}
