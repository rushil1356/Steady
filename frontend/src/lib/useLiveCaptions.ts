// Live captions while the patient speaks, using the browser's own speech recognition (free, on-device or
// Google-backed in Chrome). Display only: the exact transcript still comes from ElevenLabs on the server.
// Works well in Chrome on Android and desktop; iPhone Safari support is limited, so `supported` may be false.
import { useCallback, useRef, useState } from "react";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const LOCALES: Record<string, string> = { en: "en-US", hi: "hi-IN", es: "es-US" };

export function useLiveCaptions(lang: string) {
  const Ctor =
    typeof window !== "undefined"
      ? ((window as unknown as Record<string, unknown>).SpeechRecognition ??
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
      : undefined;
  const supported = typeof Ctor === "function";
  const [text, setText] = useState("");
  const finalText = useRef("");
  const rec = useRef<Recognition | null>(null);

  const start = useCallback(() => {
    finalText.current = "";
    setText("");
    if (!supported) return;
    try {
      const r = new (Ctor as new () => Recognition)();
      r.lang = LOCALES[lang] ?? lang;
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText.current += res[0].transcript + " ";
          else interim += res[0].transcript;
        }
        setText((finalText.current + interim).trim());
      };
      r.onerror = () => undefined; // captions are optional; recording carries on
      r.onend = () => undefined;
      r.start();
      rec.current = r;
    } catch {
      rec.current = null;
    }
  }, [Ctor, lang, supported]);

  /** Stops listening; returns everything heard (used as a backup if the recording comes back empty). */
  const stop = useCallback(() => {
    try {
      rec.current?.stop();
    } catch {
      /* already stopped */
    }
    rec.current = null;
    return finalText.current.trim() || text.trim();
  }, [text]);

  return { supported, text, start, stop };
}
