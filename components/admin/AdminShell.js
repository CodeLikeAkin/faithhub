"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ExternalLink,
  Feather,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { Rings } from "@/components/Decor";
import { cn } from "@/lib/utils";

// An item with `soon: true` shows the plan without linking to a dead end.
const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/add", label: "Add sermons", icon: PlusCircle },
  { href: "/admin/processing", label: "Processing", icon: ListChecks },
  { href: "/admin/careful-pass", label: "Careful pass", icon: Feather },
  { href: "/admin/series", label: "Series", icon: Library },
  { href: "/admin/review", label: "Review", icon: ShieldCheck },
];

const isActive = (pathname, href) =>
  href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

function NavItem({ item, pathname, compact = false }) {
  const Icon = item.icon;
  if (item.soon) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          "flex flex-shrink-0 cursor-default items-center gap-3 rounded-2xl text-white/45",
          compact ? "px-3 py-2 text-sm" : "px-4 py-2.5"
        )}
      >
        <Icon size={18} aria-hidden="true" />
        <span className="flex-1 whitespace-nowrap">{item.label}</span>
        <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs font-medium text-white/60">Soon</span>
      </span>
    );
  }
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-shrink-0 items-center gap-3 rounded-2xl font-medium transition-colors",
        compact ? "px-3 py-2 text-sm" : "px-4 py-2.5",
        active ? "bg-white text-brand-navy shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="whitespace-nowrap">{item.label}</span>
    </Link>
  );
}

function useSignOut() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  async function signOut() {
    if (leaving) return;
    setLeaving(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }
  return [signOut, leaving];
}

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const [signOut, leaving] = useSignOut();

  return (
    <div className="min-h-[100dvh] lg:pl-72">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col overflow-hidden bg-brand-deep text-white lg:flex">
        <Rings className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] text-white/[0.05]" />
        <div className="relative flex items-center gap-3 px-7 pb-8 pt-8">
          <Image src="/hofng-logo-white.png" alt="Heritage of Faith" width={208} height={146} className="h-9 w-auto" priority />
          <span className="h-8 w-px bg-white/20" aria-hidden="true" />
          <span className="leading-tight">
            <span className="block text-sm font-bold">FaithHub</span>
            <span className="block text-xs text-brand-mist">Admin</span>
          </span>
        </div>

        <nav aria-label="Admin" className="relative flex-1 space-y-1 px-4">
          {NAV.map((item) => (
            <NavItem key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="relative space-y-1 border-t border-white/10 px-4 py-5">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink size={18} aria-hidden="true" />
            View the live site
          </a>
          <button
            type="button"
            onClick={signOut}
            disabled={leaving}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
          >
            <LogOut size={18} aria-hidden="true" />
            {leaving ? "Signing out" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Top bar (phones and tablets) */}
      <header className="sticky top-0 z-40 bg-brand-deep text-white lg:hidden">
        <div className="flex h-16 items-center gap-3 px-4">
          <Image src="/hofng-logo-white.png" alt="Heritage of Faith" width={208} height={146} className="h-7 w-auto" priority />
          <span className="flex-1 text-sm font-bold">FaithHub Admin</span>
          <button
            type="button"
            onClick={signOut}
            disabled={leaving}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-white/10 active:scale-[0.98] disabled:opacity-60"
          >
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </button>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3">
          {NAV.map((item) => (
            <NavItem key={item.label} item={item} pathname={pathname} compact />
          ))}
        </nav>
      </header>

      <main id="main-content">{children}</main>
    </div>
  );
}
