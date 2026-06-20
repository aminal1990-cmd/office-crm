import { SUPABASE_CONFIG } from "./config.js";

function isConfiguredValue(value, placeholder) {
  return value && value !== placeholder && !String(value).includes("YOUR_");
}

export function isCloudConfigured() {
  return Boolean(
    SUPABASE_CONFIG.enabled &&
    isConfiguredValue(SUPABASE_CONFIG.url, "https://YOUR_PROJECT_ID.supabase.co") &&
    isConfiguredValue(SUPABASE_CONFIG.anonKey, "YOUR_SUPABASE_ANON_KEY")
  );
}

function headers(extra = {}) {
  return {
    apikey: SUPABASE_CONFIG.anonKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function endpoint(query = "") {
  const base = SUPABASE_CONFIG.url.replace(/\/$/, "");
  return `${base}/rest/v1/${SUPABASE_CONFIG.table}${query}`;
}

export async function loadCloudState() {
  if (!isCloudConfigured()) return null;

  const query = `?id=eq.${encodeURIComponent(SUPABASE_CONFIG.stateId)}&select=payload&limit=1`;
  const response = await fetch(endpoint(query), { headers: headers() });
  if (!response.ok) throw new Error("Cloud state load failed");

  const rows = await response.json();
  return rows[0]?.payload || null;
}

export async function saveCloudState(state) {
  if (!isCloudConfigured()) return;

  const response = await fetch(endpoint("?on_conflict=id"), {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      id: SUPABASE_CONFIG.stateId,
      payload: state,
      updated_at: new Date().toISOString()
    })
  });

  if (!response.ok) throw new Error("Cloud state save failed");
}
