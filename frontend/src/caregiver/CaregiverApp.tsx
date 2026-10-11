import { useEffect, useState } from "react";
import Alerts from "./Alerts";
import Scan from "./Scan";

const TABS = [
  ["profile", "Profile"],
  ["scan", "Scan"],
  ["today", "Today"],
  ["alerts", "Alerts"],
] as const;

function useHashTab() {
  const read = () => window.location.hash.slice(1) || "today";
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
  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col">
      <main className="flex-1 p-6">
        {tab === "alerts" ? <Alerts /> : tab === "scan" ? <Scan /> : <h1 className="text-3xl">Caregiver: {tab}</h1>}
      </main>
      <nav aria-label="Main" className="sticky bottom-0 grid grid-cols-4 border-t border-line bg-white">
        {TABS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={`flex min-h-14 items-center justify-center text-base font-bold ${
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