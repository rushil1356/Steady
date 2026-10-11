import { useEffect, useState } from "react";
import { api } from "../api/client";
import "./Caregiver.css";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const TABS = [
  ["profile", "Profile"],
  ["scan", "Scan"],
  ["today", "Today"],
  ["alerts", "Alerts"],
] as const;

type Dashboard = Awaited<ReturnType<typeof api.caregiverDashboard>>;
type Checkin = Dashboard["checkins"][number];

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

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function StatusBadge({ tier }: { tier: string }) {
  const label =
    tier === "red"
      ? "Urgent"
      : tier === "yellow"
        ? "Needs attention"
        : "Doing well";

  return (
    <span className={`cg-badge cg-badge--${tier}`}>
      <span aria-hidden="true">●</span> {label}
    </span>
  );
}

function CheckinCard({ checkin }: { checkin: Checkin }) {
  return (
    <article
      className={`cg-feed-card ${
        checkin.tier !== "green" ? "cg-feed-card--alert" : ""
      }`}
    >
      <div className="cg-feed-header">
        <strong>{formatDate(checkin.at)}</strong>
        <StatusBadge tier={checkin.tier} />
      </div>

      <blockquote className="cg-quote">
        “{checkin.quote}”
      </blockquote>

      {checkin.quote_en && checkin.quote_en !== checkin.quote && (
        <p className="cg-feed-note">
          <strong>English:</strong> {checkin.quote_en}
        </p>
      )}

      <p className="cg-feed-note">
        <strong>AI observation:</strong> {checkin.tag}
      </p>

      {checkin.tone_note && (
        <p className="cg-feed-note" style={{ marginTop: 8 }}>
          <strong>Voice observation:</strong> {checkin.tone_note}
        </p>
      )}

      {checkin.symptoms.length > 0 && (
        <div className="cg-alert-factors">
          {checkin.symptoms.map((symptom) => (
            <span className="cg-alert-factor" key={symptom}>
              {symptom}
            </span>
          ))}
        </div>
      )}

      {checkin.why.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
            How Steady understood it
          </summary>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            {checkin.why.map((reason, index) => (
              <li key={index} className="cg-feed-note">
                {reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function AlertCenter({ data }: { data: Dashboard }) {
  const alert = data.active_alert;

  return (
    <section className="cg-section">
      <p className="cg-eyebrow">Safety response</p>
      <h2 className="cg-section-title">Alert Escalation Center</h2>

      {alert ? (
        <div
          className={`cg-alert ${
            alert.tier === "red" ? "cg-alert--red" : ""
          }`}
        >
          <StatusBadge tier={alert.tier} />

          <h3>{alert.title}</h3>
          <p>{alert.summary}</p>

          <p className="cg-feed-note" style={{ marginTop: 12 }}>
            Detected {formatDate(alert.created_at)}
          </p>

          {alert.why.length > 0 && (
            <div className="cg-alert-factors">
              {alert.why.map((reason, index) => (
                <span className="cg-alert-factor" key={index}>
                  {reason}
                </span>
              ))}
            </div>
          )}

          {alert.tone_note && (
            <p style={{ marginTop: 14 }}>
              <strong>Voice observation:</strong> {alert.tone_note}
            </p>
          )}

          <div className="cg-card" style={{ marginTop: 16 }}>
            <strong>Caregiver SMS</strong>
            <p className="cg-feed-note" style={{ marginTop: 6 }}>
              {alert.sms_sent
                ? "SMS marked as sent"
                : "SMS not confirmed as sent"}
            </p>
          </div>
        </div>
      ) : (
        <div className="cg-card">
          <StatusBadge tier="green" />
          <p style={{ marginTop: 12 }}>
            No active caregiver alerts.
          </p>
        </div>
      )}

      <div className="cg-card" style={{ marginTop: 16 }}>
        <strong>Steady safety note</strong>
        <p className="cg-feed-note" style={{ marginTop: 8 }}>
          Voice observations are wellness indicators, not medical
          diagnoses. If someone is seriously injured or in immediate
          danger, contact emergency services.
        </p>
      </div>
    </section>
  );
}
function MoodTrendChart({ data }: { data: Dashboard }) {
  const moodData = [...data.mood_14d]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => ({
      date: point.date,
      label: new Date(`${point.date}T12:00:00`).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric" }
      ),
      score: point.score,
    }));

  return (
    <section className="cg-section">
      <p className="cg-eyebrow">Patient wellness</p>
      <h2 className="cg-section-title">14-Day Mood Trend</h2>

      <div className="cg-card">
        <p className="cg-subtitle">
          Track changes in Asha's reported wellness over time.
        </p>

        {moodData.length === 0 ? (
          <p className="cg-feed-note" style={{ marginTop: 20 }}>
            No mood history available yet.
          </p>
        ) : (
          <div style={{ width: "100%", height: 280, marginTop: 24 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={moodData}
                margin={{ top: 10, right: 20, left: -15, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                />

                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickLine={false}
                />

                <YAxis
                  domain={[0, 10]}
                  ticks={[0, 2, 4, 6, 8, 10]}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickLine={false}
                />

                <Tooltip
                  formatter={(value) => [`${value}/10`, "Mood score"]}
                  labelFormatter={(label) => `Date: ${label}`}
                />

                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#312e81"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "#312e81",
                    strokeWidth: 2,
                    stroke: "#ffffff",
                  }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="cg-feed-note" style={{ marginTop: 16 }}>
          Mood scores are AI-generated wellness indicators, not
          medical diagnoses.
        </p>
      </div>
    </section>
  );
}
function MedicationIndependence({ data }: { data: Dashboard }) {
  const kpis = data.kpis;

  const independencePct =
    kpis.doses_this_week > 0
      ? Math.round(
          (kpis.unprompted_this_week / kpis.doses_this_week) * 100
        )
      : 0;

  const weeklyData = data.unprompted_by_week.map((week) => ({
    week: week.label,
    doses: week.value,
  }));

  return (
    <section className="cg-section">
      <p className="cg-eyebrow">Building healthy habits</p>
      <h2 className="cg-section-title">Medication Independence</h2>

      <div className="cg-grid">
        <div className="cg-card">
          <p className="cg-stat-label">Taken without reminders</p>
          <p className="cg-stat-value">{independencePct}%</p>

          <p className="cg-feed-note">
            {kpis.unprompted_this_week} of {kpis.doses_this_week} doses
            this week
          </p>

          <div
            className="cg-progress"
            role="progressbar"
            aria-label="Medication independence"
            aria-valuenow={independencePct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="cg-progress-fill"
              style={{ width: `${independencePct}%` }}
            />
          </div>
        </div>

        <div className="cg-card">
          <p className="cg-stat-label">Reminders needed</p>
          <p className="cg-stat-value">
            {Math.max(
              0,
              kpis.doses_this_week - kpis.unprompted_this_week
            )}
          </p>
          <p className="cg-feed-note">Doses this week</p>
        </div>
      </div>

      <div className="cg-card" style={{ marginTop: 16 }}>
        <h3 className="cg-card-title">Independence Over Time</h3>

        <p className="cg-subtitle">
          Weekly doses taken without a reminder
        </p>

        {weeklyData.length === 0 ? (
          <p className="cg-feed-note" style={{ marginTop: 20 }}>
            No independence history available yet.
          </p>
        ) : (
          <div style={{ width: "100%", height: 260, marginTop: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />

                <Tooltip />

                <Bar
                  dataKey="doses"
                  name="Unprompted doses"
                  fill="#312e81"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={55}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {data.medications.length > 0 && (
        <div className="cg-section">
          <h3 className="cg-card-title">Medication Breakdown</h3>

          <div className="cg-feed">
            {data.medications.map((med) => (
              <div className="cg-card" key={med.id}>
                <div className="cg-feed-header">
                  <div>
                    <strong>{med.name}</strong>
                    <p className="cg-feed-note">
                      {med.dose} · {med.schedule}
                    </p>
                  </div>

                  <strong>{med.independence}%</strong>
                </div>

                <div
                  className="cg-progress"
                  role="progressbar"
                  aria-label={`${med.name} independence`}
                  aria-valuenow={med.independence}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="cg-progress-fill"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, med.independence)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TodayDashboard({ data }: { data: Dashboard }) {
  const kpis = data.kpis;
  const progress =
    kpis.today_total > 0
      ? Math.min(100, (kpis.today_taken / kpis.today_total) * 100)
      : 0;

  return (
    <>
      <section className="cg-profile-banner">
        <div className="cg-profile-row">
          <div className="cg-avatar" aria-hidden="true">A</div>
          <div>
            <p className="cg-eyebrow">Patient overview</p>
            <h1 className="cg-title">Asha's Dashboard</h1>
            <StatusBadge tier={data.status.tier} />
          </div>
        </div>

        <p className="cg-subtitle" style={{ marginTop: 16 }}>
          {data.status.headline}
        </p>

        <p className="cg-feed-note" style={{ marginTop: 8 }}>
          Last status update: {formatDate(data.status.updated_at)}
        </p>
      </section>

      <section className="cg-section">
        <p className="cg-eyebrow">Daily rhythm</p>
        <h2 className="cg-section-title">
          Habit Formation Progress
        </h2>

        <div className="cg-grid">
          <div className="cg-card">
            <p className="cg-stat-label">Today's doses</p>
            <p className="cg-stat-value">
              {kpis.today_taken}/{kpis.today_total}
            </p>
            <p className="cg-feed-note">Taken today</p>
            <div
              className="cg-progress"
              role="progressbar"
              aria-label="Today's medication progress"
              aria-valuenow={kpis.today_taken}
              aria-valuemin={0}
              aria-valuemax={kpis.today_total}
            >
              <div
                className="cg-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="cg-card">
            <p className="cg-stat-label">On-time adherence</p>
            <p className="cg-stat-value">
              {kpis.on_time_pct_30d}%
            </p>
            <p className="cg-feed-note">Last 30 days</p>
          </div>

          <div className="cg-card">
            <p className="cg-stat-label">On-time doses</p>
            <p className="cg-stat-value">
              {kpis.on_time_doses_30d}
            </p>
            <p className="cg-feed-note">
              Out of {kpis.doses_30d} doses
            </p>
          </div>

          <div className="cg-card">
            <p className="cg-stat-label">Check-ins answered</p>
            <p className="cg-stat-value">
              {kpis.checkins_answered_14d}
            </p>
            <p className="cg-feed-note">Last 14 days</p>
          </div>
        </div>
      </section>

      <section className="cg-section">
        <p className="cg-eyebrow">Steady voice insights</p>
        <h2 className="cg-section-title">
          Voice &amp; Wellness Triage
        </h2>

        <div className="cg-feed">
          {data.checkins.length > 0 ? (
            data.checkins.slice(0, 4).map((checkin) => (
              <CheckinCard key={checkin.id} checkin={checkin} />
            ))
          ) : (
            <div className="cg-card">
              No check-ins recorded yet.
            </div>
          )}
        </div>

        {data.checkins.length > 4 && (
          <a
            href="#alerts"
            className="cg-button"
            style={{ marginTop: 14 }}
          >
            View check-in history
          </a>
        )}
      </section>
<MoodTrendChart data={data} />
<MedicationIndependence data={data} />
<AlertCenter data={data} />
    </>
  );
}

export default function CaregiverApp() {
  const tab = useHashTab();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const result = await api.caregiverDashboard();
        if (active) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load dashboard"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [tab]);

  return (
    <div className="caregiver-app flex min-h-dvh flex-col">
      <main className="cg-page w-full flex-1">
        {loading && <p role="status">Loading caregiver dashboard...</p>}

        {error && (
          <div className="cg-alert cg-alert--red" role="alert">
            Could not load dashboard: {error}
          </div>
        )}

        {!loading && data && (
          <>
            {tab === "today" && <TodayDashboard data={data} />}

            {tab === "alerts" && (
              <>
                <p className="cg-eyebrow">Patient safety</p>
                <h1 className="cg-title">Alerts &amp; Check-ins</h1>

                <AlertCenter data={data} />

                <section className="cg-section">
                  <h2 className="cg-section-title">
                    Check-in History
                  </h2>
                  <div className="cg-feed">
                    {data.checkins.map((checkin) => (
                      <CheckinCard
                        key={checkin.id}
                        checkin={checkin}
                      />
                    ))}
                  </div>
                </section>
              </>
            )}

            {tab === "scan" && (
              <section className="cg-card">
                <h1 className="cg-title">Scan Medication</h1>
                <p className="cg-subtitle">
                  Medication scanning will be added here.
                </p>
              </section>
            )}

            {tab === "profile" && (
              <section className="cg-card">
                <h1 className="cg-title">Patient Profile</h1>
                <p className="cg-subtitle">
                  Asha's caregiver overview
                </p>

                <h2 className="cg-card-title" style={{ marginTop: 20 }}>
                  Interests
                </h2>
                <div className="cg-alert-factors">
                  {data.interests.map((interest) => (
                    <span className="cg-alert-factor" key={interest}>
                      {interest}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <nav aria-label="Main" className="cg-nav">
        {TABS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={tab === id ? "page" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}