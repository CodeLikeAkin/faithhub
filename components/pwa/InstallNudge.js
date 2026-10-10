"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { installApp, nudgeDue, quietNudge } from "@/lib/pwa";
import { useInstallKind } from "@/lib/useInstall";

/**
 * Home only: a small card offering to install the app, a moment after the
 * page settles. Once answered either way it stays away for 30 days; the
 * sidebar's "Install app" is always there. It floats (portalled to <body>)
 * rather than sitting in the page, so Home's layout never moves for it.
 */
export default function InstallNudge() {
  const kind = useInstallKind();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!kind || !nudgeDue()) return;
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, [kind]);

  if (!show || !kind) return null;

  const done = () => {
    quietNudge();
    setShow(false);
  };

  return createPortal(
    <aside
      aria-label="Install FaithHub"
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-sm rounded-[1.25rem] bg-white p-4 shadow-lift ring-1 ring-brand-navy/10 motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:fade-in motion-safe:duration-300 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-full"
    >
      <div className="flex items-start gap-3">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 flex-shrink-0 rounded-xl ring-1 ring-brand-navy/10"
        />
        <div className="min-w-0">
          <p className="text-base font-bold leading-snug text-brand-ink">Put FaithHub on your home screen</p>
          <p className="mt-1 text-sm leading-relaxed text-brand-gray">
            It opens full screen, like an app, and your saved declarations work offline.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={done}
          className="h-10 rounded-full px-4 text-sm font-medium text-brand-gray transition-colors hover:bg-brand-sky hover:text-brand-navy"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => {
            done();
            installApp();
          }}
          className="h-10 rounded-full bg-brand-navy px-5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          {kind === "ios" ? "Show me how" : "Install"}
        </button>
      </div>
    </aside>,
    document.body
  );
}
