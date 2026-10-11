const BASE = import.meta.env.VITE_API_BASE ?? "";

// One shared Audio element. Phones only allow sound after a tap,
// so we "unlock" it once with a silent clip, then reuse it.
const player = new Audio();

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function unlockAudio() {
  try {
    player.src = SILENT_WAV;
    void player.play().catch(() => {});
  } catch {
    // ignore
  }
}

export function stopSpeaking() {
  try {
    player.pause();
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
}

type Spoken = { text_en: string; audio_url?: string | null };

function speakWithPhoneVoice(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// Plays audio_url if there is one. If it is null or fails, the phone's own voice reads text_en.
// The promise resolves when speaking has finished.
export function speak(spoken: Spoken): Promise<void> {
  stopSpeaking();
  if (!spoken.audio_url) return speakWithPhoneVoice(spoken.text_en);

  return new Promise((resolve) => {
    const fallback = () => {
      player.onended = null;
      player.onerror = null;
      speakWithPhoneVoice(spoken.text_en).then(resolve);
    };
    player.onended = () => resolve();
    player.onerror = fallback;
    player.src = BASE + spoken.audio_url;
    player.play().catch(fallback);
  });
}