"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Compass,
  Eye,
  Flame,
  HandHeart,
  Hourglass,
  Play,
  Ruler,
  ShieldCheck,
  Sprout,
  Target,
  UsersRound,
} from "lucide-react";
import VideoModal from "@/components/VideoModal";
import Button from "@/components/Button";
import { cn } from "@/lib/utils";

const ANCHOR = "7ikShQi33n4";
const ANCHOR_TITLE =
  "Are You a Strong Believer? Immersion Service | Rev Peter Alabi | 3rd May 2026";
const DOER_VIDEO = "55BvIbIvaVQ";
const DOER_TITLE = "40 DOT 2025 Day 39 | Rev Peter Alabi | 30th December 2025";

const moment = (video_id, start_seconds, sermon_title) => ({
  video_id,
  start_seconds,
  sermon_title,
});

const CHAPTERS = [
  { id: "part-one", label: "Part One", title: "Who is a stronger believer", meta: "Five marks" },
  { id: "part-two", label: "Part Two", title: "The five components of enlargement", meta: "Five components" },
  { id: "part-three", label: "Part Three", title: "Process, and the seriousness it asks for", meta: "Process & conviction" },
];

const CHARGE = [
  { term: "The starting point", def: "You must know a stronger believer to raise one.", icon: Compass },
  { term: "The test", def: "Every real vision must be measurable.", icon: Target },
  {
    term: "The charge",
    def: "A mark of faithfulness is the ability to retain knowledge in its purest form. Protect truth.",
    icon: ShieldCheck,
  },
  { term: "The standard", def: "Vision has to be exact.", icon: Ruler },
];

/* ── decoration ──────────────────────────────────────────────────── */

function QuoteGlyph({ className }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 48" fill="currentColor" className={className}>
      <path d="M0 48V28C0 12.5 8 3.2 24 0l3 6.4C17.4 9.4 13 15 13 22h11v26H0Zm37 0V28C37 12.5 45 3.2 61 0l3 6.4C54.4 9.4 50 15 50 22h11v26H37Z" />
    </svg>
  );
}

function Rings({ className }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 400" fill="none" className={className}>
      {[195, 170, 145, 120, 95, 70, 45].map((r) => (
        <circle key={r} cx="200" cy="200" r={r} stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  );
}

function DotGrid({ dark = false, className }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute bg-[length:22px_22px]",
        dark
          ? "bg-[radial-gradient(circle,rgba(255,255,255,0.14)_1px,transparent_1.5px)]"
          : "bg-[radial-gradient(circle,rgba(23,58,104,0.16)_1px,transparent_1.5px)]",
        className
      )}
    />
  );
}

/* Five nodes rising in a fixed order — the marks are given in sequence. */
function InOrder() {
  const pts = [
    [14, 106],
    [57, 83],
    [100, 60],
    [143, 37],
    [186, 14],
  ];
  return (
    <svg viewBox="0 0 200 120" fill="none" className="h-28 w-48 text-brand-navy">
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.5"
        strokeDasharray="4 5"
      />
      {pts.map(([x, y], i) => (
        <circle
          key={x}
          cx={x}
          cy={y}
          r={i === 4 ? 9 : 6}
          fill={i === 4 ? "currentColor" : "#fff"}
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

/* Five overlapping circles — "not a sequence, five things held together". */
function HeldTogether() {
  const centers = [
    [100, 64],
    [134.2, 88.9],
    [121.2, 129.1],
    [78.8, 129.1],
    [65.8, 88.9],
  ];
  return (
    <svg viewBox="0 0 200 200" fill="none" className="h-40 w-40 text-brand-navy">
      {centers.map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="44"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1.25"
        />
      ))}
      <circle cx="100" cy="100" r="5" fill="currentColor" />
    </svg>
  );
}

/* Arcs widening from one point — every process trains you for the next. */
function Widening() {
  return (
    <svg viewBox="0 0 200 120" fill="none" className="h-28 w-48 text-brand-navy">
      {[22, 46, 70].map((r, i) => (
        <path
          key={r}
          d={`M${100 - r} 110A${r} ${r} 0 0 1 ${100 + r} 110`}
          stroke="currentColor"
          strokeOpacity={0.55 - i * 0.15}
          strokeWidth="1.5"
        />
      ))}
      <path
        d="M6 110A94 94 0 0 1 194 110"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.5"
        strokeDasharray="4 5"
      />
      <circle cx="100" cy="110" r="6" fill="currentColor" />
    </svg>
  );
}

/* ── behaviour ───────────────────────────────────────────────────── */

function Reveal({ as: Tag = "div", className, delay = 0, children, ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none",
        shown
          ? "translate-y-0 opacity-100"
          : "translate-y-6 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? Math.min(doc.scrollTop / max, 1) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[60] h-1 origin-left bg-brand-navy"
      style={{ transform: `scaleX(${progress})` }}
    />
  );
}

/* ── shared pieces ───────────────────────────────────────────────── */

function Eyebrow({ tone = "light", className, children }) {
  const dark = tone === "dark";
  return (
    <p
      className={cn(
        "inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em]",
        dark ? "text-white/60" : "text-brand-navy",
        className
      )}
    >
      <span aria-hidden="true" className={cn("h-px w-8", dark ? "bg-white/40" : "bg-brand-navy/40")} />
      {children}
    </p>
  );
}

function Pull({ size = "lg", children }) {
  return (
    <figure className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-sky to-brand-sky/40 py-5 pl-6 pr-12 sm:py-6 sm:pl-8">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-navy to-brand-mist" />
      <QuoteGlyph className="absolute right-4 top-4 h-6 w-8 text-brand-navy/15" />
      <blockquote
        className={cn(
          "font-display italic leading-snug text-brand-ink text-pretty",
          size === "lg" ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"
        )}
      >
        {children}
      </blockquote>
    </figure>
  );
}

function Verse({ children }) {
  return (
    <p className="font-display text-xl italic leading-snug text-brand-navy text-pretty sm:text-2xl">
      {children}
    </p>
  );
}

function Subhead({ children }) {
  return (
    <h4 className="mt-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-brand-navy">
      <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-brand-navy" />
      {children}
    </h4>
  );
}

function Bullet({ children }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rotate-45 bg-brand-navy" />
      <span>{children}</span>
    </li>
  );
}

function WatchButton({ seg, onWatch, children = "Watch this teaching" }) {
  return (
    <button
      type="button"
      onClick={() => onWatch(seg)}
      className="group mt-4 inline-flex w-fit items-center gap-3 rounded-full border border-brand-navy/15 bg-white py-1.5 pl-1.5 pr-5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-navy/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-navy text-white transition-colors group-hover:bg-brand-deep">
        <Play className="h-3.5 w-3.5 translate-x-px fill-current" aria-hidden="true" />
      </span>
      {children}
    </button>
  );
}

function PartHeader({ id, number, label, icon: Icon, title, aside, children }) {
  return (
    <Reveal
      as="header"
      id={id}
      className="relative scroll-mt-32 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16"
    >
      <div>
        <div className="flex items-end gap-4 sm:gap-6">
          <svg
            aria-hidden="true"
            viewBox="0 0 150 110"
            className="h-20 w-auto flex-shrink-0 overflow-visible text-brand-navy sm:h-28"
          >
            <text
              x="0"
              y="100"
              fontSize="128"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              className="font-display"
            >
              {number}
            </text>
          </svg>
          <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-navy px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </span>
        </div>
        <h2 className="mt-6 max-w-3xl font-display text-4xl font-medium leading-[1.08] tracking-tight text-brand-ink text-balance sm:text-5xl">
          {title}
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-brand-ink/70">{children}</p>
      </div>
      {aside && (
        <div aria-hidden="true" className="hidden pb-3 lg:block">
          {aside}
        </div>
      )}
      <div
        aria-hidden="true"
        className="col-span-full mt-10 h-px bg-gradient-to-r from-brand-navy/30 via-brand-navy/10 to-transparent"
      />
    </Reveal>
  );
}

/* One numbered mark: a node on the spine, the teaching in a card. */
function Mark({ number, refs, title, children }) {
  return (
    <Reveal as="article" className="relative grid gap-6 md:grid-cols-[3.5rem_minmax(0,1fr)] md:gap-10">
      <div className="hidden md:block">
        <div className="sticky top-28 grid h-14 w-14 place-items-center rounded-full border-2 border-brand-navy bg-white font-display text-2xl text-brand-navy shadow-[0_0_0_8px_#fff,0_12px_30px_-10px_rgba(23,58,104,0.45)]">
          {number}
        </div>
      </div>

      <div className="relative overflow-clip rounded-[1.75rem] border border-brand-navy/10 bg-white p-6 shadow-[0_30px_60px_-40px_rgba(23,58,104,0.35)] sm:p-10">
        <svg
          aria-hidden="true"
          viewBox="0 0 160 120"
          className="pointer-events-none absolute -right-2 -top-3 h-24 w-32 text-brand-sky sm:h-36 sm:w-48"
        >
          <text x="160" y="108" textAnchor="end" fontSize="140" fill="currentColor" className="font-display">
            {String(number).padStart(2, "0")}
          </text>
        </svg>

        <header className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-navy font-display text-lg text-white md:hidden">
              {number}
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-navy/70">
              Mark {String(number).padStart(2, "0")}
              <span className="text-brand-gray/70"> / 05</span>
            </span>
          </div>
          <h3 className="mt-3 max-w-2xl font-display text-3xl font-medium leading-tight text-brand-ink text-balance sm:text-4xl">
            {title}
          </h3>
        </header>

        <div className="relative mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_12rem] lg:gap-12">
          <div className="flex max-w-2xl flex-col gap-4 leading-relaxed text-brand-ink">{children}</div>

          <aside className="order-first lg:order-none">
            <div className="rounded-2xl bg-brand-sky/60 p-4 lg:sticky lg:top-28 lg:p-5">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-navy">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Scripture
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5 lg:flex-col lg:gap-0 lg:divide-y lg:divide-brand-navy/10">
                {refs.map((r) => (
                  <li
                    key={r}
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-medium tabular-nums text-brand-navy lg:rounded-none lg:bg-transparent lg:px-0 lg:py-2 lg:text-sm"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </Reveal>
  );
}

function Component({ index, icon: Icon, title, children }) {
  return (
    <Reveal className="h-full">
      <article className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-[1.75rem] border border-brand-navy/10 bg-white p-6 shadow-[0_30px_60px_-45px_rgba(23,58,104,0.4)] transition-[box-shadow,border-color,transform] duration-300 hover:-translate-y-1 hover:border-brand-navy/20 hover:shadow-[0_40px_70px_-40px_rgba(23,58,104,0.45)] sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-sky blur-2xl transition-transform duration-500 group-hover:scale-125"
        />
        <div className="relative flex items-start justify-between gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-navy text-white shadow-lg shadow-brand-navy/20">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span aria-hidden="true" className="font-display text-3xl leading-none text-brand-mist">
            {index}
          </span>
        </div>
        <p className="relative mt-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-navy/70">
          Component
        </p>
        <h3 className="relative font-display text-2xl font-medium leading-tight text-brand-ink text-balance sm:text-3xl">
          {title}
        </h3>
        <div className="relative flex flex-col gap-3 text-sm leading-relaxed text-brand-ink sm:text-base">
          {children}
        </div>
      </article>
    </Reveal>
  );
}

function SonshipPoint({ index, heading, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.08]">
      <span aria-hidden="true" className="font-display text-sm tabular-nums text-brand-mist/80">
        {String(index).padStart(2, "0")}
      </span>
      <h4 className="mt-2 text-base font-bold leading-snug text-white">{heading}</h4>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{children}</p>
    </section>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

export default function VisionContent() {
  const [watching, setWatching] = useState(null);

  return (
    <main id="main-content" className="min-h-screen overflow-x-clip bg-white">
      <ReadingProgress />

      {/* ── hero ── */}
      <section className="px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[1.75rem] bg-brand-sky sm:rounded-[2.5rem]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-48 right-[8%] h-[30rem] w-[30rem] rounded-full bg-brand-mist/70 blur-3xl" />
            <DotGrid className="inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_60%)]" />
          </div>

          <div className="relative z-10 grid items-center gap-16 px-6 pb-16 pt-28 sm:px-10 sm:pt-36 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-10 lg:px-16 lg:pb-20 lg:pt-40">
            <div>
              <h1 className="font-display text-5xl font-medium leading-[1.02] tracking-tight text-brand-ink text-balance animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 motion-reduce:animate-none sm:text-6xl lg:text-7xl">
                Raising{" "}
                <em className="relative inline-block font-normal italic text-brand-navy">
                  Stronger
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 220 16"
                    preserveAspectRatio="none"
                    className="absolute -bottom-2 left-0 h-3 w-full text-brand-navy/40 sm:-bottom-3 sm:h-4"
                  >
                    <path
                      d="M3 11C48 4 122 1 217 9"
                      pathLength="1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      className="animate-draw [stroke-dasharray:1] motion-reduce:animate-none"
                    />
                  </svg>
                </em>{" "}
                Believers
              </h1>

              <p className="mt-8 max-w-xl text-lg leading-relaxed text-brand-ink/70 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-150 motion-reduce:animate-none">
                The vision of the house, and what it asks of the people carrying it —
                who a stronger believer is, and what enlargement requires of us.
              </p>

              <nav
                aria-label="Chapters"
                className="mt-10 grid gap-3 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-300 motion-reduce:animate-none sm:grid-cols-3"
              >
                {CHAPTERS.map((c) => (
                  <a
                    key={c.id}
                    href={`#${c.id}`}
                    className="group flex flex-col gap-1 rounded-2xl border border-brand-navy/10 bg-white/70 p-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-brand-navy/25 hover:bg-white hover:shadow-lg hover:shadow-brand-navy/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                  >
                    <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-brand-navy/70">
                      {c.label}
                      <ArrowDown
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="font-display text-lg leading-snug text-brand-ink">{c.title}</span>
                    <span className="mt-auto pt-1 text-xs text-brand-gray">{c.meta}</span>
                  </a>
                ))}
              </nav>
            </div>

            {/* arched portrait */}
            <div className="relative mx-auto w-full max-w-[18rem] animate-in fade-in zoom-in-95 fill-mode-both duration-1000 delay-200 motion-reduce:animate-none sm:max-w-sm lg:max-w-[25rem]">
              <Rings className="absolute left-1/2 top-1/2 w-[170%] max-w-none -translate-x-1/2 -translate-y-1/2 text-brand-navy/[0.08]" />
              <div aria-hidden="true" className="absolute left-1/2 top-1/2 w-[128%] -translate-x-1/2 -translate-y-1/2">
                <svg
                  viewBox="0 0 400 400"
                  fill="none"
                  className="w-full animate-[spin_90s_linear_infinite] text-brand-navy/25 motion-reduce:animate-none"
                >
                  <circle cx="200" cy="200" r="198" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 10" strokeLinecap="round" />
                </svg>
              </div>

              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-3 rounded-b-[2.5rem] rounded-tl-[50%_40%] rounded-tr-[50%_40%] border border-brand-navy/20"
                />
                <div className="relative aspect-[4/5] overflow-hidden rounded-b-[2rem] rounded-tl-[50%_40%] rounded-tr-[50%_40%] border-[6px] border-white bg-brand-deep shadow-2xl shadow-brand-navy/25">
                  <Image
                    src="/peter-alabi-vision.jpg"
                    alt="Rev. Peter Ayo Alabi teaching at Heritage of Faith Church"
                    fill
                    priority
                    sizes="(min-width: 1024px) 25rem, (min-width: 640px) 24rem, 18rem"
                    className="object-cover object-[60%_30%]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/35 via-transparent to-transparent" />
                </div>

                <div className="absolute -right-10 top-[54%] hidden max-w-[12rem] rotate-3 rounded-2xl bg-brand-deep px-4 py-3 text-white shadow-xl shadow-brand-navy/30 sm:block">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-mist">Daniel 11:32</p>
                  <p className="mt-1 font-display text-base italic leading-snug">
                    …shall be strong, and do exploits.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setWatching(moment(ANCHOR, 7286, ANCHOR_TITLE))}
                  className="group absolute -bottom-6 -left-3 flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-white/95 py-2.5 pl-2.5 pr-5 text-left shadow-xl shadow-brand-navy/15 backdrop-blur transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 sm:-left-10"
                >
                  <span className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-brand-navy text-white">
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-brand-navy/40 motion-reduce:animate-none"
                    />
                    <Play className="relative h-4 w-4 translate-x-px fill-current" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-bold text-brand-ink">Watch the vision</span>
                    <span className="text-xs text-brand-gray">Immersion Service · 3 May 2026</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── the vision statement ── */}
      <section className="px-3 pt-3 sm:px-5 sm:pt-5">
        <Reveal className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[1.75rem] bg-brand-deep sm:rounded-[2.5rem]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-navy blur-3xl" />
            <div className="absolute -bottom-48 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand-mist/[0.12] blur-3xl" />
            <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_55%)]" />
            <Rings className="absolute -bottom-56 -left-56 h-[36rem] w-[36rem] text-white/[0.06]" />
            <QuoteGlyph className="absolute right-8 top-10 h-32 w-44 text-white/[0.04] sm:right-16 sm:h-48 sm:w-64" />
          </div>

          <div className="relative mx-auto max-w-6xl px-6 py-16 sm:px-12 sm:py-24">
            <Eyebrow tone="dark">The vision statement</Eyebrow>

            <blockquote className="mt-8 max-w-5xl font-display text-3xl font-normal leading-[1.2] tracking-tight text-white text-pretty sm:text-4xl lg:text-5xl">
              The vision of our ministry is{" "}
              <span className="bg-[linear-gradient(transparent_62%,rgba(198,218,238,0.22)_62%)] text-brand-mist [box-decoration-break:clone]">
                raising stronger believers
              </span>
              . And we&apos;re not just mouthing words like motivational speaking. No.
              That&apos;s a vision. That&apos;s an instruction God gave us. We&apos;re
              raising stronger believers.
            </blockquote>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="flex items-center gap-3">
                <span className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white/25 bg-brand-navy">
                  <span className="absolute left-[-108%] top-[-10%] h-[260%] w-[260%]">
                    <Image
                      src="/peter-alabi-vision.jpg"
                      alt=""
                      fill
                      sizes="128px"
                      className="object-cover object-top"
                    />
                  </span>
                </span>
                <div>
                  <p className="text-sm font-bold text-white">Rev. Peter Ayo Alabi</p>
                  <p className="text-xs text-white/55">Immersion Service · 3 May 2026</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWatching(moment(ANCHOR, 7286, ANCHOR_TITLE))}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-deep"
              >
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                Watch this moment
              </button>
            </div>

            {/* operating charge */}
            <dl className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CHARGE.map(({ term, def, icon: Icon }, i) => (
                <div
                  key={term}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.08] sm:p-6"
                >
                  <dt className="flex flex-col gap-5">
                    <span aria-hidden="true" className="flex items-center justify-between">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-brand-mist">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="font-display text-sm tabular-nums text-white/35">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-mist/80">
                      {term}
                    </span>
                  </dt>
                  <dd className="font-display text-xl leading-snug text-white text-pretty">{def}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </section>

      {/* ══ PART ONE ══ */}
      <section className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 top-80 bg-gradient-to-b from-white via-brand-sky/70 to-white"
        />
        <DotGrid className="left-0 top-96 h-[40rem] w-[40rem] [mask-image:radial-gradient(circle_at_left,black,transparent_65%)]" />

        <div className="relative mx-auto max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
          <PartHeader
            id="part-one"
            number="01"
            label="Part One"
            icon={BookOpen}
            title="Who is a stronger believer"
            aside={<InOrder />}
          >
            Five marks, given in a fixed order. They answer a diagnostic question —
            why do problems persist so long in the lives of Christians?
          </PartHeader>

          <div className="relative mt-14 flex flex-col gap-8 sm:gap-10">
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-7 top-0 hidden w-px bg-gradient-to-b from-transparent via-brand-navy/25 to-transparent md:block"
            />

            <Mark
              number={1}
              title="One who knows God"
              refs={[
                "Dan 11:32",
                "2 Thess 1:8",
                "Rom 5:6",
                "1 Tim 2:4",
                "1 Cor 6:17",
                "John 17:21–23",
                "Gal 4:9",
                "Col 1:10",
                "Phil 3:10",
                "John 4:24",
              ]}
            >
              <Verse>
                The people that do know their God shall be strong, and do exploits.
              </Verse>
              <Pull>
                There is strength in knowing God. You can&apos;t know God and not be
                strong.
              </Pull>
              <p>
                Knowing God carries two meanings, and the order matters.{" "}
                <strong className="font-bold">Primarily it means salvation.</strong>{" "}
                To know God is to be intimate with Him, to be in union with Him. Paul
                equates being <em>without strength</em> with being <em>ungodly</em>.
                You cannot be saved without the knowledge of the truth; you are not
                saved until you are in union with the truth.
              </p>
              <p>
                The oneness the Lord prayed for in John 17 is not denominational
                unity. It is union in Christ. You know God, and you are known of God —
                and that is what it means to be saved.
              </p>
              <p>
                <strong className="font-bold">
                  Secondarily it means growing in the knowledge of His word.
                </strong>{" "}
                Paul was still pressing to know Him thirty years in.
              </p>

              <Subhead>Relate to Him by truth</Subhead>
              <p>
                God is Spirit, and those who worship Him must worship in spirit and in
                truth. We relate to God on the basis of truth, not on the basis of
                emotion.
              </p>

              <Subhead>Thanksgiving</Subhead>
              <p>
                Never call a good thing a coincidence. Gratitude is a form of humility
                — a proud man does not love to acknowledge that somebody else is
                responsible for what he has. And gratitude for what He did before
                makes it easier to believe what He is saying now.
              </p>

              <Subhead>Tradition</Subhead>
              <p>
                We cannot know God through tradition. Consciously discard information
                that negates God&apos;s word. Anything not instructed or inspired by
                the Holy Ghost is a lifeless practice.
              </p>

              <WatchButton seg={moment(ANCHOR, 2108, ANCHOR_TITLE)} onWatch={setWatching} />
            </Mark>

            <Mark
              number={2}
              title="One who knows their identity in Christ"
              refs={[
                "Rev 1:5–6",
                "Titus 3:5",
                "2 Cor 5:21",
                "Col 3:3",
                "1 John 5:4",
                "1 Tim 2:5",
                "Eph 4:14",
                "Gal 4:19",
              ]}
            >
              <Pull>
                The identity God has given you in Christ is sonship — the Greek word{" "}
                <em>huios</em>, it means offspring.
              </Pull>
              <p className="text-lg">
                He has made us kings and priests. Your identity must always be rooted
                in what He has made you — never in what you have achieved.
                Righteousness is an identity received, not a standard reached.
              </p>
              <p>
                Salvation in itself brings an identity upon the one who receives it.
                At salvation you lost your identity to God&apos;s divinity.
              </p>
              <Pull>
                It is more important for you to know who you are in Christ than many
                funny things a lot of people want to know today.
              </Pull>

              <Subhead>The four deaths</Subhead>
              <p>
                The believer is dead to the world, dead to sin, dead to ancestry, and
                dead to Satan. You are dead, and your life is hid with Christ in God.
              </p>

              <Subhead>The mediator</Subhead>
              <p>
                The presence of a prophet does not mean distance between you and God.
                The mediatorship of Christ was done and finished at salvation. We do
                not have a relationship with God where every time we need to talk to
                God we must first knock on Jesus. He brought us to the Father once and
                for all. He is not a go-between.
              </p>

              <Subhead>Discipline in the prophetic</Subhead>
              <ul className="flex flex-col gap-2">
                <Bullet>Never be pressurized under the anointing.</Bullet>
                <Bullet>
                  Don&apos;t try to see by the Spirit. If there is something to see, the
                  Spirit will show you.
                </Bullet>
                <Bullet>A prophet must not be a blab-mouth.</Bullet>
                <Bullet>
                  Be satisfied to do the things of the Spirit without receiving
                  recognition.
                </Bullet>
                <Bullet>
                  Revelation comes for three things —{" "}
                  <strong className="font-bold">prayer</strong>,{" "}
                  <strong className="font-bold">teaching</strong>,{" "}
                  <strong className="font-bold">correction</strong>.
                </Bullet>
              </ul>
              <p>If a false prophet can sway you, you are not a strong Christian.</p>

              <Subhead>Identity inside the local church</Subhead>
              <p>
                Every church must decide what they will be known for. It is what you
                do that you will be known for. Don&apos;t become an unidentifiable
                specie — not even within the local church.
              </p>

              <Subhead>The four stabilities</Subhead>
              <p>
                That we be no more children, tossed to and fro. Stability is proved in
                four places: <strong className="font-bold">convictions</strong>,{" "}
                <strong className="font-bold">practices</strong>,{" "}
                <strong className="font-bold">relationships</strong>, and{" "}
                <strong className="font-bold">service</strong>. Be consistent in your
                commitment to relationships — can you keep friendships? And never be
                too big to serve.
              </p>

              <WatchButton seg={moment(ANCHOR, 4218, ANCHOR_TITLE)} onWatch={setWatching} />
            </Mark>

            <Mark
              number={3}
              title="One who knows their rights and privileges"
              refs={["James 1:5–6", "Acts 3:6", "2 Cor 5:17"]}
            >
              <Pull>The Bible is our constitution.</Pull>
              <p>
                In a room full of professionals, only the lawyers had ever read the
                Nigerian constitution — the document that governs every one of them.
                It is the same way many Christians think the truth of the word is only
                for pastors. It is not. It governs you, and you are entitled to know
                it.
              </p>
              <Pull>
                When you know your rights and privileges, the devil cannot cheat you.
              </Pull>

              <Subhead>Answered prayer is a right</Subhead>
              <p>
                Getting answered prayers is a right. Never ask God for anything on the
                basis of your performance. But do not vacillate between faith and
                unbelief — a man who wavers should not think he will receive anything
                of the Lord.
              </p>

              <Subhead>The name of Jesus</Subhead>
              <p>
                <em>Silver and gold have I none, but such as I have give I thee.</em>{" "}
                Peter&apos;s consciousness of what he carried was his spending power.
              </p>
              <p>We all have the same rights and privileges as new creation.</p>

              <WatchButton seg={moment(ANCHOR, 4989, ANCHOR_TITLE)} onWatch={setWatching} />
            </Mark>

            <Mark
              number={4}
              title="One who knows their God-given assignment"
              refs={["Dan 11:32"]}
            >
              <Pull>
                Number four is the one who knows his assignment — one who knows their{" "}
                <em>God-given</em> assignment, not just assignment. I&apos;m
                delivering to you as I receive from the Lord.
              </Pull>

              <Subhead>Why this order</Subhead>
              <p>He asked the Lord why the marks come in this particular order.</p>
              <Pull>
                The first four are things you must act on. You mustn&apos;t just know
                them. Knowing God must be evident in your actions. Knowing who you are
                in Christ must be evident in your actions. Knowing your rights and
                privileges must be evidenced in your actions. And then knowing your
                assignment must be evidenced in your actions.
              </Pull>

              <Subhead>The evidence of it</Subhead>
              <p>
                <em>
                  The people that do know their God shall be strong, and do exploits.
                </em>{" "}
                People who know God do bold and big things. A person who knows God
                will do something bigger than himself.
              </p>

              <WatchButton seg={moment(ANCHOR, 10786, ANCHOR_TITLE)} onWatch={setWatching} />
            </Mark>

            <Mark
              number={5}
              title="One who is a doer of the word"
              refs={["2 Cor 5:15", "James 1:22–25"]}
            >
              <p className="text-lg">
                He died for all, that they which live should not henceforth live unto
                themselves, but unto him which died for them. We must live for the One
                who died for us.
              </p>
              <Pull>Don&apos;t know so much and do so little.</Pull>
              <p>
                The word works for the one who works it. A doer is not a forgetful
                hearer — he does not look into the perfect law of liberty and walk
                away having forgotten what manner of man he was. He adjusts himself to
                the word rather than adjusting the word to himself.
              </p>

              <Subhead>What this asks of the house</Subhead>
              <p>
                A church is not an entertainment centre. A church is a place of
                edification. Lay your own agenda by the side and carry His agenda on
                your head.
              </p>

              <WatchButton seg={moment(DOER_VIDEO, 9559, DOER_TITLE)} onWatch={setWatching} />
            </Mark>
          </div>
        </div>
      </section>

      {/* ══ PART TWO ══ */}
      <section className="relative">
        <DotGrid className="right-0 top-24 h-[36rem] w-[36rem] [mask-image:radial-gradient(circle_at_right,black,transparent_65%)]" />

        <div className="relative mx-auto max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
          <PartHeader
            id="part-two"
            number="02"
            label="Part Two"
            icon={Sprout}
            title="The five components of enlargement"
            aside={<HeldTogether />}
          >
            Not a sequence — five things held together. Enlargement is what the
            vision requires of the ones carrying it.
          </PartHeader>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <Component index="01" icon={Eye} title="Embody the vision of the Church">
              <Pull size="sm">
                I&apos;ve joined myself to this vision. I don&apos;t have my own
                vision. The vision of the house is my vision.
                <span className="mt-3 block font-sans text-xs font-bold uppercase not-italic tracking-[0.12em] text-brand-gray">
                  Pastor Funlola Alabi
                </span>
              </Pull>
              <p>
                When the set man says <em>I have a vision</em>, it is the vision of
                the Lord — he is only a custodian of it. Embodying it means it stops
                being his and becomes yours.
              </p>
              <p>
                Writing makes an exact man. Show honour for the word of God by the
                way you receive it and by the way you store it.
              </p>
              <p>
                <strong className="font-bold">The vision, concretely:</strong>{" "}
                planting churches of 200 to 250 in size — a thousand of them.
              </p>
              <p>
                Paul did not say commit it to <em>able</em> men. He said commit it to{" "}
                <em>faithful</em> men. Talent is plenty. Talent is ubiquitous.
              </p>
            </Component>

            <Component index="02" icon={Sprout} title="Take your spiritual growth more seriously">
              <Pull size="sm">
                Spiritual growth is not the growth of your spirit man. It&apos;s the
                growing influence of your reborn spirit over your soul.
              </Pull>
              <p>
                Said another way: the increasing influence of the truth of God&apos;s
                word on your mind.
              </p>
              <p>
                One cold snack on a Sunday, once a week, tells you clearly where your
                allegiance lies. You will not grow that way.
              </p>
              <p>
                Your spiritual growth is first of all for your own benefit. But as we
                mature, more is expected of us — as you grow in the things of God you
                are better equipped to handle situations.
              </p>
            </Component>

            <Component index="03" icon={HandHeart} title="Generosity">
              <Pull size="sm">
                Be generous without expecting to collect something from the person.
                Expect returns from God, not from the people you give to.
              </Pull>
              <p>
                The ultimate benefit of our giving is not just the harvest. Beyond the
                harvest is who we become in the process.
              </p>
              <p>
                You should naturally desire to be generous towards the things of God.
              </p>
              <p>And to have an entrepreneurial mind requires a generous mind.</p>
            </Component>

            <Component index="04" icon={Flame} title="Practice extra commitment">
              <Pull size="sm">
                You don&apos;t grow big to manage well. You manage well to grow big.
              </Pull>
              <p>
                Excel in your commitments. When you are productive in the house of God
                it is not a matter of promotion — it is a matter of growth. God can now
                entrust more into your hands.
              </p>
              <p>
                People without character are dangerous people. The most gifted are not
                necessarily the most promising.
              </p>
              <p>
                The counterweight: serve out of love, not to earn a blessing — and
                guard against over-committing yourself into weariness. Never too big
                to serve.
              </p>
            </Component>
          </div>

          {/* component five — the feature panel */}
          <Reveal className="mt-5">
            <article className="relative overflow-hidden rounded-[2rem] bg-brand-deep p-6 text-white sm:p-10 lg:p-14">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-brand-navy blur-3xl" />
                <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_50%)]" />
                <Rings className="absolute -bottom-64 -right-64 h-[40rem] w-[40rem] text-white/[0.06]" />
              </div>

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-navy shadow-lg shadow-black/20">
                    <UsersRound className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span aria-hidden="true" className="font-display text-3xl leading-none text-white/30">
                    05
                  </span>
                </div>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-white/60">
                  Component · Anchor text 2 Cor 1:24
                </p>
                <h3 className="mt-3 font-display text-3xl font-medium leading-tight text-white text-balance sm:text-5xl">
                  Be rooted in sonship
                </h3>
                <p className="mt-5 max-w-2xl font-display text-xl italic leading-snug text-brand-mist text-pretty sm:text-2xl">
                  The local church is not built upon the talent of a few. It is built
                  upon the sacrifices of many.
                </p>

                <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <SonshipPoint index={1} heading="It begins with making yourself known">
                    People come and submit and say{" "}
                    <em>the Lord led me to you to be a son</em>. By that statement you
                    made known your intention for coming close — but that does not mean
                    you have arrived.
                  </SonshipPoint>

                  <SonshipPoint index={2} heading="You grow from a spot in a shepherd's heart">
                    God is the One who puts the care of His flock in the heart of the
                    shepherd. When you receive the labour of ministry, you are becoming
                    a son.
                  </SonshipPoint>

                  <SonshipPoint index={3} heading="Not an organization — an organism">
                    The church is a living organism, not an organization. Don&apos;t be
                    a professional member. Be a son. We are not saving men unto
                    ourselves; we are saving men unto the Lord and planting them in His
                    house.
                  </SonshipPoint>

                  <SonshipPoint index={4} heading="It means allowing accountability">
                    Accountability is not bondage. It is safety. A life without
                    accountability is like a car without brakes — it doesn&apos;t stop
                    movement, it controls movement. People who don&apos;t want to be
                    accountable to an anointing can&apos;t get the best of that
                    anointing.
                  </SonshipPoint>

                  <SonshipPoint index={5} heading="Errands are a characteristic of it">
                    One of the major characteristics of sonship is errands. And sonship
                    is not a father-Christmas relationship.
                  </SonshipPoint>

                  <SonshipPoint index={6} heading="Recommendation">
                    Your pastor must be able to recommend you.
                  </SonshipPoint>

                  <SonshipPoint index={7} heading="No man sponsors a destiny">
                    No man is a helper of your destiny. Nobody can sponsor your destiny
                    — only God can afford it. If man sponsors you, you can be stranded;
                    he can run out of funds, he can change his mind. God doesn&apos;t
                    need your father&apos;s money to sponsor your calling.
                  </SonshipPoint>

                  <SonshipPoint index={8} heading="Let God raise the ones He wants">
                    Man is God&apos;s method — but not always. Don&apos;t pick them. God
                    reduced Gideon&apos;s army rather than accept the men Gideon would
                    have chosen. God does not consult men before choosing men.
                  </SonshipPoint>

                  <SonshipPoint index={9} heading="Produce with your own faith">
                    You cannot live on what your father&apos;s faith produced. Use it as
                    leverage, but be circumspect — you cannot live your Christian life
                    with another man&apos;s faith.
                  </SonshipPoint>

                  <SonshipPoint index={10} heading="Faith, not pocket">
                    Put your children in the school your faith can afford, not the
                    school your salary can afford. The matter of your children&apos;s
                    education is a matter of faith, not of your pocket. You must
                    stretch.
                  </SonshipPoint>

                  <SonshipPoint index={11} heading="Money and preaching stay separate">
                    Anything you do for the Lord must never be for money. Otherwise you
                    will never preach what God wants — you will preach what will
                    motivate more money to come.
                  </SonshipPoint>

                  <SonshipPoint index={12} heading="Handle access well">
                    A son learns how to handle access. Be sensitive to the person who
                    holds the key to the door. Don&apos;t be quick to ask for favours,
                    and never try to figure out how a person should use what belongs to
                    them. Bad manners brings disfavour; a well-fathered person is set up
                    for favour.
                  </SonshipPoint>
                </div>
              </div>
            </article>
          </Reveal>
        </div>
      </section>

      {/* ══ PART THREE ══ */}
      <section className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 top-72 bg-gradient-to-b from-white via-brand-sky/60 to-white"
        />

        <div className="relative mx-auto max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
          <PartHeader
            id="part-three"
            number="03"
            label="Part Three"
            icon={Hourglass}
            title="Process, and the seriousness it asks for"
            aside={<Widening />}
          >
            A church that will not wait for people to grow will wail when untrained
            people destroy it.
          </PartHeader>

          <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <figure className="relative overflow-hidden rounded-[2rem] border border-brand-navy/10 bg-white p-8 shadow-[0_30px_60px_-40px_rgba(23,58,104,0.35)] sm:p-10">
                <Rings className="absolute -bottom-28 -right-28 h-80 w-80 text-brand-navy/[0.07]" />
                <QuoteGlyph className="relative h-9 w-12 text-brand-navy" />
                <blockquote className="relative mt-6 font-display text-3xl leading-tight tracking-tight text-brand-ink text-balance sm:text-4xl">
                  The urgency of God&apos;s word doesn&apos;t call for hastiness. It
                  calls for <em className="text-brand-navy">seriousness</em>.
                </blockquote>
              </figure>
            </Reveal>

            <Reveal className="flex max-w-2xl flex-col gap-4 leading-relaxed text-brand-ink">
              <p className="text-lg">
                Hastiness is not proof of love — many times it is proof of anxiety.{" "}
                <em>He that believeth shall not make haste.</em> When God wants to do
                something urgent, He does not use a hasty person. He uses a serious
                person.
              </p>
              <p>
                Every process of God is training you for something else. Training puts
                substance in you, and training never ends — the anointed must be
                apprenticed. Let patience have her perfect work, that you may be
                perfect and entire, wanting nothing.
              </p>

              <Subhead>On convictions</Subhead>
              <p>
                Conviction is whatever your heart takes seriously — and there must be a
                commitment to that conviction. If you are not deliberate about
                strengthening your convictions, you will begin to lose them. Pray to be
                strengthened with might by His Spirit in the inner man.
              </p>

              <Subhead>The bearing of it</Subhead>
              <p>
                We must live very godly and content lives. Godliness with contentment
                is great gain. And the Holy Ghost will lead us by giving us structures
                and also by spontaneous instruction — and the two must not be at
                variance with each other.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── finale ── */}
      <section className="px-3 pt-24 sm:px-5 sm:pt-32">
        <Reveal className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[1.75rem] bg-brand-deep px-6 py-20 text-center sm:rounded-[2.5rem] sm:px-12 sm:py-28">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[30rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-navy blur-3xl" />
            <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_60%)]" />
            <Rings className="absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 text-white/[0.05]" />
          </div>

          <div className="relative">
            <QuoteGlyph className="mx-auto h-10 w-14 text-brand-mist" />
            <blockquote className="mx-auto mt-8 max-w-4xl font-display text-4xl font-normal leading-[1.1] tracking-tight text-white text-balance sm:text-6xl">
              It is really Jesus that we are following.
            </blockquote>
            <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-white/55">
              Rev. Peter Ayo Alabi
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button href="/ask" variant="light">
                Ask the Word
              </Button>
              <Button href="#main-content" variant="outline" icon={false}>
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
                Back to the top
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── colophon ── */}
      <p className="mx-auto max-w-2xl px-6 pb-16 pt-10 text-center text-xs leading-relaxed text-brand-gray">
        Heritage of Faith Church, Lagos · prepared for stewards and workers. Teaching
        of Rev. Peter Ayo Alabi except where otherwise attributed. Quotations are
        transcribed from recorded services — verify wording against the linked moment
        before reproducing in print.
      </p>

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </main>
  );
}
