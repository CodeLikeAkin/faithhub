import Image from "next/image";

/**
 * A branded stand-in for a message whose YouTube thumbnail is missing (some
 * uploads never get one): the title set on the house navy instead of an
 * empty box. Fills its positioned parent.
 */
export default function ThumbFallback({ title, subtitle }) {
  return (
    <span className="absolute inset-0 flex flex-col justify-end overflow-hidden bg-brand-navy p-3.5 text-left text-white">
      <Image
        src="/hofng-logo-white.png"
        alt=""
        width={208}
        height={146}
        aria-hidden="true"
        className="absolute -right-4 -top-3 h-24 w-auto opacity-[0.12]"
      />
      {title && <span className="relative line-clamp-2 font-display text-lg font-medium leading-tight">{title}</span>}
      {subtitle && <span className="relative mt-0.5 text-xs text-white/70">{subtitle}</span>}
    </span>
  );
}
