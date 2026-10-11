// Caregiver Scan tab: photograph the bottles -> Gemini reads them -> review and fix -> confirm the schedule.
// Nothing is saved until "Confirm schedule". Unreadable fields come back empty with a "check this" flag.
import { useRef, useState } from "react";
import { careApi, type ConfirmMed } from "./careApi";

type Phase = "pick" | "reading" | "review" | "saving" | "saved";

// Tap-to-pick dose times. "Other" accepts any time with the phone's own time picker.
const SLOTS = [
  { time: "08:00", label: "Morning", sub: "8 AM" },
  { time: "13:00", label: "Afternoon", sub: "1 PM" },
  { time: "20:00", label: "Evening", sub: "8 PM" },
  { time: "22:00", label: "Bedtime", sub: "10 PM" },
];

// Backup for the stage: the 4 printed demo labels, in case the camera or Wi-Fi fails.
const DEMO_MEDS: ConfirmMed[] = [
  { name: "Metoprolol", dose: "25 mg", times: ["20:00"], purpose: "Blood pressure", look: "yellow pill", color: "#F2C94C", high_risk: false, needs_review: false, always_remind: false },
  { name: "Warfarin", dose: "5 mg", times: ["20:00"], purpose: "Blood thinner", look: "pink pill", color: "#E8A0BF", high_risk: true, needs_review: false, always_remind: true },
  { name: "Atorvastatin", dose: "20 mg", times: ["08:00"], purpose: "Cholesterol", look: "white pill", color: "#FFFFFF", high_risk: false, needs_review: false, always_remind: false },
  { name: "Vitamin D", dose: "1000 IU", times: ["08:00"], purpose: "Supplement", look: "orange pill", color: "#E9A23B", high_risk: false, needs_review: false, always_remind: false },
];

const BLANK: ConfirmMed = { name: "", dose: null, times: [], high_risk: false, needs_review: false, always_remind: false };

function TimePicker({ times, onChange }: { times: string[]; onChange: (t: string[]) => void }) {
  const [other, setOther] = useState("");
  const toggle = (t: string) => onChange(times.includes(t) ? times.filter((x) => x !== t) : [...times, t].sort());
  const extra = times.filter((t) => !SLOTS.some((s) => s.time === t));
  return (
    <div>
      <span className="text-sm font-bold text-slate-soft">When to take it</span>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {SLOTS.map((s) => {
          const on = times.includes(s.time);
          return (
            <button key={s.time} type="button" onClick={() => toggle(s.time)} aria-pressed={on}
              className={`min-h-14 rounded-xl border-2 text-lg font-bold ${on ? "border-indigo bg-indigo-light text-navy" : "border-line bg-white text-slate-soft"}`}>
              {s.label} <span className="text-sm font-normal">{s.sub}</span>
            </button>
          );
        })}
      </div>
      {extra.map((t) => (
        <button key={t} type="button" onClick={() => toggle(t)} className="mt-2 mr-2 min-h-12 rounded-full bg-indigo px-4 text-base font-bold text-white">
          {t} ✕
        </button>
      ))}
      <div className="mt-2 flex gap-2">
        <input type="time" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Other time" className="min-h-12 flex-1 rounded-xl border border-line px-3 text-lg" />
        <button type="button" disabled={!other} onClick={() => { if (other && !times.includes(other)) onChange([...times, other].sort()); setOther(""); }}
          className="min-h-12 rounded-xl border border-line bg-white px-4 text-base font-bold text-indigo disabled:opacity-40">
          Add time
        </button>
      </div>
    </div>
  );
}

export default function Scan() {
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [meds, setMeds] = useState<ConfirmMed[]>([]);
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);

  const addPhotos = (files: FileList | null) => {
    if (files?.length) setPhotos((p) => [...p, ...Array.from(files)].slice(0, 6));
  };

  const read = async () => {
    setPhase("reading");
    setError(null);
    try {
      const r = await careApi.extract(photos);
      setMeds(r.medications.map((m) => ({ ...m, always_remind: !!m.high_risk })));
      if (!r.medications.length) setError("Steady couldn't read those labels. Try a closer photo, or add the medicine by hand.");
      setPhase("review");
    } catch (e) {
      setError((e as Error).message);
      setPhase("pick");
    }
  };

  const update = (i: number, patch: Partial<ConfirmMed>) =>
    setMeds((list) => list.map((m, j) => (j === i ? { ...m, ...patch, needs_review: false } : m)));

  const confirm = async () => {
    const noTime = meds.find((m) => m.name.trim() && !(m.times ?? []).length);
    if (noTime) {
      setError(`Pick when ${noTime.name} should be taken.`);
      return;
    }
    setPhase("saving");
    setError(null);
    try {
      await careApi.confirm(meds.filter((m) => m.name.trim()));
      setPhase("saved");
    } catch (e) {
      setError((e as Error).message);
      setPhase("review");
    }
  };

  const reset = () => (setPhotos([]), setMeds([]), setError(null), setPhase("pick"));

  if (phase === "saved") {
    return (
      <section className="rounded-3xl bg-green-light p-6 text-green-dark">
        <p className="text-2xl font-bold">Schedule saved</p>
        <p className="mt-2 text-lg">Steady will remind at the right times, and ease off as the habit forms.</p>
        <a href="#today" className="mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl bg-navy text-lg font-bold text-white">
          See today's schedule
        </a>
        <button onClick={reset} className="mt-2 min-h-14 w-full rounded-2xl bg-white text-lg font-bold text-navy">
          Scan more bottles
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-bold tracking-widest text-slate-soft uppercase">Scan</p>
        <h1 className="text-3xl">{phase === "review" ? "Check the schedule" : "Photograph the bottles"}</h1>
      </header>

      {phase !== "review" && phase !== "saving" && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(e) => (addPhotos(e.target.files), (e.target.value = ""))}
          />
          <button
            onClick={() => input.current?.click()}
            className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-indigo bg-blue-light text-indigo"
          >
            <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            <span className="text-xl font-bold">{photos.length ? "Add another bottle" : "Open camera"}</span>
            <span className="text-base">One bottle per photo, label facing you</span>
          </button>
          {!!photos.length && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <img key={i} src={URL.createObjectURL(p)} alt={`Label photo ${i + 1}`} className="aspect-square w-full rounded-2xl object-cover" />
              ))}
            </div>
          )}
          <button
            onClick={read}
            disabled={!photos.length || phase === "reading"}
            className="min-h-16 w-full rounded-2xl bg-navy text-xl font-bold text-white disabled:opacity-40"
          >
            {phase === "reading" ? "Reading the labels…" : `Read ${photos.length || ""} label${photos.length === 1 ? "" : "s"}`}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setMeds([{ ...BLANK }]); setPhase("review"); }} className="min-h-14 rounded-2xl border border-line bg-white text-base font-bold text-indigo">
              Add by hand
            </button>
            <button onClick={() => { setMeds(DEMO_MEDS.map((m) => ({ ...m }))); setPhase("review"); }} className="min-h-14 rounded-2xl border border-line bg-white text-base font-bold text-slate-soft">
              Use demo medicines
            </button>
          </div>
        </>
      )}

      {(phase === "review" || phase === "saving") && (
        <>
          <p className="text-lg text-slate-soft">Steady read these from the labels. Fix anything that looks wrong.</p>
          {meds.map((m, i) => (
            <article key={i} className={`space-y-3 rounded-3xl border-2 bg-white p-5 ${m.needs_review ? "border-amber" : "border-line"}`}>
              {m.needs_review && <p className="text-sm font-bold text-amber-dark">Please check: part of this label was unclear</p>}
              <label className="block">
                <span className="text-sm font-bold text-slate-soft">Medicine</span>
                <input value={m.name} onChange={(e) => update(i, { name: e.target.value })} className="mt-1 min-h-14 w-full rounded-xl border border-line px-3 text-xl font-bold" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-bold text-slate-soft">Dose</span>
                  <input value={m.dose ?? ""} onChange={(e) => update(i, { dose: e.target.value || null })} className="mt-1 min-h-14 w-full rounded-xl border border-line px-3 text-lg" />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-soft">What it's for</span>
                  <input value={m.purpose ?? ""} onChange={(e) => update(i, { purpose: e.target.value || null })} placeholder="e.g. Blood pressure" className="mt-1 min-h-14 w-full rounded-xl border border-line px-3 text-lg" />
                </label>
              </div>
              <TimePicker times={m.times ?? []} onChange={(t) => update(i, { times: t })} />
              {m.look && <p className="text-base text-slate-soft">Looks like: {m.look}</p>}
              <label className="flex min-h-12 items-center gap-3 text-base">
                <input type="checkbox" checked={!!m.always_remind} onChange={(e) => update(i, { always_remind: e.target.checked })} className="size-6" />
                <span>
                  Always remind{m.high_risk && <span className="font-bold text-amber-dark"> (recommended: high-risk medicine)</span>}
                </span>
              </label>
              <button onClick={() => setMeds((l) => l.filter((_, j) => j !== i))} className="text-base text-slate-soft underline">
                Remove
              </button>
            </article>
          ))}
          <button
            onClick={() => setMeds((l) => [...l, { ...BLANK }])}
            className="min-h-14 w-full rounded-2xl border border-line bg-white text-lg font-bold text-indigo"
          >
            + Add a medicine by hand
          </button>
          <button onClick={confirm} disabled={phase === "saving" || !meds.length} className="min-h-16 w-full rounded-2xl bg-navy text-xl font-bold text-white disabled:opacity-40">
            {phase === "saving" ? "Saving…" : "Confirm schedule"}
          </button>
          <button onClick={reset} className="w-full text-base text-slate-soft underline">Start over</button>
        </>
      )}
      {error && <p className="rounded-2xl bg-amber-light px-4 py-3 text-lg text-amber-dark">{error}</p>}
    </div>
  );
}
