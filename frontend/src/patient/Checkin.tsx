// Patient check-in as a chat with Steady, in the patient's language.
// Steady's lines on the left; the patient's words appear on the right AS THEY SPEAK (live captions), then
// the exact transcript replaces them and Steady replies. Never shows tiers or alerts: the caregiver is told
// silently. Only a red tier adds a "Call 911" button.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CheckinPrompt, type CheckinResult } from "../api/client";
import { speak, stopSpeaking, unlockAudio } from "../audio";
import { useLiveCaptions } from "../lib/useLiveCaptions";

type Spoken = CheckinPrompt["question"];
type Bubble = { from: "steady" | "me"; text: string; sub?: string; live?: boolean };
type Phase = "loading" | "ready" | "recording" | "sending" | "reply";

const MAX_SECONDS = 30;
const caption = (s: Spoken) => s.text_local ?? s.text_en;
const steadyBubble = (s: Spoken): Bubble => ({ from: "steady", text: caption(s), sub: s.text_local ? s.text_en : undefined });

export default function Checkin() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState<CheckinPrompt | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [seconds, setSeconds] = useState(0);
  const lang = prompt?.question.lang ?? "en";
  const captions = useLiveCaptions(lang);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [bubbles, captions.text, phase]);

  useEffect(() => {
    let alive = true; // React runs this twice in development; only the live run may speak
    api
      .checkinPrompt()
      .then((p) => {
        if (!alive) return;
        setPrompt(p);
        setBubbles([...(p.opener ? [steadyBubble(p.opener)] : []), steadyBubble(p.question)]);
        setPhase("ready");
        // Reached by a tap (Home mic or swipe), so audio is allowed: Steady speaks first.
        void (async () => {
          if (p.opener) await speak(p.opener);
          if (alive) await speak(p.question);
        })();
      })
      .catch((e: Error) => {
        if (!alive) return;
        setNotice(e.message || "Steady can't connect right now.");
        setPhase("ready");
      });
    return () => {
      alive = false;
      stopSpeaking();
      window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const send = async (answer: Blob | string, heard: string) => {
    setPhase("sending");
    setNotice(null);
    try {
      let r: CheckinResult;
      try {
        r = typeof answer === "string" ? await api.submitCheckin({ text: answer }) : await api.submitCheckinAudio(answer);
      } catch (err) {
        // The recording came back empty (noisy room, or the phone gave the mic to live captions): use what we heard.
        if (typeof answer !== "string" && heard) r = await api.submitCheckin({ text: heard });
        else throw err;
      }
      setResult(r);
      setBubbles((b) => [...b.filter((x) => !x.live), { from: "me", text: r.transcript }, steadyBubble(r.reply)]);
      setPhase("reply");
      await speak(r.reply);
      if (r.tier !== "red") window.setTimeout(() => navigate("/patient"), 4000);
    } catch (e) {
      setBubbles((b) => b.filter((x) => !x.live));
      setNotice((e as Error).message || "Something went wrong. Please try again.");
      setPhase("ready");
    }
  };

  const startRecording = async () => {
    setNotice(null);
    stopSpeaking();
    unlockAudio();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setNotice("Voice needs the secure (https://) link. You can type your answer instead.");
      setTyping(true);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(s, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        window.clearInterval(timer.current);
        const heard = captions.stop();
        const audio = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
        if (audio.size > 1000) void send(audio, heard);
        else if (heard) void send(heard, heard);
        else {
          setBubbles((b) => b.filter((x) => !x.live));
          setNotice("I didn't catch that. Tap and speak again.");
          setPhase("ready");
        }
      };
      recorder.current = rec;
      rec.start();
      captions.start();
      setSeconds(0);
      const started = Date.now();
      timer.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - started) / 1000);
        setSeconds(sec);
        if (sec >= MAX_SECONDS && rec.state === "recording") rec.stop();
      }, 250);
      setBubbles((b) => [...b, { from: "me", text: "", live: true }]);
      setPhase("recording");
    } catch {
      setNotice("Steady needs the microphone. Allow it in the browser, or type your answer instead.");
      setTyping(true);
    }
  };

  const onMic = () => {
    if (phase === "recording") {
      if (recorder.current?.state === "recording") recorder.current.stop();
    } else if (phase === "ready") void startRecording();
  };

  const red = result?.tier === "red";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <button type="button" onClick={() => navigate("/patient")} className="min-h-12 text-xl font-bold text-indigo">
          ← Back
        </button>
        <p className="text-sm font-bold tracking-widest text-slate-soft uppercase">Talking with Steady</p>
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto px-5 pb-4" aria-live="polite">
        {phase === "loading" && <p className="text-xl text-slate-soft">Steady is getting ready…</p>}
        {bubbles.map((b, i) => (
          <div key={i} className={`flex ${b.from === "me" ? "justify-end" : "justify-start"}`}>
            <div
              lang={b.from === "steady" ? lang : undefined}
              className={`max-w-[85%] rounded-3xl px-5 py-4 text-xl leading-snug shadow-card ${
                b.from === "me" ? "rounded-br-md bg-indigo text-white" : "rounded-bl-md bg-white text-navy"
              }`}
            >
              {b.live ? (
                <span className="italic opacity-90">{captions.text || (captions.supported ? "Listening…" : "Listening… (your words will appear when you finish)")}</span>
              ) : (
                b.text
              )}
              {b.sub && <p className="mt-2 text-base opacity-70">{b.sub}</p>}
            </div>
          </div>
        ))}
        {phase === "sending" && (
          <p className="text-center text-lg text-slate-soft" role="status">
            Steady is listening carefully…
          </p>
        )}
        {red && (
          <a href="tel:911" className="flex min-h-16 items-center justify-center rounded-2xl bg-red text-2xl font-bold text-white">
            📞 Call 911
          </a>
        )}
        {notice && <p role="alert" className="rounded-2xl bg-amber-light px-4 py-3 text-lg text-amber-dark">{notice}</p>}
        <div ref={bottom} />
      </main>

      <footer className="sticky bottom-0 bg-background px-5 pt-3 pb-8">
        {phase === "reply" ? (
          <div className="grid gap-2">
            {result && (
              <button type="button" onClick={() => void speak(result.reply)} className="min-h-14 rounded-2xl bg-white text-lg font-bold text-indigo shadow-card">
                🔊 Hear Steady again
              </button>
            )}
            {!red && (
              <button type="button" onClick={() => navigate("/patient")} className="min-h-16 rounded-2xl bg-green text-2xl font-bold text-white">
                Done
              </button>
            )}
          </div>
        ) : typing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!typed.trim()) return;
              setBubbles((b) => [...b, { from: "me", text: typed.trim(), live: true }]);
              void send(typed.trim(), typed.trim());
              setTyped("");
            }}
          >
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="How are you feeling?" lang={lang}
              className="min-h-16 flex-1 rounded-2xl border border-line bg-white px-4 text-xl" disabled={phase !== "ready"} />
            <button className="min-h-16 rounded-2xl bg-navy px-6 text-xl font-bold text-white" disabled={phase !== "ready"}>
              Send
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onMic}
              disabled={phase === "loading" || phase === "sending"}
              aria-label={phase === "recording" ? "Stop and send" : "Tap to talk"}
              className={`flex size-32 items-center justify-center rounded-full border-8 border-white text-white shadow-card transition disabled:opacity-40 ${
                phase === "recording" ? "animate-pulse bg-amber" : "bg-navy"
              }`}
            >
              <span className="text-4xl" aria-hidden>{phase === "recording" ? "■" : "🎙"}</span>
            </button>
            <p className="text-xl font-bold text-navy">
              {phase === "recording" ? `Listening… tap to send (${MAX_SECONDS - seconds}s)` : "Tap and tell Steady how you feel"}
            </p>
            <button type="button" onClick={() => setTyping(true)} className="min-h-12 text-lg text-indigo underline">
              Type instead
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
