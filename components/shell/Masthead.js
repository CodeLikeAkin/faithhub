import { cn } from "@/lib/utils";
import { DotGrid, Eyebrow, Rings } from "@/components/Decor";

/**
 * The navy band that opens a tool page, shared so Ask, Series and
 * Declarations open the same way. Built like the Vision page's dark panels:
 * deep navy, a navy glow in the top corner (no light glow at the bottom — it read as a white haze under the search box), a dot grid fading out of
 * one corner, rings off the other. `className` places it in the page's own
 * column; `aside` adds a right-hand column on wide screens (stacks below the
 * text on narrow ones). An <em> in `title` is set as the accent word.
 */
export default function Masthead({
  eyebrow,
  title,
  titleAs: TitleTag = "h1",
  description,
  children,
  aside,
  className,
}) {
  return (
    <section className={cn("fh-rise", className)}>
      <div className="relative isolate overflow-hidden rounded-[1.75rem] bg-brand-deep px-6 py-9 text-white shadow-card sm:rounded-[2rem] sm:px-10 sm:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-brand-navy blur-3xl" />
          <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_55%)]" />
          <Rings className="absolute -right-40 top-1/2 h-[32rem] w-[32rem] -translate-y-1/2 text-white/[0.07]" />
        </div>
        <div className={cn(aside && "grid items-center gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10")}>
          <div className="min-w-0">
            {eyebrow && <Eyebrow tone="dark">{eyebrow}</Eyebrow>}
            <TitleTag
              className={cn(
                "font-display text-4xl font-medium leading-[1.04] tracking-tight text-balance sm:text-5xl",
                "[&_em]:font-normal [&_em]:italic [&_em]:text-brand-mist",
                eyebrow && "mt-4"
              )}
            >
              {title}
            </TitleTag>
            {description && <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">{description}</p>}
            {children}
          </div>
          {aside}
        </div>
      </div>
    </section>
  );
}
