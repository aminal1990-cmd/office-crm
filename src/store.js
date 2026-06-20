import { initialState } from "./data.js";

const STORAGE_KEY = "office-crm-state-v2";
const SESSION_KEY = "office-crm-session-v2";

export function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    saveState(initialState);
    return structuredClone(initialState);
  }

  try {
    return JSON.parse(saved);
  } catch {
    saveState(initialState);
    return structuredClone(initialState);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadSession() {
  const userId = localStorage.getItem(SESSION_KEY);
  return userId || null;
}

export function saveSession(userId) {
  localStorage.setItem(SESSION_KEY, userId);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
