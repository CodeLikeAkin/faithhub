/** A titled section of a lesson or series page — a real heading, not a label. */
export default function Section({ id, title, intro, action, children }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-heading` : undefined} className="scroll-mt-16 pt-14">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2
            id={id ? `${id}-heading` : undefined}
            className="font-display text-2xl font-medium tracking-tight text-brand-ink sm:text-3xl"
          >
            {title}
          </h2>
          {intro && <p className="mt-1.5 text-sm text-brand-gray">{intro}</p>}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
