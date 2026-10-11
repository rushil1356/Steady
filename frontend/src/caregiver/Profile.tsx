// Caregiver Profile tab: the caregiver sets up their own details and the patient's profile.
// This is the first screen on a fresh install; nothing in the app has a default name.
import { useEffect, useState, type ReactNode } from "react";
import { careApi, type Profile as ProfileT } from "./careApi";

const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
];

const INTERESTS = ["uplifting thoughts", "clean jokes", "proverbs", "cricket", "music", "gardening", "faith"];

const EMPTY: ProfileT = {
  patient: { full_name: "", preferred_name: "", phone: null, language: "en", interests: [] },
  caregiver: { name: "", relationship: null, phone: "" },
  sharing_consent: false,
  setup_complete: false,
};

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-base font-bold text-navy">{label}</span>
      {hint && <span className="block text-sm text-slate-soft">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const input = "min-h-14 w-full rounded-xl border border-line bg-white px-3 text-lg";

export default function Profile({ onSaved }: { onSaved?: (p: ProfileT) => void }) {
  const [p, setP] = useState<ProfileT>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    careApi
      .profile()
      .then((x) => setP({ ...EMPTY, ...x, patient: { ...EMPTY.patient, ...x.patient }, caregiver: { ...EMPTY.caregiver, ...x.caregiver } }))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  const patient = (patch: Partial<ProfileT["patient"]>) => setP((x) => ({ ...x, patient: { ...x.patient, ...patch } }));
  const caregiver = (patch: Partial<ProfileT["caregiver"]>) => setP((x) => ({ ...x, caregiver: { ...x.caregiver, ...patch } }));
  const toggleInterest = (i: string) =>
    patient({ interests: p.patient.interests?.includes(i) ? p.patient.interests.filter((x) => x !== i) : [...(p.patient.interests ?? []), i] });

  const name = p.patient.preferred_name.trim() || "the patient";
  const missing = [
    !p.caregiver.name.trim() && "your name",
    !p.caregiver.phone.trim() && "your phone",
    !p.patient.full_name.trim() && "their full name",
    !p.patient.preferred_name.trim() && "what Steady should call them",
    !p.sharing_consent && "their agreement to share",
  ].filter(Boolean) as string[];

  const save = async () => {
    if (missing.length) {
      setMessage({ ok: false, text: `Please add ${missing.join(", ")}.` });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const saved = await careApi.saveProfile({ ...p, setup_complete: true });
      setP(saved);
      setMessage({ ok: true, text: "Saved. Steady will now talk to " + saved.patient.preferred_name + "." });
      onSaved?.(saved);
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <p className="text-lg text-slate-soft">Loading…</p>;

  return (
    <div className="space-y-6 pb-6">
      <header>
        <p className="text-sm font-bold tracking-widest text-slate-soft uppercase">Profile</p>
        <h1 className="text-3xl">{p.setup_complete ? "Profile" : "Set up Steady"}</h1>
        {!p.setup_complete && (
          <p className="mt-2 text-lg text-slate-soft">Tell Steady about you and the person you care for. It takes a minute.</p>
        )}
      </header>

      <section className="space-y-4 rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-xl">About you</h2>
        <Field label="Your name">
          <input className={input} value={p.caregiver.name} onChange={(e) => caregiver({ name: e.target.value })} autoComplete="name" />
        </Field>
        <Field label="Relationship" hint="e.g. Son, Daughter, Neighbor">
          <input className={input} value={p.caregiver.relationship ?? ""} onChange={(e) => caregiver({ relationship: e.target.value || null })} />
        </Field>
        <Field label="Your phone" hint="Steady texts you here, silently, if a check-in sounds off">
          <input className={input} type="tel" inputMode="tel" placeholder="+1 555 010 0100" value={p.caregiver.phone} onChange={(e) => caregiver({ phone: e.target.value })} autoComplete="tel" />
        </Field>
      </section>

      <section className="space-y-4 rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-xl">The person you care for</h2>
        <Field label="Full name">
          <input className={input} value={p.patient.full_name} onChange={(e) => patient({ full_name: e.target.value })} />
        </Field>
        <Field label="What should Steady call them?" hint="e.g. Asha, Mom, Mr. Lee">
          <input className={input} value={p.patient.preferred_name} onChange={(e) => patient({ preferred_name: e.target.value })} />
        </Field>
        <Field label="Their phone" hint="For the Call button on alerts">
          <input className={input} type="tel" inputMode="tel" value={p.patient.phone ?? ""} onChange={(e) => patient({ phone: e.target.value || null })} />
        </Field>
        <div>
          <p className="text-base font-bold text-navy">Language Steady speaks with {name}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => patient({ language: l.code })}
                aria-pressed={p.patient.language === l.code}
                className={`min-h-16 rounded-2xl border-2 text-xl font-bold ${
                  p.patient.language === l.code ? "border-indigo bg-indigo-light text-navy" : "border-line bg-white text-slate-soft"
                }`}
              >
                {l.native}
                {l.code === "en" && <span className="block text-sm font-normal">Default</span>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-base font-bold text-navy">What does {name} enjoy?</p>
          <p className="text-sm text-slate-soft">Steady opens check-ins with a line about these</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = p.patient.interests?.includes(i);
              return (
                <button key={i} type="button" onClick={() => toggleInterest(i)} aria-pressed={on}
                  className={`min-h-12 rounded-full border px-4 text-base font-bold ${on ? "border-indigo bg-indigo text-white" : "border-line bg-white text-navy"}`}>
                  {i}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <label className="flex gap-3 rounded-3xl border-2 border-line bg-white p-5">
        <input type="checkbox" className="mt-1 size-7 shrink-0" checked={p.sharing_consent} onChange={(e) => setP((x) => ({ ...x, sharing_consent: e.target.checked }))} />
        <span className="text-lg leading-snug">
          <span className="font-bold">{name === "the patient" ? "The patient agrees" : `${name} agrees`}</span> that notes from
          check-ins are shared with {p.caregiver.name.trim() || "me"}. Steady won't tell them each time; that's what keeps check-ins relaxed.
        </span>
      </label>

      {message && (
        <p className={`rounded-2xl px-4 py-3 text-lg ${message.ok ? "bg-green-light text-green-dark" : "bg-amber-light text-amber-dark"}`}>{message.text}</p>
      )}
      <button onClick={save} disabled={saving} className="min-h-16 w-full rounded-2xl bg-navy text-xl font-bold text-white disabled:opacity-50">
        {saving ? "Saving…" : p.setup_complete ? "Save changes" : "Finish setup"}
      </button>
    </div>
  );
}
