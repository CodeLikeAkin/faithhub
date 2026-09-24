"use client";

// Browser-side calls to /api/admin/*. Same-origin, so the httpOnly session
// cookie rides along; a 401 means the session ended, so go back to sign in.

export async function adminFetch(url, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (res.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("Your session ended. Please sign in again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}
