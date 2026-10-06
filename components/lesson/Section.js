import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/Decor";

/**
 * A titled section of a lesson or series page — a real heading, not a label.
 *
 * Pass `onToggle` to make the section fold away on a phone: the heading turns
 * into a button (with an optional `count`) and the body hides while
 * `collapsed`. From `sm` up the section is always open and the heading is plain.
 */
export default function Section({ id, eyebrow, title, intro, action, count, collapsed = false, onToggle, children }) {
  const heading = (
    <>
      {title}
      {count != null && <span className="ml-2 align-middle font-sans text-base font-medium text-brand-gray">{count}</span>}
    </>
  );
  return (
    <section id={id} aria-labelledby={id ? `${id}-heading` : undefined} className="scroll-mt-16 pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className={cn("min-w-0", onToggle && "w-full sm:w-auto")}>
          {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
          <h2
            id={id ? `${id}-heading` : undefined}
            className="font-display text-2xl font-medium leading-[1.1] tracking-tight text-brand-ink text-balance sm:text-3xl"
          >
            {onToggle ? (
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={!collapsed}
                aria-controls={id ? `${id}-body` : undefined}
                className="flex w-full items-center justify-between gap-3 text-left sm:pointer-events-none sm:w-auto"
              >
                <span>{heading}</span>
                <ChevronDown
                  size={20}
                  aria-hidden="true"
                  className={cn("flex-shrink-0 text-brand-navy transition-transform sm:hidden", !collapsed && "rotate-180")}
                />
              </button>
            ) : (
              heading
            )}
          </h2>
          {intro && <p className={cn("mt-1.5 text-sm text-brand-gray", collapsed && "hidden sm:block")}>{intro}</p>}
        </div>
        {action}
      </div>
      {/* The Vision page's rule under a heading, fading out to the right. */}
      <div aria-hidden="true" className="mt-5 h-px bg-gradient-to-r from-brand-navy/30 via-brand-navy/10 to-transparent" />
      <div id={id ? `${id}-body` : undefined} className={cn("mt-6", collapsed && "hidden sm:block")}>
        {children}
      </div>
    </section>
  );
}
