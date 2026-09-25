import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bug,
  Flame,
  HeartHandshake,
  Info,
  Lightbulb,
  PlayCircle,
  ScrollText,
  SearchX,
  Sparkles,
} from "lucide-react";
import { DotGrid, Rings } from "@/components/Decor";
import FeedbackForm from "./FeedbackForm";

export const metadata = {
  title: "About & Feedback — FaithHub",
  description:
    "What FaithHub is, how it works, and where to send feedback. Built on the preaching of Heritage of Faith Church, Lagos.",
};

// The corpus numbers are live, but they only move when the pipeline adds a
// batch of messages — once a day is plenty, and it keeps this page static
// between rebuilds instead of hitting Postgres on every visit.
export const revalidate = 86400;

const YOUTUBE_CHANNEL = "https://www.youtube.com/channel/UCV2xi_w10k6ewdPVxDP6uCQ";

// Real counts, straight from the tables the tools read. Returns null on any
// failure (the free-tier project auto-pauses) so the page simply drops the
// band rather than showing zeros or a stale guess.
async function getCorpusStats() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || ""
    );
    const count = async (table) => {
      const { count, error } = await sb.from(table).select("id", { count: "exact", head: true });
      if (error) throw error;
      return count;
    };
    const [messages, series, declarations, scriptures, earliest] = await Promise.all([
      count("sermons"),
      count("series"),
      count("declarations"),
      count("sermon_scriptures"),
      sb
        .from("sermons")
        .select("sermon_date")
        .not("sermon_date", "is", null)
        .order("sermon_date", { ascending: true })
        .limit(1)
        .single(),
    ]);
    return {
      messages,
      series,
      declarations,
      scriptures,
      since: earliest.data?.sermon_date?.slice(0, 4) || null,
    };
  } catch (err) {
    console.error("[about] corpus stats unavailable:", err?.message || err);
    return null;
  }
}

const fmt = (n) => Number(n).toLocaleString("en-US");

const TOOLS = [
  {
    href: "/ask",
    icon: Sparkles,
    name: "Ask the Word",
    blurb:
      "Ask a question and get an answer drawn from the messages, with each answer citing the sermon and the minute.",
  },
  {
    href: "/series",
    icon: BookOpen,
    name: "Series Study",
    blurb:
      "Study a whole series with its notes, the scriptures opened in it, and a companion you can ask questions as you read.",
  },
  {
    href: "/declarations",
    icon: Flame,
    name: "Declarations",
    blurb:
      "Declarations taken from the messages and sorted by topic: faith, identity, healing, finances and more. Each one links to the moment it was spoken.",
  },
  {
    href: "/word",
    icon: ScrollText,
    name: "The Word",
    blurb:
      "Every Bible verse referenced in the messages, mapped book by book. Pick a passage to see where it was taught and watch that moment.",
  },
];

const METHOD = [
  {
    title: "Transcribed in full",
    body: "FaithHub transcribes each service on the Heritage of Faith YouTube channel, then splits the transcript into short passages that can be searched one by one.",
  },
  {
    title: "Indexed by what was said",
    body: "Each Bible verse, declaration and word study is recorded against the message and minute it came from.",
  },
  {
    title: "Cited to the moment",
    body: "Each answer names the messages behind it and links to the moment on YouTube, so you can hear it yourself.",
  },
];

const SEND = [
  { icon: SearchX, text: "An answer that missed the point, or quoted something out of context" },
  { icon: Lightbulb, text: "A series, message or feature you wish were here" },
  { icon: Bug, text: "Anything broken, slow or confusing. Say which page" },
  { icon: HeartHandshake, text: "A testimony of how studying here has helped you" },
];

/* ── hero still life ──────────────────────────────────────────────────
 * Three pieces of the real product, set like objects on a desk: a cited
 * answer, the verse it rests on, and a declaration. Every word is genuine —
 * the answer quotes the Immersion Service the Vision page is built on (same
 * 35:08 moment), the declaration is a real row from Pastor Funlola Alabi's
 * July 2024 message. Illustrative, so it's hidden from assistive tech; the
 * headline beside it carries the meaning.
 */
function HeroStillLife() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-[34rem] w-full max-w-[30rem] select-none sm:h-[32rem] lg:mx-0 lg:ml-auto">
      <Rings className="absolute left-1/2 top-1/2 w-[150%] max-w-none -translate-x-1/2 -translate-y-1/2 text-white/[0.07]" />

      {/* declaration — back, tilted */}
      <div className="absolute right-0 top-0 w-[78%] rotate-[4deg] animate-in fade-in slide-in-from-bottom-6 fill-mode-both duration-1000 delay-300 motion-reduce:animate-none">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d4b85] to-brand-navy p-6 shadow-2xl shadow-black/30 ring-1 ring-white/10">
          <DotGrid dark className="inset-0 opacity-60 [mask-image:linear-gradient(to_bottom_left,black,transparent_70%)]" />
          <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/55">
            <Flame className="h-3.5 w-3.5" />
            Declaration
          </p>
          <p className="relative mt-3 font-display text-base leading-snug text-white sm:text-lg">
            &ldquo;The heritage of faith gets stronger with me; the heritage of strength
            and consistency gets stronger with me, in the name of Jesus.&rdquo;
          </p>
          <p className="relative mt-4 text-xs text-white/50">
            Pastor Funlola Alabi · Apostolic Foundations 3
          </p>
        </div>
      </div>

      {/* cited answer — front */}
      <div className="absolute left-0 top-[17.5rem] w-[88%] -rotate-[2deg] animate-in fade-in slide-in-from-bottom-6 fill-mode-both duration-1000 delay-500 motion-reduce:animate-none sm:top-[13.5rem]">
        <div className="rounded-3xl bg-white p-5 shadow-2xl shadow-black/40 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-sky text-brand-navy">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-bold text-brand-ink">Who is a stronger believer?</p>
          </div>
          <p className="mt-3.5 text-sm leading-relaxed text-brand-ink/80">
            The first mark is one who knows God.{" "}
            <span className="font-display italic text-brand-ink">
              &ldquo;There is strength in knowing God. You can&apos;t know God and not be
              strong.&rdquo;
            </span>
            <sup className="ml-0.5 text-xs font-bold text-brand-navy">1</sup>
          </p>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-brand-light p-2.5 pr-3.5">
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-brand-navy text-white">
              <PlayCircle className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold text-brand-ink">
                Are You a Strong Believer? Immersion Service
              </span>
              <span className="block text-xs text-brand-gray">
                Rev. Peter Ayo Alabi · 3 May 2026 · watch from 35:08
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* verse chip — floating */}
      <div className="absolute bottom-0 right-0 hidden w-[60%] rotate-[3deg] sm:block animate-in fade-in zoom-in-95 fill-mode-both duration-700 delay-700 motion-reduce:animate-none">
        <div className="rounded-2xl border border-brand-navy/10 bg-brand-sky/95 p-4 shadow-xl shadow-black/25 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-navy">
            Daniel 11:32 · KJV
          </p>
          <p className="mt-1.5 font-display text-base leading-snug text-brand-ink">
            &hellip;the people that do know their God shall be strong, and do exploits.
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ number, children, dark = false }) {
  return (
    <p
      className={`flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] ${
        dark ? "text-white/55" : "text-brand-navy"
      }`}
    >
      <span className="font-display text-sm normal-case tracking-normal tabular-nums">{number}</span>
      <span aria-hidden="true" className={`h-px w-8 ${dark ? "bg-white/30" : "bg-brand-navy/30"}`} />
      {children}
    </p>
  );
}

export default async function AboutPage() {
  const stats = await getCorpusStats();

  const statItems = stats && [
    { value: fmt(stats.messages), label: "messages transcribed" },
    { value: fmt(stats.series), label: "study series" },
    { value: fmt(stats.declarations), label: "declarations gathered" },
    { value: fmt(stats.scriptures), label: "scripture references mapped" },
  ];

  return (
    <main id="main-content" className="min-h-screen overflow-x-clip bg-white">
      {/* ── hero ── */}
      <section className="px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[1.75rem] bg-brand-deep sm:rounded-[2.5rem]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-48 -top-48 h-[36rem] w-[36rem] rounded-full bg-brand-navy blur-3xl" />
            <div className="absolute -bottom-56 right-[12%] h-[32rem] w-[32rem] rounded-full bg-[#2a5a96]/40 blur-3xl" />
            <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_55%)]" />
          </div>

          <div className="relative z-10 grid items-center gap-14 px-6 pb-12 pt-28 sm:px-10 sm:pt-36 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8 lg:px-16 lg:pb-16 lg:pt-40">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/60 animate-in fade-in fill-mode-both duration-700 motion-reduce:animate-none">
                About FaithHub
              </p>
              <h1 className="mt-5 font-display text-5xl font-medium leading-[1.02] tracking-tight text-white text-balance animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-100 motion-reduce:animate-none sm:text-6xl lg:text-7xl">
                Every message,{" "}
                <em className="font-normal italic text-brand-mist">searchable and cited.</em>
              </h1>
              <p className="mt-7 max-w-lg text-lg leading-relaxed text-white/70 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-200 motion-reduce:animate-none">
                FaithHub puts Heritage of Faith&apos;s messages in one library you can
                search, ask questions of, and pray with. It&apos;s free and needs no
                account.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-300 motion-reduce:animate-none">
                <Link
                  href="/ask"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-deep"
                >
                  Ask your first question
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="#feedback"
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Send feedback
                </a>
              </div>
            </div>

            <HeroStillLife />
          </div>

          {/* live corpus numbers */}
          {statItems && (
            <div className="relative z-10 border-t border-white/10">
              <dl className="grid grid-cols-2 lg:grid-cols-4">
                {statItems.map((s, i) => (
                  <div
                    key={s.label}
                    className={`px-6 py-7 sm:px-10 lg:px-16 lg:py-9 ${
                      i % 2 === 1 ? "border-l border-white/10" : ""
                    } ${i >= 2 ? "border-t border-white/10 lg:border-t-0" : ""} ${
                      i === 2 ? "lg:border-l" : ""
                    }`}
                  >
                    <dt className="sr-only">{s.label}</dt>
                    <dd className="font-display text-4xl font-medium tabular-nums tracking-tight text-white sm:text-5xl">
                      {s.value}
                    </dd>
                    <dd className="mt-1.5 text-xs font-medium uppercase tracking-[0.14em] text-white/50">
                      {s.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
        {stats?.since && (
          <p className="mx-auto mt-3 max-w-[1400px] px-3 text-right text-xs text-brand-gray">
            Messages from {stats.since} to this week · counts update daily
          </p>
        )}
      </section>

      {/* ── why ── */}
      <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
          <div className="lg:pt-4">
            <SectionLabel number="01">Why it exists</SectionLabel>
          </div>
          <div>
            <p className="max-w-4xl font-display text-3xl leading-[1.25] tracking-tight text-brand-ink text-pretty sm:text-4xl lg:text-5xl">
              FaithHub lets you go back to the teaching: search it when a question
              comes up, study it a series at a time, and{" "}
              <em className="italic text-brand-navy">speak it over your life</em> after
              the service is over.
            </p>
            <p className="mt-8 max-w-2xl leading-relaxed text-brand-gray">
              It adds no doctrine of its own and doesn&apos;t replace gathering with the
              family. It only makes what was already preached easier to find.
            </p>
          </div>
        </div>
      </section>

      {/* ── the tools ── */}
      <section className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-6 sm:pb-28">
        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
          <div>
            <SectionLabel number="02">What&apos;s inside</SectionLabel>
            <h2 className="mt-5 font-display text-3xl font-medium leading-tight tracking-tight text-brand-ink">
              Four ways into one library.
            </h2>
          </div>

          <ul className="border-t border-brand-navy/10">
            {TOOLS.map((tool) => (
              <li key={tool.href} className="border-b border-brand-navy/10">
                <Link
                  href={tool.href}
                  className="group -mx-4 grid gap-3 rounded-2xl px-4 py-7 transition-colors hover:bg-brand-sky/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy sm:-mx-6 sm:grid-cols-[3rem_minmax(0,14rem)_minmax(0,1fr)_2.5rem] sm:items-center sm:gap-6 sm:px-6"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-sky text-brand-navy transition-colors group-hover:bg-brand-navy group-hover:text-white">
                    <tool.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-display text-2xl text-brand-ink">{tool.name}</span>
                  <span className="text-sm leading-relaxed text-brand-gray sm:text-base">
                    {tool.blurb}
                  </span>
                  <ArrowUpRight
                    className="hidden h-5 w-5 justify-self-end text-brand-navy/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-navy sm:block"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── method ── */}
      <section className="px-3 sm:px-5">
        <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[1.75rem] bg-brand-sky px-6 py-16 sm:rounded-[2.5rem] sm:px-10 sm:py-20 lg:px-16 lg:py-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-white blur-3xl" />
            <DotGrid className="inset-0 [mask-image:radial-gradient(ellipse_at_bottom_right,black,transparent_55%)]" />
          </div>

          <div className="relative">
            <SectionLabel number="03">How it works</SectionLabel>
            <h2 className="mt-5 max-w-2xl font-display text-3xl font-medium leading-tight tracking-tight text-brand-ink sm:text-5xl">
              Every answer starts from a real message.
            </h2>

            <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
              {METHOD.map((m, i) => (
                <li key={m.title} className="relative">
                  <div className="flex items-center gap-4">
                    <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full border border-brand-navy/20 bg-white font-display text-xl text-brand-navy">
                      {i + 1}
                    </span>
                    {i < METHOD.length - 1 && (
                      <span aria-hidden="true" className="hidden h-px flex-1 bg-gradient-to-r from-brand-navy/25 to-transparent md:block" />
                    )}
                  </div>
                  <h3 className="mt-6 font-display text-2xl text-brand-ink">{m.title}</h3>
                  <p className="mt-3 leading-relaxed text-brand-gray">{m.body}</p>
                </li>
              ))}
            </ol>

            <aside className="mt-14 flex max-w-3xl gap-4 rounded-2xl border border-brand-navy/10 bg-white/80 p-5 backdrop-blur sm:p-6">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-navy" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-brand-ink/80">
                The search and summaries here use AI, and AI can mishear a recording.
                Check what you read against Scripture, and click through to the message
                itself. If something misrepresents what was preached,{" "}
                <a href="#feedback" className="font-bold text-brand-navy underline underline-offset-4 hover:text-brand-deep">
                  tell us
                </a>
                .
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* ── the house ── */}
      <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-20">
          <figure className="relative isolate">
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-[12rem] rounded-b-[2rem] sm:aspect-[5/6]">
              <Image
                src="/about-people.jpg"
                alt="Two members of Heritage of Faith Church smiling as they arrive for service"
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover object-[62%_35%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/55 via-transparent to-transparent" />
            </div>
            <div
              aria-hidden="true"
              className="absolute -inset-3 -z-10 rounded-t-[12.75rem] rounded-b-[2.5rem] border border-brand-navy/15"
            />
            <figcaption className="absolute bottom-5 left-5 right-5 flex items-center justify-between gap-3 rounded-2xl bg-white/90 px-4 py-3 backdrop-blur sm:bottom-6 sm:left-6 sm:right-auto">
              <span>
                <span className="block text-sm font-bold text-brand-ink">Heritage of Faith Church</span>
                <span className="block text-xs text-brand-gray">Lagos, Nigeria</span>
              </span>
            </figcaption>
          </figure>

          <div>
            <SectionLabel number="04">Whose teaching this is</SectionLabel>
            <h2 className="mt-5 font-display text-3xl font-medium leading-tight tracking-tight text-brand-ink sm:text-5xl">
              Preached at Heritage of Faith Church.
            </h2>
            <p className="mt-6 max-w-xl leading-relaxed text-brand-gray">
              These messages come from Heritage of Faith Church services published on
              the church&apos;s YouTube channel, mostly preached by Rev. Peter Ayo
              Alabi, with others from Pastor Funlola Alabi. FaithHub organises them and
              adds nothing to what was taught.
            </p>

            <blockquote className="mt-10 border-l-2 border-brand-navy pl-6">
              <p className="font-display text-2xl leading-snug text-brand-ink sm:text-3xl">
                &ldquo;The vision of our ministry is raising stronger believers.&rdquo;
              </p>
              <footer className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-brand-gray">
                Rev. Peter Ayo Alabi
              </footer>
            </blockquote>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/vision"
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-navy/20 transition-colors hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
              >
                Read the vision
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="https://hofng.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-navy/20 px-5 py-3 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-sky"
              >
                hofng.org
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={YOUTUBE_CHANNEL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-navy/20 px-5 py-3 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-sky"
              >
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                YouTube channel
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── feedback ── */}
      <section id="feedback" className="scroll-mt-20 border-t border-brand-navy/10 bg-brand-light">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionLabel number="05">Feedback</SectionLabel>
            <h2 className="mt-5 font-display text-4xl font-medium leading-tight tracking-tight text-brand-ink sm:text-5xl">
              Tell us what to fix or add.
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-brand-gray">
              FaithHub is still being built. If something is wrong, missing or
              confusing, send a note and a screenshot if you have one.
            </p>

            <p className="mt-10 text-xs font-bold uppercase tracking-[0.16em] text-brand-ink">
              Worth sending
            </p>
            <ul className="mt-4 space-y-3.5">
              {SEND.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-white text-brand-navy ring-1 ring-brand-navy/10">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="pt-1 text-sm leading-relaxed text-brand-ink/80">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <FeedbackForm />
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-brand-navy/10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-5 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-4">
            <Image src="/hofng-logo.png" alt="Heritage of Faith" width={208} height={146} className="h-8 w-auto" />
            <p className="text-xs text-brand-gray">&copy; {new Date().getFullYear()} Heritage of Faith Church</p>
          </div>
          <Link href="/" className="text-sm font-medium text-brand-gray transition-colors hover:text-brand-navy">
            Back to FaithHub
          </Link>
        </div>
      </footer>
    </main>
  );
}
