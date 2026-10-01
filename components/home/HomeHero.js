"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const greeting = (h) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

/**
 * Home's welcome: the church photo as a banner inside the app frame. Text
 * sits on the left over the congregation so Rev. Peter, standing on the
 * right of the photo, stays in view.
 */
export default function HomeHero() {
  // Greeting and date depend on the reader's clock, so they fill in after
  // hydration rather than being guessed on the server.
  const [now, setNow] = useState(null);
  useEffect(() => setNow(new Date()), []);

  return (
    <section className="fh-rise relative isolate flex min-h-[29rem] flex-col justify-end overflow-hidden rounded-[1.75rem] bg-brand-deep text-white sm:min-h-[23rem]">
      <Image
        src="/church-hero.jpg"
        alt="Rev. Peter Ayo Alabi ministering to the congregation at a Heritage of Faith service"
        fill
        priority
        sizes="(min-width: 1024px) 70vw, 100vw"
        className="fh-settle -z-20 object-cover object-[82%_30%] sm:object-[62%_38%]"
      />
      {/* Phones: text sits low, so darken from the bottom. Wider: text sits
          left, so darken from the left and leave the preacher clear. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-deep via-brand-deep/80 via-45% to-brand-deep/10 sm:bg-gradient-to-r sm:from-brand-deep/95 sm:via-brand-deep/75 sm:via-35% sm:to-transparent"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 hidden bg-gradient-to-t from-brand-deep/55 to-transparent to-45% sm:block" />

      <div className="max-w-xl px-5 pb-4 pt-8 sm:px-9 sm:pt-9">
        <p className="min-h-[1rem] text-xs font-bold uppercase tracking-[0.18em] text-white/70">
          {now
            ? `${greeting(now.getHours())} · ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`
            : "Heritage of Faith Church"}
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.02] tracking-tight sm:text-4xl">
          Go deeper
          <br />
          in the Word.
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-white/80">
          Years of HOF&apos;s messages, made searchable. Speak God&apos;s Word. Study any series in depth.
        </p>
      </div>

      <div className="mx-3 mb-4 mt-1 flex items-center justify-between gap-3 rounded-full sm:mx-4 sm:mb-4 sm:mt-2 sm:border sm:border-white/20 sm:bg-white/[0.14] sm:py-1.5 sm:pl-5 sm:pr-1.5 sm:backdrop-blur-md">
        <p className="hidden truncate text-xs font-bold uppercase tracking-[0.16em] text-white/75 sm:block">
          Grounded in HOF&apos;s teaching · 2022–2026
        </p>
        <Link
          href="/series"
          className="group ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-brand-navy transition hover:bg-brand-sky"
        >
          Explore the library
          <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
