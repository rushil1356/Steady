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

export type Today = components["schemas"]["Today"];

export const api = {
  today: () => request<Today>("/api/patient/today"),
};