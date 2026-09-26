import { fmt } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

/*
 * Messages per month, last 12 months. One series, so one hue and no legend
 * box (the card title names it). Columns cap at 24px, grow from one baseline,
 * 4px rounded tops. Labels are selective (the peak and the current month);
 * every value is also in the hover/focus tooltip and in the hidden table.
 * The unfinished current month is a lighter step of the same hue, labelled.
 */

const PLOT = 176; // px, plot height (axis labels sit outside it)

function scale(max) {
  const step = max > 40 ? 20 : max > 20 ? 10 : 5;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

export default function MonthlyChart({ months }) {
  const max = Math.max(...months.map((m) => m.count), 0);
  const { top, ticks } = scale(max);
  const peakIndex = months.findIndex((m) => m.count === max && max > 0);
  const last = months.length - 1;

  return (
    <div className="px-6 pb-6 pt-8">
      <div className="flex gap-3">
        {/* y-axis ticks */}
        <div className="relative w-6 flex-shrink-0" style={{ height: PLOT }} aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 translate-y-1/2 text-xs tabular-nums text-slate-400"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {/* gridlines: solid hairlines, one step off the surface */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: PLOT }} aria-hidden="true">
            {ticks.map((t) => (
              <div
                key={t}
                className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-slate-300" : "bg-slate-100")}
                style={{ bottom: `${(t / top) * 100}%` }}
              />
            ))}
          </div>

          <ol className="relative grid grid-cols-12 gap-1 sm:gap-2" aria-hidden="true">
            {months.map((m, i) => {
              const h = top ? (m.count / top) * PLOT : 0;
              const showLabel = i === peakIndex || i === last;
              const align = i < 2 ? "left-0" : i > last - 2 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <li key={m.key} className="flex flex-col items-center">
                  <div className="relative flex w-full items-end justify-center" style={{ height: PLOT }}>
                    <div
                      tabIndex={0}
                      className="group relative flex w-full max-w-[24px] cursor-default justify-center outline-none"
                      style={{ height: Math.max(h, m.count ? 3 : 0) }}
                    >
                      {showLabel && (
                        <span className="absolute bottom-full mb-1.5 whitespace-nowrap text-xs font-semibold tabular-nums text-brand-ink">
                          {fmt(m.count)}
                          {m.partial && <span className="font-normal text-slate-500"> so far</span>}
                        </span>
                      )}
                      <div
                        className={cn(
                          "h-full w-full origin-bottom rounded-t transition-colors motion-safe:animate-grow-y",
                          m.partial ? "bg-[#6F8FBF]" : "bg-brand-navy",
                          "group-hover:bg-brand-deep group-focus-visible:bg-brand-deep group-focus-visible:ring-2 group-focus-visible:ring-brand-navy group-focus-visible:ring-offset-2"
                        )}
                        style={{ animationDelay: `${150 + i * 40}ms` }}
                      />
                      <span
                        role="tooltip"
                        className={cn(
                          "pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-xl bg-brand-ink px-3 py-2 text-left shadow-lg group-hover:block group-focus-visible:block",
                          align
                        )}
                      >
                        <span className="block text-sm font-bold text-white">
                          {fmt(m.count)} {m.count === 1 ? "message" : "messages"}
                        </span>
                        <span className="block text-xs text-brand-mist">
                          {m.long}
                          {m.partial ? " (so far)" : ""}
                        </span>
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-xs",
                      i === last ? "font-semibold text-brand-ink" : "text-slate-500",
                      // Every other label on narrow screens so twelve fit,
                      // counted back from the current month so it always shows.
                      (last - i) % 2 === 1 && "hidden sm:inline"
                    )}
                  >
                    {m.short}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Wrapped: a <table> ignores sr-only's 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>Messages added to the library per month, by YouTube upload date</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Messages</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key}>
                <th scope="row">{m.long}{m.partial ? " (so far)" : ""}</th>
                <td>{m.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
