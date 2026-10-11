// The patient's own language choice. Steady speaks, captions and listens in this language.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

const LANGUAGES = [
  { code: "en", native: "English", hint: "Steady speaks English" },
  { code: "hi", native: "हिन्दी", hint: "Steady हिन्दी में बात करेगा" },
];

export default function Language() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.profile().then((p) => setCurrent(p.patient.language)).catch(() => setCurrent("en"));
  }, []);

  const choose = async (code: string) => {
    setSaving(true);
    try {
      await api.setLanguage(code);

localStorage.setItem("steady-language", code);
window.dispatchEvent(new Event("steady-language-change"));

setCurrent(code);
navigate("/patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col gap-5 px-5 pt-8 pb-8">
      <button type="button" onClick={() => navigate("/patient")} className="min-h-12 self-start text-xl font-bold text-indigo">
        ← Back
      </button>
      <h1 className="text-4xl font-bold">Language · भाषा</h1>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          disabled={saving}
          onClick={() => choose(l.code)}
          aria-pressed={current === l.code}
          className={`min-h-24 rounded-3xl border-4 px-6 text-left shadow-card ${
            current === l.code ? "border-indigo bg-indigo-light" : "border-white bg-white"
          }`}
        >
          <span className="block text-3xl font-bold">{l.native}</span>
          <span className="block text-lg text-slate-soft">{l.hint}</span>
        </button>
      ))}
    </main>
  );
}
