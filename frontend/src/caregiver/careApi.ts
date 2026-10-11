// Caregiver-side API calls. Types come from the generated OpenAPI schema (../api/schema.d.ts).
import type { components } from "../api/schema";

type S = components["schemas"];
export type AlertsLatest = S["AlertsLatest"];
export type ActiveAlert = S["ActiveAlert"];
export type Dashboard = S["Dashboard"];
export type CheckinRow = S["CheckinRow"];
export type Profile = S["Profile"];
export type ExtractedMed = S["ExtractedMed"];
export type ConfirmMed = S["ConfirmMed"];
export type Tier = "green" | "yellow" | "red";
export type Today = S["Today"];

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // keep the status text
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const careApi = {
  alertsLatest: () => request<AlertsLatest>("/api/alerts/latest"),
  dashboard: () => request<Dashboard>("/api/caregiver/dashboard"),
  profile: () => request<Profile>("/api/profile"),
  saveProfile: (p: Profile) =>
    request<Profile>("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }),
  today: () => request<Today>("/api/patient/today"),
  startFresh: () => request<{ ok: boolean }>("/api/demo/start-fresh", { method: "POST" }),
  alertHandled: (id: number) => request<{ ok: boolean }>(`/api/alerts/${id}/handled`, { method: "POST" }),
  /** Label photos from the phone camera -> a draft schedule (not saved yet). */
  extract: (photos: File[]) => {
    const form = new FormData();
    photos.slice(0, 6).forEach((p) => form.append("images", p, p.name));
    return request<{ medications: ExtractedMed[] }>("/api/setup/extract", { method: "POST", body: form });
  },
  confirm: (medications: ConfirmMed[]) =>
    request<{ ok: boolean; count: number }>("/api/setup/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medications }),
    }),
};

/** "Today, 8:03 PM" / "Yesterday, 6:42 PM" / "Oct 7, 8:04 PM" from an ISO local time. */
export function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}
