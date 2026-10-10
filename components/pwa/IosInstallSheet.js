"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Compass, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { isInAppBrowser } from "@/lib/pwa";

function Step({ icon: Icon, children }) {
  return (
    <li className="flex items-start gap-4">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-brand-sky text-brand-navy">
        <Icon size={19} aria-hidden="true" />
      </span>
      <div className="min-w-0 pt-2 text-base leading-snug text-brand-ink">{children}</div>
    </li>
  );
}

/**
 * How to install on iPhone / iPad. iOS has no install prompt a page can
 * trigger, so this walks through Share → Add to Home Screen. Bottom sheet on
 * phones, centred card on larger screens — the same frame as VerseSheet.
 */
export default function IosInstallSheet({ onClose }) {
  const closeRef = useRef(null);
  const inApp = isInAppBrowser();

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-[1.75rem] bg-white shadow-2xl custom-scrollbar motion-safe:animate-in motion-safe:slide-in-from-bottom-6 motion-safe:fade-in motion-safe:duration-200 sm:rounded-[1.75rem]"
      >
        <div className="flex items-start gap-4 px-6 pt-6">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 flex-shrink-0 rounded-2xl ring-1 ring-brand-navy/10"
          />
          <div className="min-w-0 flex-1 pt-1">
            <h2 id="ios-install-title" className="text-lg font-bold leading-snug text-brand-ink">
              Add FaithHub to your Home Screen
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-brand-gray">
              It opens full screen, like an app, and your saved declarations and studies stay readable offline.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-2 grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-brand-gray transition-colors hover:bg-brand-sky hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <ol className="mt-6 space-y-4 px-6">
          {inApp && (
            <Step icon={Compass}>
              First open this page in <strong>Safari</strong> — this app&rsquo;s own browser can&rsquo;t add it.
            </Step>
          )}
          <Step icon={Share}>
            Tap <strong>Share</strong>.
            <span className="mt-0.5 block text-sm text-brand-gray">On iPhone it may be inside the &bull;&bull;&bull; menu.</span>
          </Step>
          <Step icon={SquarePlus}>
            Choose <strong>Add to Home Screen</strong>.
            <span className="mt-0.5 block text-sm text-brand-gray">Scroll down the list if you don&rsquo;t see it.</span>
          </Step>
          <Step icon={Smartphone}>
            Tap <strong>Add</strong>. FaithHub appears with your other apps.
          </Step>
        </ol>

        <div className="px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-7">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-full bg-brand-navy text-base font-bold text-white transition-colors hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
