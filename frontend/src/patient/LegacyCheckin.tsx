import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  type CheckinPrompt,
  type CheckinResult,
} from "../api/client";
import { speak, stopSpeaking, unlockAudio } from "../audio";
import { useLanguage, type Language } from "./useLanguage";

const translations = {
  en: {
    loading: "Loading check-in...",
    unavailable: "No check-in available.",
    help: "Please get help now",
    thankYou: "Thank you for sharing!",
    call911: "📞 Call 911",
    steadySays: "Steady says",
    listenReply: "🔊 Listen to Steady",
    returnHome: "Return Home",
    back: "← Back",
    dailyCheckin: "Daily Check-in",
    something: "A little something for you",
    steadyAsks: "Steady asks",
    listenQuestion: "🔊 Listen to question",
    tellSteady: "Tell Steady how you feel",
    sendingResponse: "Sending your response...",
    recording: "Recording... Tap to finish",
    ready: "Your recording is ready!",
    tapMicrophone: "Tap the microphone to talk",
    recordingLength: "Recording length",
    seconds: "seconds",
    audioCaptured: "Audio captured",
    listenRecording: "Listen to your recording",
    sending: "Sending...",
    send: "Send to Steady",
    recordAgain: "Record Again",
    unsupported: "Voice recording is not supported in this browser.",
    noAudio: "No audio was recorded. Please try again.",
    failed: "Recording failed. Please try again.",
    microphoneError: "Could not access your microphone.",
  },
  hi: {
    loading: "बातचीत लोड हो रही है...",
    unavailable: "अभी बातचीत उपलब्ध नहीं है।",
    help: "कृपया तुरंत मदद लें",
    thankYou: "अपनी बात बताने के लिए धन्यवाद!",
    call911: "📞 911 पर कॉल करें",
    steadySays: "स्टीडी कहता है",
    listenReply: "🔊 स्टीडी की बात सुनें",
    returnHome: "मुख्य पृष्ठ पर लौटें",
    back: "← वापस",
    dailyCheckin: "रोज़ की बातचीत",
    something: "आपके लिए एक छोटी सी बात",
    steadyAsks: "स्टीडी पूछता है",
    listenQuestion: "🔊 सवाल सुनें",
    tellSteady: "स्टीडी को बताएँ कि आप कैसा महसूस कर रहे हैं",
    sendingResponse: "आपका जवाब भेजा जा रहा है...",
    recording: "रिकॉर्डिंग हो रही है... रोकने के लिए दबाएँ",
    ready: "आपकी रिकॉर्डिंग तैयार है!",
    tapMicrophone: "बात करने के लिए माइक्रोफ़ोन दबाएँ",
    recordingLength: "रिकॉर्डिंग की अवधि",
    seconds: "सेकंड",
    audioCaptured: "रिकॉर्ड किया गया ऑडियो",
    listenRecording: "अपनी रिकॉर्डिंग सुनें",
    sending: "भेजा जा रहा है...",
    send: "स्टीडी को भेजें",
    recordAgain: "दोबारा रिकॉर्ड करें",
    unsupported: "इस ब्राउज़र में आवाज़ रिकॉर्ड नहीं की जा सकती।",
    noAudio: "आवाज़ रिकॉर्ड नहीं हुई। कृपया दोबारा कोशिश करें।",
    failed: "रिकॉर्डिंग विफल रही। कृपया दोबारा कोशिश करें।",
    microphoneError: "माइक्रोफ़ोन इस्तेमाल नहीं हो सका।",
  },
};

type LocalizedText = {
  text_en: string;
  text_local?: string | null;
  lang?: string | null;
};

function displayText(text: LocalizedText, language: Language) {
  if (
    language === "hi" &&
    text.lang?.toLowerCase().startsWith("hi") &&
    text.text_local
  ) {
    return text.text_local;
  }

  return text.text_en;
}

export default function Checkin() {
  const navigate = useNavigate();
  const language = useLanguage();
  const t = translations[language];

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
      setError(t.unsupported);
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
          setError(
            translations[
              localStorage.getItem("steady-language") === "hi" ? "hi" : "en"
            ].noAudio
          );
          return;
        }

        const url = URL.createObjectURL(audio);

        audioUrlRef.current = url;
        setRecordedAudio(audio);
        setAudioUrl(url);
      };

      recorder.onerror = () => {
        setError(
          translations[
            localStorage.getItem("steady-language") === "hi" ? "hi" : "en"
          ].failed
        );
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };

      startTimeRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? language === "hi"
            ? "कृपया माइक्रोफ़ोन की अनुमति दें।"
            : "Please allow microphone access."
          : t.microphoneError
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
      void speak(data.reply);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-xl">{t.loading}</p>;
  }

  if (!prompt && !result) {
    return (
      <p role="alert" className="p-6 text-xl text-red">
        {error ?? t.unavailable}
      </p>
    );
  }

  if (result) {
    return (
      <main
        lang={language === "hi" ? "hi" : "en"}
        className="flex min-h-dvh flex-col gap-6 px-5 pb-8 pt-8"
      >
        <h1 className="text-4xl font-bold">
          {result.tier === "red" ? t.help : t.thankYou}
        </h1>

        {result.tier === "red" && (
          <a
            href="tel:911"
            className="flex min-h-16 items-center justify-center rounded-2xl bg-red px-6 text-2xl font-bold text-white"
          >
            {t.call911}
          </a>
        )}

        <section className="rounded-3xl bg-white p-6 shadow-card">
          <h2 className="mb-4 text-xl font-bold text-slate-soft">
            {t.steadySays}
          </h2>

          <p
            lang={language === "hi" && result.reply.lang?.startsWith("hi") ? "hi" : "en"}
            className="text-2xl leading-relaxed"
          >
            {displayText(result.reply, language)}
          </p>
        </section>

        <button
          type="button"
          onClick={playReply}
          className="min-h-16 rounded-2xl bg-indigo px-6 text-xl font-bold text-white"
        >
          {t.listenReply}
        </button>

        <button
          type="button"
          onClick={() => navigate("/patient")}
          className="min-h-16 rounded-2xl bg-white px-6 text-xl font-bold text-indigo shadow-card"
        >
          {t.returnHome}
        </button>
      </main>
    );
  }

  if (!prompt) return null;

  return (
    <main
      lang={language === "hi" ? "hi" : "en"}
      className="flex min-h-dvh flex-col gap-6 px-5 pb-8 pt-8"
    >
      <button
        type="button"
        onClick={() => navigate("/patient")}
        className="min-h-12 self-start text-xl font-bold text-indigo"
      >
        {t.back}
      </button>

      <h1 className="text-4xl font-bold">
        {t.dailyCheckin}
      </h1>

      {prompt.opener && (
        <section className="rounded-3xl bg-white p-6 shadow-card">
          <h2 className="mb-4 text-xl font-bold text-slate-soft">
            {t.something}
          </h2>

          <p className="text-2xl leading-relaxed">
            {displayText(prompt.opener, language)}
          </p>
        </section>
      )}

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <h2 className="mb-4 text-xl font-bold text-slate-soft">
          {t.steadyAsks}
        </h2>

        <p className="text-3xl font-bold leading-relaxed">
          {displayText(prompt.question, language)}
        </p>
      </section>

      <button
        type="button"
        onClick={playQuestion}
        disabled={recording || submitting}
        className="min-h-16 rounded-2xl bg-white px-6 text-xl font-bold text-indigo shadow-card disabled:opacity-50"
      >
        {t.listenQuestion}
      </button>

      <section className="rounded-3xl bg-white p-6 text-center shadow-card">
        <h2 className="mb-5 text-2xl font-bold">
          {t.tellSteady}
        </h2>

        <button
          type="button"
          onClick={recording ? finishRecording : startRecording}
          disabled={submitting}
          aria-label={recording ? t.recording : t.tapMicrophone}
          className={`mx-auto flex h-36 w-36 items-center justify-center rounded-full text-6xl text-white shadow-lg disabled:opacity-50 ${
            recording ? "bg-red-600" : "bg-indigo"
          }`}
        >
          {recording ? "■" : "🎤"}
        </button>

        <p role="status" className="mt-5 text-xl font-bold">
          {submitting
            ? t.sendingResponse
            : recording
              ? t.recording
              : recordedAudio
                ? t.ready
                : t.tapMicrophone}
        </p>

        {recordedAudio && !recording && (
          <div className="mt-6 space-y-5">
            <p className="text-lg text-slate-soft">
              {t.recordingLength}: {duration.toFixed(1)} {t.seconds}
            </p>

            <p className="text-base text-slate-soft">
              {t.audioCaptured}: {(recordedAudio.size / 1024).toFixed(1)} KB
            </p>

            {audioUrl && (
              <div>
                <p className="mb-3 text-xl font-bold">
                  {t.listenRecording}
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
              {submitting ? t.sending : t.send}
            </button>

            <button
              type="button"
              onClick={clearRecording}
              disabled={submitting}
              className="min-h-14 w-full rounded-2xl bg-slate-100 px-6 text-xl font-bold text-slate-800"
            >
              {t.recordAgain}
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