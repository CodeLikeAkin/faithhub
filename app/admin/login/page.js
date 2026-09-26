import Image from "next/image";
import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { Rings } from "@/components/Decor";
import LoginForm from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in - FaithHub Admin" };

export default function AdminLoginPage() {
  const configured = adminConfigured();
  if (configured && isAdmin()) redirect("/admin");

  return (
    <main id="main-content" className="flex min-h-[100dvh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-30px_rgba(16,42,78,0.45)] ring-1 ring-brand-navy/[0.06] motion-safe:animate-rise">
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-navy via-brand-deep to-[#0B1F3B] px-8 pb-8 pt-9 text-white">
          <Rings className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 text-white/[0.07]" />
          <Image src="/hofng-logo-white.png" alt="Heritage of Faith" width={208} height={146} className="relative h-10 w-auto" priority />
          <h1 className="relative mt-6 font-display text-3xl font-medium tracking-tight">FaithHub Admin</h1>
          <p className="relative mt-1 text-sm text-brand-mist">Sign in to manage messages, series and study content.</p>
        </div>

        <div className="px-8 py-8">
          {configured ? (
            <LoginForm />
          ) : (
            <div className="rounded-2xl bg-brand-sky p-4 text-sm text-brand-ink" role="status">
              <p className="font-medium">Admin isn&apos;t set up on this server yet.</p>
              {process.env.NODE_ENV !== "production" && (
                <p className="mt-1 text-slate-600">
                  Set ADMIN_PASSWORD (12+ characters) and ADMIN_SESSION_SECRET (32+ characters), then restart.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
