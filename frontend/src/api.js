// Shared authenticated fetch client.
// - Auto-attaches the Bearer token from localStorage when not explicitly provided.
// - On any 401 response: clears the stale token and fires 'auth:expired' so
//   App.jsx can gracefully fall back to the login screen (no crash loops).
export const API_BASE = 'https://sih-city-wide-anpr-gis-surveillance.onrender.com';

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