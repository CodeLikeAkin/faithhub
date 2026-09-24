"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(
        res.status === 429
          ? "Too many attempts. Wait a few minutes, then try again."
          : data.error || "Something went wrong. Try again."
      );
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="admin-password" className="block text-sm font-medium text-brand-ink">
        Password
      </label>
      <input
        id="admin-password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "admin-password-error" : "admin-password-help"}
        className="mt-2 block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-brand-ink transition-shadow focus:border-brand-navy focus:outline-none focus:ring-4 focus:ring-brand-navy/15"
      />
      {error ? (
        <p id="admin-password-error" role="alert" className="mt-2 text-sm font-medium text-[#b42318]">
          {error}
        </p>
      ) : (
        <p id="admin-password-help" className="mt-2 text-sm text-slate-500">
          Only the person who runs FaithHub has this.
        </p>
      )}
      <Button
        variant="dark"
        size="lg"
        type="submit"
        icon={false}
        disabled={busy || password.length === 0}
        className="mt-6 w-full justify-center active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
      >
        {busy ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
