import { useEffect, useState } from "react";
import Alerts from "./Alerts";
import Dashboard from "./Dashboard";
import Profile from "./Profile";
import Scan from "./Scan";
import Today from "./Today";
import { careApi } from "./careApi";

const TABS = [
  ["home", "Home"],
  ["profile", "Profile"],
  ["scan", "Scan"],
  ["today", "Today"],
  ["alerts", "Alerts"],
] as const;

function useHashTab() {
  const read = () => window.location.hash.slice(1) || "home";
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const onChange = () => setTab(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return tab;
}

export default function CaregiverApp() {
  const tab = useHashTab();
  const [setupDone, setSetupDone] = useState<boolean | null>(null);

  // A fresh install starts on Profile: nothing works until the caregiver has set up the patient.
  useEffect(() => {
    careApi
      .profile()
      .then((p) => {
        setSetupDone(p.setup_complete);
        if (!p.setup_complete) window.location.hash = "profile";
      })
      .catch(() => setSetupDone(true));
  }, []);

  const view =
    tab === "profile" ? (
      <Profile
        onSaved={() => {
          if (!setupDone) window.location.hash = "scan"; // next step of first-time setup
          setSetupDone(true);
        }}
      />
    ) : tab === "scan" ? (
      <Scan />
    ) : tab === "alerts" ? (
      <Alerts />
    ) : tab === "today" ? (
      <Today />
    ) : (
      <Dashboard />
    );

  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col">
      <main className="flex-1 p-6">
        {setupDone === false && tab !== "profile" && (
          <a href="#profile" className="mb-4 block rounded-2xl bg-amber-light px-4 py-3 text-lg font-bold text-amber-dark">
            Finish setting up the profile first →
          </a>
        )}
        {view}
      </main>
      <nav aria-label="Main" className="sticky bottom-0 grid grid-cols-5 border-t border-line bg-white">
        {TABS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={`flex min-h-14 items-center justify-center text-sm font-bold ${
              tab === id ? "text-indigo" : "text-slate-soft"
            }`}
          >
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}
