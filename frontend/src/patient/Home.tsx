import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Today } from "../api/client";

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function greeting(iso: string) {
  const hour = new Date(iso).getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function ProgressRing({ taken, total }: { taken: number; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const share = total ? taken / total : 0;
  return (
    <div
      className="relative h-32 w-32 shrink-0"
      role="img"
      aria-label={`${taken} of ${total} medicines taken today`}
    >
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="14" className="stroke-line" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          className="stroke-green"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold">
        {taken}/{total}
      </div>
    </div>
  );
}

export default function Home() {
  const [today, setToday] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .today()
      .then(setToday)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return <p className="p-6 text-xl">Steady can't load right now: {error}</p>;
  }
  if (!today) {
    return <p className="p-6 text-xl text-slate-soft">Loading…</p>;
  }

  const next = today.next;
  const nextDoses = next
    ? today.doses.filter((d) => next.dose_ids.includes(d.dose_id))
    : [];

  return (
    <div className="flex min-h-dvh flex-col gap-5 px-5 pb-8 pt-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-soft">
          {new Date(today.now).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="mt-1 text-4xl leading-tight">
          {greeting(today.now)}, {today.patient.name}
        </h1>
      </header>

      <section className="flex items-center gap-5">
        <ProgressRing taken={today.taken_count} total={today.total_count} />
        <div>
          <p className="text-2xl font-bold">
            {today.taken_count} of {today.total_count} taken
          </p>
          {today.streak_days ? (
            <p className="mt-1 text-lg text-green-dark">{today.streak_days} days in a row</p>
          ) : null}
        </div>
      </section>

      {next ? (
        <Link
          to="/patient/reminder"
          className="block rounded-3xl bg-white p-6 shadow-card"
        >
          <p className="text-sm font-bold uppercase tracking-widest text-slate-soft">
            Your next medicine · {formatTime(next.time)}
          </p>
          <div className="mt-3 flex items-center gap-2" aria-hidden="true">
            {nextDoses.map((d) => (
              <span
                key={d.dose_id}
                className="h-9 w-9 rounded-full border-2 border-slate-soft/40"
                style={{ background: d.color ?? "#ffffff" }}
              />
            ))}
          </div>
          <p className="mt-3 text-3xl font-bold leading-tight">{next.label}</p>
          <p className="mt-1 text-lg text-slate-soft">
            {nextDoses.map((d) => d.name).join(", ")}
          </p>
        </Link>
      ) : (
        <div className="rounded-3xl bg-green-light p-6 text-xl font-bold text-green-dark">
          All done for today
        </div>
      )}

      {today.thought ? (
        <section className="rounded-3xl bg-indigo-light p-5">
          <p className="text-sm font-bold uppercase tracking-widest text-navy">
            A thought for today
          </p>
          <p className="mt-2 text-xl">{today.thought.text}</p>
        </section>
      ) : null}

      <div className="mt-auto flex justify-center pt-4">
        <Link
          to="/patient/checkin"
          aria-label="Talk to Steady"
          className="relative flex h-40 w-40 items-center justify-center"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border-2 border-indigo/30"
          />
          <span className="relative flex h-32 w-32 items-center justify-center rounded-full border-8 border-white bg-navy text-white shadow-card">
            <svg
              aria-hidden="true"
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </span>
        </Link>
      </div>
    </div>
  );
}