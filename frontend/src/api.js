// Shared authenticated fetch client.
// - Auto-attaches the Bearer token from localStorage when not explicitly provided.
// - On any 401 response: clears the stale token and fires 'auth:expired' so
//   App.jsx can gracefully fall back to the login screen (no crash loops).
// Use the Vite proxy in development and allow deployments to provide a backend URL.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function getStoredToken() {
  try { return localStorage.getItem('police_token') || ''; } catch { return ''; }
}

export function clearStoredToken() {
  try { localStorage.removeItem('police_token'); } catch { /* ignore */ }
  window.dispatchEvent(new Event('auth:expired'));
}

export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    // exp is in seconds; allow 30s clock skew
    return payload.exp ? payload.exp * 1000 < Date.now() - 30000 : false;
  } catch { return true; }
}

export async function parseJsonResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();

  if (!raw.trim()) return {};

  if (!contentType.includes('application/json')) {
    return { detail: raw.trim().slice(0, 300) };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { detail: 'The server returned an invalid JSON response.' };
  }
}

export async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!headers.Authorization) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearStoredToken();
  }
  return res;
}
