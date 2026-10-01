import Image from "next/image";
import { cn } from "@/lib/utils";
import { DotGrid, Rings } from "@/components/Decor";

/**
 * The navy band that opens a tool page — the look The Word's header set,
 * shared so Ask, Series and Declarations open the same way. `className`
 * places it in the page's own column; `aside` adds a right-hand column on
 * wide screens (stacks below the text on narrow ones).
 */
export default function Masthead({
  eyebrow,
  title,
  titleAs: TitleTag = "h1",
  description,
  children,
  aside,
  // Real material behind the band instead of flat navy: `{ src, alt, position }`,
  // where position is an object-position class (e.g. "object-[75%_30%]") that
  // keeps the subject out from under the text. A flat navy scrim — not a
  // gradient — holds the contrast; the photo reads through it as texture.
  image,
  className,
}) {
  return (
    <section className={cn("fh-rise", className)}>
      <div
        className={cn(
          "relative isolate overflow-hidden rounded-[1.75rem] px-6 py-9 text-white sm:rounded-[2rem] sm:px-10 sm:py-12",
          image ? "bg-brand-deep" : "bg-brand-navy"
        )}
      >
        {image ? (
          <>
            <Image
              src={image.src}
              alt={image.alt || ""}
              fill
              priority
              sizes="(min-width: 1024px) 70vw, 100vw"
              className={cn("-z-20 object-cover", image.position || "object-center")}
            />
            {/* A flat navy scrim, not a gradient. Heavier on a phone, where the
                text spans the full width of a short band and the photo can only
                be felt; lighter from sm, where it has room to be seen. */}
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-deep/[0.78] sm:bg-brand-deep/[0.7]" />
          </>
        ) : (
          <DotGrid dark className="inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_60%)]" />
        )}
        <Rings className="absolute -right-40 top-1/2 -z-10 h-[32rem] w-[32rem] -translate-y-1/2 text-white/[0.08]" />
        <div className={cn(aside && "grid items-center gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10")}>
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">{eyebrow}</p>}
            <TitleTag
              className={cn(
                "font-display text-3xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-4xl",
                eyebrow && "mt-3"
              )}
            >
              {title}
            </TitleTag>
            {description && <p className="mt-3 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">{description}</p>}
            {children}
          </div>
          {aside}
        </div>
      </div>
    </section>
  );
}
