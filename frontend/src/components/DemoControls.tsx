import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { clearDue, saveDue } from "../patient/dueStore";
import { unlockAudio } from "../audio";

export default function DemoControls() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (params.get("demo") === "1") sessionStorage.setItem("steady.demo", "1");
  if (sessionStorage.getItem("steady.demo") !== "1") return null;

  async function run(label: string, action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(`${label} failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "min-h-14 rounded-xl border border-navy/30 bg-white px-3 text-base font-bold disabled:opacity-50";

  return (
    <div className="m-3 rounded-2xl border-2 border-dashed border-navy/40 p-3">
      <div className="flex flex-wrap gap-2">
        <button
          className={btn}
          disabled={busy}
          onClick={() =>
            run("Fast-forward", async () => {
                unlockAudio();
                // Jump to whenever the next medicine is due (8 AM, 1 PM, 8 PM... whatever the caregiver scheduled).
                const today = await api.today();
                if (!today.next) {
                  setMessage("No more medicines are due today. Tap Reset to start the day again.");
                  return;
                }
                const r = await api.demoClock(today.next.time);
                const showable = r.due.filter((d) => d.level <= 2 || d.always_remind);
                saveDue(showable);
                if (showable.length > 0) navigate("/patient/reminder");
                })
          }
        >
          Fast-forward to next dose
        </button>
        <button
          className={btn}
          disabled={busy}
          onClick={() =>
            run("Two weeks later", async () => {
              await api.twoWeeksLater();
              window.location.reload();
            })
          }
        >
          Two weeks later
        </button>
        <button
          className={btn}
          disabled={busy}
          onClick={() =>
            run("Reset", async () => {
              await api.reset();
              clearDue();
              window.location.assign("/patient");
            })
          }
        >
          Reset
        </button>
        <button
          className={btn}
          disabled={busy}
          onClick={() =>
            run("Load sample history", async () => {
              await api.loadSample();
              window.location.reload();
            })
          }
        >
          Load sample history
        </button>
        <button
          className={btn}
          disabled={busy}
          onClick={() =>
            run("Start fresh", async () => {
              if (!window.confirm("Wipe the profile, medicines and check-ins, and set everything up again?")) return;
              await api.startFresh();
              clearDue();
              window.location.assign("/patient");
            })
          }
        >
          Start fresh
        </button>
      </div>
      {message ? <p className="mt-2 text-base text-red">{message}</p> : null}
    </div>
  );
}