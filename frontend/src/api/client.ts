import type { components } from "./schema";

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.detail ?? message;
    } catch {
      // keep the status text
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export type Today = components["schemas"]["Today"];
export type MedInfo = components["schemas"]["MedInfo"];
export type DemoClock = components["schemas"]["DemoClockResponse"];
export type DueDose = components["schemas"]["DueDose"];
export type DoseConfirm = components["schemas"]["DoseConfirmResponse"];
export type Ok = components["schemas"]["OkResponse"];
export type CheckinPrompt = components["schemas"]["CheckinPrompt"];
export type CheckinResult = components["schemas"]["CheckinResult"];
export type Profile = components["schemas"]["Profile"];
export type CheckinTextBody = {
  text: string;
};

export const api = {
    submitCheckinAudio: async (recording: Blob): Promise<CheckinResult> => {
  const form = new FormData();
  form.append("audio", recording, "checkin.webm");

  return request<CheckinResult>("/api/checkins", {
    method: "POST",
    body: form,
  });
},
  today: () => request<Today>("/api/patient/today"),
  profile: () => request<Profile>("/api/profile"),
  setLanguage: (language: string) =>
    request<{ language: string }>("/api/patient/language", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    }),
  startFresh: () => request<Ok>("/api/demo/start-fresh", { method: "POST" }),
  medInfo: (medId: string) =>
  request<MedInfo>(`/api/meds/${encodeURIComponent(medId)}/info`),
  demoClock: (time: string) => request<DemoClock>("/api/demo/clock", json({ time })),
  checkinPrompt: () =>
  request<CheckinPrompt>("/api/checkins/prompt"),
  twoWeeksLater: () => request<Ok>("/api/demo/two-weeks-later", { method: "POST" }),
  reset: () => request<Ok>("/api/demo/reset", { method: "POST" }),
  confirmDose: (doseId: number, prompted: boolean) =>
    request<DoseConfirm>(`/api/doses/${doseId}/confirm`, json({ prompted })),
  submitCheckin: (body: CheckinTextBody) =>
  request<CheckinResult>("/api/checkins", json(body)),

caregiverDashboard: () =>
  request<components["schemas"]["Dashboard"]>("/api/caregiver/dashboard"),
};