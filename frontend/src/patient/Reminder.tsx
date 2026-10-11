import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { speak, stopSpeaking } from "../audio";
import SwipeToConfirm from "../components/SwipeToConfirm";
import { loadDue, saveDue } from "./dueStore";

export default function Reminder() {
  const navigate = useNavigate();
  const [due] = useState(() => loadDue());
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const dose = due[index];

  // Nothing due: go back home.
  useEffect(() => {
    if (!dose) navigate("/patient", { replace: true });
  }, [dose, navigate]);

  // Speak the reminder for the current dose.
  useEffect(() => {
    if (!dose) return;
    speak(dose.reminder);
    return () => stopSpeaking();
  }, [dose]);

  if (!dose) return null;

  async function confirm() {
    try {
      await api.confirmDose(dose.dose_id, true);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    saveDue(due.slice(index + 1));
    if (index + 1 < due.length) {
      setIndex(index + 1);
    } else {
      navigate("/patient/checkin");
    }
  }

  function notNow() {
    window.setTimeout(() => navigate("/patient/reminder"), 10 * 60 * 1000);
    navigate("/patient");
  }

  const caption = dose.reminder.text_local ?? dose.reminder.text_en;

  return (
    <div className="flex min-h-dvh flex-col gap-5 px-5 pb-8 pt-6">
      {due.length > 1 ? (
        <p className="text-lg font-bold text-slate-soft">
          {index + 1} of {due.length}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <span
          className="h-16 w-16 shrink-0 rounded-full border-2 border-slate-soft/40"
          style={{ background: dose.color ?? "#ffffff" }}
          aria-hidden="true"
        />
        <div>
          <h1 className="text-4xl leading-tight">{dose.name}</h1>
          <p className="mt-1 text-xl text-slate-soft">
            1 {dose.look} · for {dose.purpose}
          </p>
        </div>
      </div>

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <p lang={dose.reminder.lang} className="text-2xl leading-snug">
          {caption}
        </p>
        {dose.reminder.text_local ? (
          <p className="mt-3 text-xl text-slate-soft">{dose.reminder.text_en}</p>
        ) : null}
        <button
          type="button"
          onClick={() => speak(dose.reminder)}
          className="mt-4 min-h-14 text-xl font-bold text-indigo underline"
        >
          Play again
        </button>
      </section>

      {error ? <p className="text-xl text-red">{error}</p> : null}

      <div className="mt-auto flex flex-col items-center gap-2">
        <SwipeToConfirm key={dose.dose_id} onConfirm={confirm} />
        <button
          type="button"
          onClick={confirm}
          className="min-h-14 text-xl text-slate-soft underline"
        >
          Tap to confirm instead
        </button>
        <button
          type="button"
          onClick={notNow}
          className="min-h-14 text-xl text-slate-soft underline"
        >
          Not now
        </button>
      </div>
    </div>
  );
}