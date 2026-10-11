import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Today } from "../api/client";

type Language = "en" | "hi";

function useLanguage(): Language {
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem("steady-language") === "hi" ? "hi" : "en"
  );

  useEffect(() => {
    const update = () => {
      setLanguage(
        localStorage.getItem("steady-language") === "hi" ? "hi" : "en"
      );
    };

    window.addEventListener("steady-language-change", update);
    window.addEventListener("storage", update);

    return () => {
      window.removeEventListener("steady-language-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return language;
}

const translations = {
  en: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    takenToday: "taken today",
    of: "of",
    streak: "days in a row",
    nextMedicine: "Your next medicine",
    allDone: "All done for today",
    thought: "A thought for today",
    talk: "Talk to Steady",
    loading: "Loading…",
    error: "Steady can't load right now",
    medicinesTaken: "medicines taken today",
  },
  hi: {
    morning: "सुप्रभात",
    afternoon: "नमस्कार",
    evening: "शुभ संध्या",
    takenToday: "दवाइयाँ आज ली गईं",
    of: "में से",
    streak: "दिन लगातार",
    nextMedicine: "आपकी अगली दवा",
    allDone: "आज की सभी दवाइयाँ पूरी हो गईं",
    thought: "आज का विचार",
    talk: "स्टीडी से बात करें",
    loading: "लोड हो रहा है…",
    error: "स्टीडी अभी लोड नहीं हो पा रहा है",
    medicinesTaken: "दवाइयाँ आज ली गईं",
  },
};

function formatTime(hhmm: string, language: Language) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(
    language === "hi" ? "hi-IN" : "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function greeting(iso: string, language: Language) {
  const hour = new Date(iso).getHours();
  const t = translations[language];

  if (hour < 12) return t.morning;
  if (hour < 18) return t.afternoon;
  return t.evening;
}

/** A small plant: one bud per dose today, and each dose taken opens into a flower. */
function ProgressRing({
  taken,
  total,
  language,
}: {
  taken: number;
  total: number;
  language: Language;
}) {
  const count = Math.min(total, 8);
  const open = Math.min(taken, count);
  const buds = Array.from({ length: count }, (_, i) => {
    const y = count === 1 ? 52 : 98 - (i * 66) / (count - 1);
    const left = i % 2 === 0;
    return { i, y, x: left ? 38 : 90, sx: 64 };
  });

  return (
    <div
      className="relative h-36 w-32 shrink-0"
      role="img"
      aria-label={
        language === "hi"
          ? `आज ${total} में से ${taken} दवाइयाँ ली गईं`
          : `${taken} of ${total} medicines taken today`
      }
    >
      <svg viewBox="0 0 128 144" className="h-full w-full" aria-hidden="true">
        <ellipse cx="64" cy="134" rx="30" ry="6" fill="#dcd3c0" opacity="0.7" />
        <path
          d="M64 134 C 58 112, 72 96, 64 76 S 60 40, 64 18"
          fill="none"
          stroke="#75a98a"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {buds.map(({ i, y, x }) => {
          const done = i < open;
          return (
            <g key={i}>
              <path
                d={`M64 ${y + 14} Q ${(64 + x) / 2} ${y + 14} ${x} ${y}`}
                fill="none"
                stroke="#75a98a"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {done ? (
                <g transform={`translate(${x} ${y})`}>
                  <g className="steady-bloom-in" style={{ animationDelay: `${i * 0.12}s` }}>
                    {[0, 72, 144, 216, 288].map((angle) => (
                      <ellipse key={angle} cx="0" cy="-8" rx="5.5" ry="9" fill="#e4665a" transform={`rotate(${angle})`} />
                    ))}
                    <circle r="4.5" fill="#f2b950" />
                  </g>
                </g>
              ) : (
                <ellipse cx={x} cy={y} rx="5" ry="8" fill="#f3efe4" stroke="#75a98a" strokeWidth="2.5" />
              )}
            </g>
          );
        })}
        {count === 0 && <ellipse cx="64" cy="30" rx="8" ry="12" fill="#a9cdb7" />}
      </svg>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-10 w-10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export default function Home() {
  const language = useLanguage();
  const t = translations[language];

  const [today, setToday] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api
        .today()
        .then(setToday)
        .catch((e: Error) => setError(e.message));

    load();

    const id = window.setInterval(() => {
      if (!document.hidden) load();
    }, 30000);

    return () => window.clearInterval(id);
  }, []);

  if (error) {
    return (
      <p className="p-6 text-xl">
        {t.error}: {error}
      </p>
    );
  }

  if (!today) {
    return (
      <p className="p-6 text-xl text-slate-soft">
        {t.loading}
      </p>
    );
  }

  const next = today.next;
  const nextDoses = next
    ? today.doses.filter((d) => next.dose_ids.includes(d.dose_id))
    : [];

  return (
    <div
      lang={language === "hi" ? "hi" : "en"}
      className="flex min-h-[calc(100dvh-5rem)] flex-col gap-5 px-5 pb-8 pt-6"
    >
      <header>
        <p className="text-lg font-bold uppercase tracking-widest text-slate-soft">
          {new Date(today.now).toLocaleDateString(
            language === "hi" ? "hi-IN" : "en-US",
            {
              weekday: "long",
              month: "long",
              day: "numeric",
            }
          )}
        </p>

        <h1 className="mt-1 text-4xl leading-tight">
          {greeting(today.now, language)}, {today.patient.name}
        </h1>
      </header>

      <section className="flex items-center gap-5">
        <ProgressRing
          taken={today.taken_count}
          total={today.total_count}
          language={language}
        />

        <div>
          <p className="text-2xl font-bold">
            {language === "hi"
              ? `आज ${today.total_count} में से ${today.taken_count} दवाइयाँ ली गईं`
              : `${today.taken_count} of ${today.total_count} taken today`}
          </p>

          {today.streak_days ? (
            <p className="mt-1 text-xl text-green-dark">
              {today.streak_days} {t.streak}
            </p>
          ) : null}
        </div>
      </section>

      {next ? (
        <div className="block rounded-3xl bg-white p-6 shadow-card">
          <p className="text-lg font-bold uppercase tracking-widest text-slate-soft">
            {t.nextMedicine} · {formatTime(next.time, language)}
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

          <p className="mt-3 text-3xl font-bold leading-tight">
            {next.label}
          </p>

          <p className="mt-1 text-xl text-slate-soft">
            {nextDoses.map((d) => d.name).join(", ")}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-green-light p-6 text-xl font-bold text-green-dark">
          {t.allDone}
        </div>
      )}

      {today.thought ? (
        <section className="rounded-3xl bg-indigo-light p-5">
          <p className="text-lg font-bold uppercase tracking-widest text-navy">
            {t.thought}
          </p>

          <p className="mt-2 text-xl">
            {today.thought.text}
          </p>
        </section>
      ) : null}

      <Link
        to="/patient/checkin"
        aria-label={t.talk}
        className="mx-auto mt-auto flex h-24 w-24 items-center justify-center rounded-full bg-navy text-white shadow-card"
      >
        <MicIcon />
      </Link>
    </div>
  );
}