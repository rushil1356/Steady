import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import DemoControls from "../components/DemoControls";
import { api } from "../api/client";
import Home from "./Home";
import Reminder from "./Reminder";
import Medicines from "./Medicines";
import Checkin from "./Checkin";
import Language from "./Language";

function WaitingForSetup() {
  return (
    <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-6xl" aria-hidden>🌿</span>
      <h1 className="text-3xl font-bold">Steady is almost ready</h1>
      <p className="text-xl text-slate-soft">Your caregiver is setting things up. This screen will change on its own.</p>
    </main>
  );
}

export default function PatientApp() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [lang, setLang] = useState("en");
  const { pathname } = useLocation();

  // Until the caregiver finishes setup there's no name, language or schedule: show a calm waiting screen.
  useEffect(() => {
    let alive = true;
    const check = () =>
      api
        .profile()
        .then((p) => {
          if (!alive) return;
          setReady(p.setup_complete);
          setLang(p.patient.language);
          // The caregiver's profile is the source of truth; keep the screens' language setting in step with it.
          try {
            if (localStorage.getItem("steady-language") !== p.patient.language) {
              localStorage.setItem("steady-language", p.patient.language);
              window.dispatchEvent(new Event("steady-language-change"));
            }
          } catch {
            /* storage blocked: screens fall back to English */
          }
        })
        .catch(() => alive && setReady(true));
    check();
    const id = window.setInterval(check, 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [pathname]);

  return (
    <div className="mx-auto min-h-dvh max-w-[440px]">
      <DemoControls />
      {ready === false ? (
        <WaitingForSetup />
      ) : (
        <>
          {pathname === "/patient" && (
            <Link
              to="/patient/language"
              className="float-right mt-3 mr-4 rounded-full bg-white px-4 py-2 text-base font-bold text-indigo shadow-card"
              aria-label="Change language"
            >
              {lang === "hi" ? "हिन्दी" : "English"} ▾
            </Link>
          )}
          <Routes>
            <Route index element={<Home />} />
            <Route path="language" element={<Language />} />
            <Route path="medicines" element={<Medicines />} />
            <Route path="reminder" element={<Reminder />} />
            <Route path="checkin" element={<Checkin />} />
          </Routes>
        </>
      )}
    </div>
  );
}
