"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** "Related questions" — the suggestions an answer ends with, as a list. */
export default function FollowUps({ questions, onAsk, disabled = false, title = "Related questions", className }) {
  if (!questions?.length) return null;
  return (
    <section className={className}>
      <h3 className="text-sm font-bold text-brand-ink">{title}</h3>
      <ul className="mt-2 divide-y divide-brand-navy/10 border-y border-brand-navy/10">
        {questions.map((q, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onAsk(q)}
              disabled={disabled}
              className={cn(
                "group flex w-full items-center justify-between gap-4 py-3.5 text-left text-base text-brand-ink transition-colors hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              <span>{q}</span>
              <ArrowRight
                size={17}
                aria-hidden="true"
                className="flex-shrink-0 text-brand-navy/40 transition-transform group-hover:translate-x-1 group-hover:text-brand-navy"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
