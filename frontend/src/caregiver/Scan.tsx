// Caregiver Scan tab: photograph the bottles -> Gemini reads them -> review and fix -> confirm the schedule.
// Nothing is saved until "Confirm schedule". Unreadable fields come back empty with a "check this" flag.
import { useRef, useState } from "react";
import { careApi, type ConfirmMed } from "./careApi";

type Phase = "pick" | "reading" | "review" | "saving" | "saved";

const timesText = (t: string[] | undefined) => (t ?? []).join(", ");
const parseTimes = (s: string) =>
  s.split(/[,\s]+/).map((x) => x.trim()).filter((x) => /^\d{1,2}:\d{2}$/.test(x)).map((x) => x.padStart(5, "0"));

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
        <button onClick={reset} className="mt-4 min-h-14 w-full rounded-2xl bg-white text-lg font-bold text-navy">
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
            <span className="text-5xl">📷</span>
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
                  <span className="text-sm font-bold text-slate-soft">Times (24h)</span>
                  <input
                    defaultValue={timesText(m.times)}
                    onBlur={(e) => update(i, { times: parseTimes(e.target.value) })}
                    placeholder="08:00, 20:00"
                    className="mt-1 min-h-14 w-full rounded-xl border border-line px-3 text-lg"
                  />
                </label>
              </div>
              <p className="text-base text-slate-soft">{[m.purpose, m.look].filter(Boolean).join(" · ")}</p>
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
            onClick={() => setMeds((l) => [...l, { name: "", dose: null, times: ["08:00"], high_risk: false, needs_review: false, always_remind: false }])}
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
