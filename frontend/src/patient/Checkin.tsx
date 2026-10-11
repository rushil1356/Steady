import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  type CheckinPrompt,
  type CheckinResult,
} from "../api/client";
import { speak, stopSpeaking, unlockAudio } from "../audio";

export default function Checkin() {
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState<CheckinPrompt | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    api
      .checkinPrompt()
      .then(setPrompt)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));

    return () => {
      stopSpeaking();

      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  function playQuestion() {
    if (!prompt) return;

    audioRef.current?.pause();
    unlockAudio();
    void speak(prompt.question);
  }

  function playReply() {
    if (!result) return;

    audioRef.current?.pause();
    unlockAudio();
    void speak(result.reply);
  }

  function clearRecording() {
    audioRef.current?.pause();

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setAudioUrl(null);
    setRecordedAudio(null);
    setDuration(0);
  }

  async function startRecording() {
    setError(null);
    stopSpeaking();
    clearRecording();

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      const preferredType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = new MediaRecorder(
        stream,
        preferredType ? { mimeType: preferredType } : undefined
      );

      recorderRef.current = recorder;

      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);

        const audio = new Blob(chunks, {
          type: recorder.mimeType,
        });

        if (audio.size === 0) {
          setError("No audio was recorded. Please try again.");
          return;
        }

        const url = URL.createObjectURL(audio);

        audioUrlRef.current = url;
        setRecordedAudio(audio);
        setAudioUrl(url);
      };

      recorder.onerror = () => {
        setError("Recording failed. Please try again.");
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };

      startTimeRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not access your microphone."
      );
    }
  }

  function finishRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  async function sendRecording() {
    if (!recordedAudio || submitting) return;

    setSubmitting(true);
    setError(null);

    audioRef.current?.pause();

    try {
      const data = await api.submitCheckinAudio(recordedAudio);
      setResult(data);
      clearRecording();
      void speak(data.reply); // play Steady's reply right away (the submit tap already unlocked audio)
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-xl">Loading check-in...</p>;
  }

  if (!prompt && !result) {
    return (
      <p role="alert" className="p-6 text-xl text-red">
        {error ?? "No check-in available."}
      </p>
    );
  }

  if (result) {
    return (
      <main className="flex min-h-dvh flex-col gap-6 px-5 pb-8 pt-8">
        <h1 className="text-4xl font-bold">
          {result.tier === "red" ? "Please get help now" : "Thank you for sharing!"}
        </h1>

        {/* Red only: the reply tells them to call 911, so give them one tap to do it. Never show tiers otherwise. */}
        {result.tier === "red" && (
          <a
            href="tel:911"
            className="flex min-h-16 items-center justify-center rounded-2xl bg-red px-6 text-2xl font-bold text-white"
          >
            📞 Call 911
          </a>
        )}

        <section className="rounded-3xl bg-white p-6 shadow-card">
          <h2 className="mb-4 text-xl font-bold text-slate-soft">
            Steady says
          </h2>

          <p
            lang={result.reply.lang}
            className="text-2xl leading-relaxed"
          >
            {result.reply.text_local ?? result.reply.text_en}
          </p>

          {result.reply.text_local && (
            <p className="mt-4 text-lg text-slate-soft">
              {result.reply.text_en}
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={playReply}
          className="min-h-16 rounded-2xl bg-indigo px-6 text-xl font-bold text-white"
        >
          🔊 Listen to Steady
        </button>

        <button
          type="button"
          onClick={() => navigate("/patient")}
          className="min-h-16 rounded-2xl bg-white px-6 text-xl font-bold text-indigo shadow-card"
        >
          Return Home
        </button>
      </main>
    );
  }

  if (!prompt) return null;

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pb-8 pt-8">
      <button
        type="button"
        onClick={() => navigate("/patient")}
        className="min-h-12 self-start text-xl font-bold text-indigo"
      >
        ← Back
      </button>

      <h1 className="text-4xl font-bold">
        Daily Check-in
      </h1>

      {prompt?.opener && (
        <section className="rounded-3xl bg-white p-6 shadow-card">
          <h2 className="mb-4 text-xl font-bold text-slate-soft">
            A little something for you
          </h2>

          <p
            lang={prompt.opener.lang}
            className="text-2xl leading-relaxed"
          >
            {prompt.opener.text_local ?? prompt.opener.text_en}
          </p>

          {prompt.opener.text_local && (
            <p className="mt-3 text-lg text-slate-soft">
              {prompt.opener.text_en}
            </p>
          )}
        </section>
      )}

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <h2 className="mb-4 text-xl font-bold text-slate-soft">
          Steady asks
        </h2>

        <p
          lang={prompt.question.lang}
          className="text-3xl font-bold leading-relaxed"
        >
          {prompt.question.text_local ?? prompt.question.text_en}
        </p>

        {prompt.question.text_local && (
          <p className="mt-3 text-xl text-slate-soft">
            {prompt.question.text_en}
          </p>
        )}
      </section>

      <button
        type="button"
        onClick={playQuestion}
        disabled={recording || submitting}
        className="min-h-16 rounded-2xl bg-white px-6 text-xl font-bold text-indigo shadow-card disabled:opacity-50"
      >
        🔊 Listen to question
      </button>

      <section className="rounded-3xl bg-white p-6 text-center shadow-card">
        <h2 className="mb-5 text-2xl font-bold">
          Tell Steady how you feel
        </h2>

        <button
          type="button"
          onClick={recording ? finishRecording : startRecording}
          disabled={submitting}
          className={`mx-auto flex h-36 w-36 items-center justify-center rounded-full text-6xl text-white shadow-lg disabled:opacity-50 ${
            recording ? "bg-red-600" : "bg-indigo"
          }`}
        >
          {recording ? "■" : "🎤"}
        </button>

        <p role="status" className="mt-5 text-xl font-bold">
          {submitting
            ? "Sending your response..."
            : recording
              ? "Recording... Tap to finish"
              : recordedAudio
                ? "Your recording is ready!"
                : "Tap the microphone to talk"}
        </p>

        {recordedAudio && !recording && (
          <div className="mt-6 space-y-5">
            <p className="text-lg text-slate-soft">
              Recording length: {duration.toFixed(1)} seconds
            </p>

            <p className="text-base text-slate-soft">
              Audio captured: {(recordedAudio.size / 1024).toFixed(1)} KB
            </p>

            {audioUrl && (
              <div>
                <p className="mb-3 text-xl font-bold">
                  Listen to your recording
                </p>

                <audio
                  ref={audioRef}
                  controls
                  src={audioUrl}
                  className="w-full"
                />
              </div>
            )}

            <button
              type="button"
              onClick={sendRecording}
              disabled={submitting}
              className="min-h-16 w-full rounded-2xl bg-indigo px-6 text-xl font-bold text-white disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send to Steady"}
            </button>

            <button
              type="button"
              onClick={clearRecording}
              disabled={submitting}
              className="min-h-14 w-full rounded-2xl bg-slate-100 px-6 text-xl font-bold text-slate-800"
            >
              Record Again
            </button>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-lg text-red">
          {error}
        </p>
      )}
    </main>
  );
}