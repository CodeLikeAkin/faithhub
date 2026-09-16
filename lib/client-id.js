// lib/client-id.js
//
// A lightweight, anonymous per-browser identifier — not tied to any account,
// it just lets the server-side rate limiter (lib/rate-limit.js) tell one
// device apart from another. Without this, everyone on the same church WiFi
// shares one IP address and gets rate-limited as if they were a single
// visitor. Generated once per browser, cached in localStorage, sent as the
// X-Client-Id header on every AI-backed API call.

const STORAGE_KEY = "faithhub_client_id";

export function getClientId() {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // Private browsing / localStorage disabled — request still goes through,
    // it just falls back to IP-only rate limiting for this visitor.
    return null;
  }
}

/** Spread this into a fetch() headers object; empty when no id is available. */
export function clientIdHeader() {
  const id = getClientId();
  return id ? { "X-Client-Id": id } : {};
}
