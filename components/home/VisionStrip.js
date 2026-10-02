import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DotGrid, Eyebrow, Rings } from "@/components/Decor";

/**
 * Home's pointer to the vision of the house, closing the page the way the
 * Vision page closes: a dark panel with the statement set large.
 */
export default function VisionStrip({ style }) {
  return (
    <Link
      href="/vision"
      style={style}
      className="fh-rise group relative isolate mt-4 flex flex-col gap-8 overflow-hidden rounded-[1.75rem] bg-brand-deep px-6 py-10 text-white shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 sm:rounded-[2.5rem] sm:px-10 sm:py-14 md:flex-row md:items-center md:justify-between"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-navy blur-3xl" />
        <div className="absolute -bottom-48 right-[10%] h-[24rem] w-[24rem] rounded-full bg-brand-mist/[0.12] blur-3xl" />
        <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_50%)]" />
      </div>

      <div className="max-w-xl">
        <Eyebrow tone="dark">The vision of the house</Eyebrow>
        <p className="mt-5 font-display text-4xl font-normal leading-[1.1] tracking-tight text-balance sm:text-5xl">
          Raising{" "}
          <span className="bg-[linear-gradient(transparent_62%,rgba(198,218,238,0.22)_62%)] italic text-brand-mist [box-decoration-break:clone]">
            stronger
          </span>{" "}
          believers
        </p>
        <span className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-brand-navy transition-colors group-hover:bg-brand-sky">
          Read the vision
          <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>

      {/* The arched portrait from the Vision hero, in miniature. */}
      <div aria-hidden="true" className="relative mx-auto hidden w-40 flex-shrink-0 sm:block md:mx-0 md:mr-6 lg:w-48">
        <Rings className="absolute left-1/2 top-1/2 w-[190%] max-w-none -translate-x-1/2 -translate-y-1/2 text-white/[0.08]" />
        <div className="absolute -inset-2.5 rounded-b-[1.75rem] rounded-tl-[50%_40%] rounded-tr-[50%_40%] border border-white/20" />
        <div className="relative aspect-[4/5] overflow-hidden rounded-b-[1.5rem] rounded-tl-[50%_40%] rounded-tr-[50%_40%] border-4 border-white/90 bg-brand-navy shadow-2xl shadow-black/30">
          <Image
            src="/peter-alabi-vision.jpg"
            alt=""
            fill
            sizes="12rem"
            className="object-cover object-[60%_30%] transition-transform duration-700 ease-out group-hover:scale-105"
          />
        </div>
      </div>
    </Link>
  );
}
