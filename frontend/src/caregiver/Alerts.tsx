// Caregiver Alerts tab: the silent alert arrives here (and by SMS), with how Steady understood the check-in.
// Polls /api/alerts/latest every 3 s; refetches the feed when a new check-in lands.
import { useCallback, useEffect, useRef, useState } from "react";
import { careApi, when, type ActiveAlert, type CheckinRow, type Profile, type Tier } from "./careApi";

const TIER_STYLE: Record<Tier, { dot: string; card: string; label: string }> = {
  red: { dot: "bg-red", card: "border-red bg-[#fef2f2]", label: "Needs attention now" },
  yellow: { dot: "bg-amber", card: "border-amber bg-amber-light", label: "Worth a check-in" },
  green: { dot: "bg-green", card: "border-line bg-white", label: "All good" },
};

function Understood({ why, tone, heard }: { why?: string[]; tone?: string | null; heard?: boolean }) {
  if (!why?.length && !tone) return null;
  return (
    <div className="mt-4 rounded-2xl bg-white/80 p-4">
      <p className="text-sm font-bold tracking-wider text-slate-soft uppercase">How Steady understood it</p>
      <ul className="mt-2 space-y-1.5">
        {why?.map((w) => (
          <li key={w} className="flex gap-2 text-base text-navy">
            <span aria-hidden>•</span>
            {w}
          </li>
        ))}
      </ul>
      {tone && (
        <p className="mt-2 text-base text-slate-soft">
          <span className="font-bold">How it sounded:</span> {tone}
        </p>
      )}
      {heard && <p className="mt-2 text-sm text-slate-soft">Gemini listened to the recording, not just the words.</p>}
    </div>
  );
}

function AlertCard({ alert, profile, onHandled }: { alert: ActiveAlert; profile: Profile | null; onHandled: () => void }) {
  const s = TIER_STYLE[alert.tier as Tier];
  const name = profile?.patient.preferred_name ?? "them";
  const phone = profile?.patient.phone;
  return (
    <section className={`rounded-3xl border-2 p-5 shadow-[var(--shadow-card)] ${s.card}`} role="alert">
      <p className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase">
        <span className={`size-3 rounded-full ${s.dot}`} /> {s.label} · {when(alert.created_at)}
      </p>
      <h2 className="mt-2 text-2xl leading-tight">{alert.title}</h2>
      <p className="mt-2 text-lg leading-snug">{alert.summary}</p>
      <Understood why={alert.why} tone={alert.tone_note} />
      <p className="mt-3 text-sm text-slate-soft">
        {alert.sms_sent ? `✓ Text sent to ${profile?.caregiver.name ?? "you"}` : "Text not sent (check Twilio settings)"}
      </p>
      <div className="mt-4 grid gap-2">
        {phone && (
          <a href={`tel:${phone}`} className="flex min-h-14 items-center justify-center rounded-2xl bg-navy text-xl font-bold text-white">
            📞 Call {name}
          </a>
        )}
        <button onClick={onHandled} className="min-h-14 rounded-2xl border border-line bg-white text-lg font-bold text-navy">
          Mark as handled
        </button>
      </div>
    </section>
  );
}

function FeedCard({ c }: { c: CheckinRow }) {
  const s = TIER_STYLE[c.tier as Tier];
  return (
    <article className="rounded-3xl border border-line bg-white p-5 shadow-[var(--shadow-soft)]">
      <p className="flex items-center gap-2 text-base font-bold text-slate-soft">
        <span className={`size-2.5 rounded-full ${s.dot}`} /> {when(c.at)}
      </p>
      <blockquote className="mt-2 border-l-4 border-indigo-light pl-3 text-lg leading-snug">“{c.quote}”</blockquote>
      {c.quote_en && <p className="mt-1 pl-4 text-base text-slate-soft">“{c.quote_en}”</p>}
      {!!c.symptoms?.length && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.symptoms.map((x) => (
            <span key={x} className="rounded-full bg-blue-light px-3 py-1 text-sm font-bold text-indigo">{x}</span>
          ))}
        </div>
      )}
      <Understood why={c.why} tone={c.tone_note} heard={c.heard_audio} />
    </article>
  );
}

export default function Alerts() {
  const [alert, setAlert] = useState<ActiveAlert | null>(null);
  const [feed, setFeed] = useState<CheckinRow[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [offline, setOffline] = useState(false);
  const lastCheckin = useRef<number | null | undefined>(undefined);
  const lastAlert = useRef<number | null>(null);

  const loadFeed = useCallback(() => careApi.dashboard().then((d) => setFeed(d.checkins)).catch(() => undefined), []);

  useEffect(() => {
    careApi.profile().then(setProfile).catch(() => undefined);
    let stop = false;
    const poll = async () => {
      try {
        const latest = await careApi.alertsLatest();
        if (stop) return;
        setOffline(false);
        setAlert(latest.alert ?? null);
        if (latest.alert && latest.alert.id !== lastAlert.current && lastAlert.current !== null) {
          navigator.vibrate?.([200, 100, 200]); // a new alert arrived while the app was open
        }
        lastAlert.current = latest.alert?.id ?? lastAlert.current ?? 0;
        if (latest.latest_checkin_id !== lastCheckin.current) {
          lastCheckin.current = latest.latest_checkin_id;
          void loadFeed();
        }
      } catch {
        if (!stop) setOffline(true);
      }
    };
    void poll();
    const id = window.setInterval(poll, 3000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [loadFeed]);

  const handled = async () => {
    if (!alert) return;
    await careApi.alertHandled(alert.id).catch(() => undefined);
    setAlert(null);
    void loadFeed();
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-bold tracking-widest text-slate-soft uppercase">Alerts</p>
        <h1 className="text-3xl">{profile ? `${profile.patient.preferred_name}'s check-ins` : "Check-ins"}</h1>
      </header>
      {offline && <p className="rounded-2xl bg-amber-light px-4 py-3 text-amber-dark">Can't reach Steady. Retrying…</p>}
      {alert ? (
        <AlertCard alert={alert} profile={profile} onHandled={handled} />
      ) : (
        <section className="rounded-3xl border border-line bg-green-light p-5 text-green-dark">
          <p className="text-xl font-bold">All quiet</p>
          <p className="mt-1 text-base">You'll get a text and see it here if a check-in sounds off.</p>
        </section>
      )}
      <h2 className="pt-2 text-xl">Recent check-ins</h2>
      <div className="space-y-3">
        {feed.map((c, i) => (
          <FeedCard key={c.id ?? `seed-${i}`} c={c} />
        ))}
      </div>
    </div>
  );
}
