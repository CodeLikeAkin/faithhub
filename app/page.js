import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  BookOpen,
  BookMarked,
  Quote,
  ArrowRight,
  ArrowUpRight,
  Check,
} from "lucide-react";
import DeclarationOfTheDay from "@/components/DeclarationOfTheDay";

const entryCards = [
  {
    index: "01",
    title: "Ask the Word",
    desc: "One question, answered from across every message — with moments to watch.",
    href: "/ask",
    icon: Sparkles,
  },
  {
    index: "02",
    title: "Faith Declarations",
    desc: "Speak the Word God has actually spoken over your situation.",
    href: "/declarations",
    icon: Quote,
  },
  {
    index: "03",
    title: "Study Series",
    desc: "Ask any series questions — answers grounded in the transcripts.",
    href: "/series",
    icon: BookOpen,
  },
  {
    index: "04",
    title: "The Word",
    desc: "Every scripture Dad opens, mapped across every message.",
    href: "/word",
    icon: BookMarked,
  },
];

const communityPoints = [
  "Answers cited to the exact sermon moment on YouTube",
  "Declarations drawn from years of Rev. Peter's messages",
  "Every Bible verse in every message, mapped — The Word",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* ── Hero ── */}
      <section className="px-3 sm:px-5 pt-3 sm:pt-5">
        <div className="relative mx-auto max-w-[1400px] rounded-[1.75rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col justify-between min-h-[560px] lg:min-h-[78vh]">
          <Image
            src="/church-hero.jpg"
            alt="Rev. Peter Ayo Alabi ministering at a Heritage of Faith service"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[78%_center]"
          />
          {/* Legibility overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-deep/90 via-brand-deep/45 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/60 via-transparent to-brand-deep/20" />

          <div className="relative z-10 px-6 sm:px-10 lg:px-14 pt-28 sm:pt-36 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
              Heritage of Faith Church
            </p>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight">
              Go deeper
              <br />
              in the Word.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/80 leading-relaxed max-w-md">
              Years of Rev. Peter&apos;s messages, made searchable — speak
              God&apos;s Word over your life and study any series in depth.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/declarations"
                className="inline-flex items-center gap-2 bg-white text-brand-navy font-bold text-sm sm:text-base rounded-full px-6 sm:px-7 py-3.5 hover:bg-brand-sky transition-colors"
              >
                Start a declaration
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/series"
                className="inline-flex items-center gap-2 border border-white/40 text-white font-bold text-sm sm:text-base rounded-full px-6 sm:px-7 py-3.5 hover:bg-white/10 transition-colors"
              >
                Browse series
              </Link>
            </div>
          </div>

          {/* Bottom pill bar */}
          <div className="relative z-10 px-4 sm:px-6 pb-4 sm:pb-6 mt-16">
            <div className="flex items-center justify-between gap-4 bg-white/90 backdrop-blur-md rounded-full px-5 sm:px-7 py-3.5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray truncate">
                Grounded in Rev. Peter&apos;s teaching · 2022–2026
              </p>
              <Link
                href="/series"
                className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-brand-navy whitespace-nowrap hover:text-brand-deep"
              >
                Explore the library
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Entry cards ── */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 mt-5 sm:mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {entryCards.map((card) => (
          <Link
            key={card.index}
            href={card.href}
            className="group flex items-start justify-between gap-4 bg-white border border-brand-navy/10 rounded-3xl p-5 sm:p-6 hover:shadow-xl hover:shadow-brand-navy/10 hover:-translate-y-0.5 transition-all"
          >
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-brand-gray uppercase">
                / {card.index} /
              </p>
              <h3 className="mt-1.5 text-lg font-bold text-brand-ink leading-snug group-hover:text-brand-navy transition-colors">
                {card.title}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-brand-gray leading-relaxed">
                {card.desc}
              </p>
              <ArrowRight className="mt-3 w-4 h-4 text-brand-navy group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-brand-sky text-brand-navy flex items-center justify-center flex-shrink-0">
              <card.icon className="w-6 h-6" />
            </div>
          </Link>
        ))}
      </section>

      {/* ── Declaration of the day ── */}
      <DeclarationOfTheDay />

      {/* ── Community ── */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 py-16 sm:py-24">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden">
            <Image
              src="/church-community.jpg"
              alt="Members of the Heritage of Faith family"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-navy">
              Built for the Heritage family
            </p>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-brand-ink leading-tight">
              One library. Every message. Your walk.
            </h2>
            <p className="mt-4 text-brand-gray leading-relaxed max-w-lg">
              FaithHub turns years of teaching into something you can search,
              question, and pray with — free and open, no account needed.
            </p>
            <ul className="mt-7 space-y-4">
              {communityPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 h-6 rounded-full bg-brand-sky text-brand-navy flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-sm sm:text-base text-brand-ink">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-brand-navy/10">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Image
              src="/hofng-logo.png"
              alt="Heritage of Faith"
              width={96}
              height={32}
              className="h-9 w-auto object-contain"
            />
            <p className="text-xs text-brand-gray">
              &copy; {new Date().getFullYear()} Heritage of Faith Church
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-brand-gray">
            <Link href="/declarations" className="hover:text-brand-navy transition-colors">
              Declarations
            </Link>
            <Link href="/series" className="hover:text-brand-navy transition-colors">
              Series Study
            </Link>
            <a
              href="https://hofng.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-brand-navy transition-colors"
            >
              hofng.org
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
