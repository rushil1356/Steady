// Caregiver Today tab: today's schedule as saved by the scheduling engine, with live status, plus how much
// Steady is still reminding for each medicine (the fading levels).
import { useEffect, useState } from "react";
import { careApi, type Today as TodayT } from "./careApi";

const STATUS: Record<string, { label: string; cls: string }> = {
  taken: { label: "Taken", cls: "bg-green-light text-green-dark" },
  due: { label: "Due now", cls: "bg-amber-light text-amber-dark" },
  missed: { label: "Missed", cls: "bg-[#fef2f2] text-red" },
  upcoming: { label: "Upcoming", cls: "bg-blue-light text-indigo" },
};
const LEVEL = ["", "Full spoken reminder", "Short nudge", "Silent: habit formed", "Silent: habit formed"];

const fmt = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function Today() {
  const [today, setToday] = useState<TodayT | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => careApi.today().then(setToday).catch((e: Error) => setError(e.message));
    load();
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, []);

  if (error && !today) return <p className="text-lg text-red">{error}</p>;
  if (!today) return <p className="text-lg text-slate-soft">Loading…</p>;

  const byTime = today.doses.reduce<Record<string, typeof today.doses>>((acc, d) => ((acc[d.time] ??= []).push(d), acc), {});
  const name = today.patient.name || "Your patient";

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-bold tracking-widest text-slate-soft uppercase">Today</p>
        <h1 className="text-3xl">{name}'s medicines</h1>
      </header>

      {today.total_count === 0 ? (
        <section className="rounded-3xl border-2 border-dashed border-indigo bg-blue-light p-6 text-indigo">
          <p className="text-xl font-bold">No medicines scheduled yet</p>
          <p className="mt-1 text-base">Photograph the bottles and Steady will set up the schedule.</p>
          <a href="#scan" className="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-navy text-lg font-bold text-white">Scan bottles</a>
        </section>
      ) : (
        <>
          <section className="flex items-center justify-between rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)]">
            <div>
              <p className="text-4xl font-bold">{today.taken_count} of {today.total_count}</p>
              <p className="text-base text-slate-soft">taken today</p>
            </div>
            {today.streak_days ? <p className="text-lg font-bold text-green-dark">{today.streak_days} in a row on their own</p> : null}
          </section>
          {Object.entries(byTime).map(([time, doses]) => (
            <section key={time}>
              <h2 className="mb-2 text-xl">{fmt(time)}</h2>
              <div className="space-y-2">
                {doses.map((d) => (
                  <article key={d.dose_id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
                    <span className="size-8 shrink-0 rounded-full border border-line" style={{ background: d.color ?? "#e2e8f0" }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold">{d.name} <span className="font-normal text-slate-soft">{d.dose}</span></p>
                      <p className="text-sm text-slate-soft">{d.always_remind ? "Always reminds (high-risk)" : LEVEL[d.level] ?? ""}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${STATUS[d.status]?.cls}`}>{STATUS[d.status]?.label}</span>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
