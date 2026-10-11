import type { DueDose } from "../api/client";

const KEY = "steady.due";

export function saveDue(due: DueDose[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(due));
  } catch {
    // storage unavailable
  }
}

export function loadDue(): DueDose[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function clearDue() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // storage unavailable
  }
}