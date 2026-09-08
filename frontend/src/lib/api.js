export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export function getToken() {
  try {
    const raw = localStorage.getItem("creator-agency-auth");
    if (raw) return JSON.parse(raw).token || "";
  } catch {}
  return "";
}

export async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let json = {};
  try {
    json = await res.json();
  } catch {}

  if (!res.ok || (json && json.status === "error")) {
    throw new Error(json.message || `Request failed (${res.status})`);
  }
  return json;
}