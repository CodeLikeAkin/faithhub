import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Home's pointer to the vision of the house. */
export default function VisionStrip({ style }) {
  return (
    <Link
      href="/vision"
      style={style}
      className="fh-rise group flex items-center gap-4 rounded-[1.75rem] border border-brand-navy/10 bg-brand-sky/60 p-4 transition-colors hover:border-brand-navy/30 sm:gap-5 sm:p-5"
    >
      <span className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full sm:h-16 sm:w-16">
        <Image src="/peter-alabi-vision.jpg" alt="Rev. Peter Ayo Alabi" fill sizes="64px" className="object-cover object-[50%_20%]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-[0.12em] text-brand-gray">The vision of the house</span>
        <span className="mt-0.5 block font-display text-xl font-medium text-brand-ink sm:text-2xl">Raising stronger believers</span>
      </span>
      <span className="hidden items-center gap-1.5 text-sm font-semibold text-brand-navy sm:inline-flex">
        Read the vision
        <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
      </span>
      <ArrowRight size={18} aria-hidden="true" className="flex-shrink-0 text-brand-navy sm:hidden" />
    </Link>
  );
}
