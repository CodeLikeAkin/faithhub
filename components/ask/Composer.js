"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { useKeyboardInset } from "@/lib/useKeyboardInset";
import { SCOPE_ALL } from "@/lib/studies";
import { cn } from "@/lib/utils";
import ScopeChip from "./ScopeChip";

/**
 * The one composer for every grounded-answer surface.
 *
 *   variant="hero"   — a large search box in the page flow (empty states)
 *   variant="docked" — pinned under a scrolling document; rides above the
 *                      on-screen keyboard (useKeyboardInset) and clears the
 *                      home indicator (safe-area padding)
 *
 * `onSubmit(text)` returns false when the question was not accepted (e.g. an
 * answer is still streaming) so the draft is kept.
 */
export default function Composer({
  variant = "docked",
  onSubmit,
  busy = false,
  scopes = [SCOPE_ALL],
  scope = SCOPE_ALL,
  onScopeChange,
  relative = false,
  placeholder = "Ask a question…",
  hint,
  width = "page",
  inputRef: externalRef,
  autoFocus = false,
  showScope = true,
  submitLabel = "Ask",
}) {
  const [text, setText] = useState("");
  const innerRef = useRef(null);
  const ref = externalRef || innerRef;
  const keyboardInset = useKeyboardInset();
  const hero = variant === "hero";

  // Auto-grow as the question wraps (capped by max-h). When empty, stay at
  // the natural height — a placeholder that wraps on a narrow phone would
  // otherwise inflate scrollHeight and open the bar at two lines.
  // No scrollbar until the text actually reaches the cap (a wrapped
  // placeholder alone would otherwise show one).
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    const max = hero ? 200 : 120;
    ta.style.height = "auto";
    if (text) ta.style.height = Math.min(ta.scrollHeight, max) + "px";
    ta.style.overflowY = text && ta.scrollHeight > max ? "auto" : "hidden";
  }, [text, hero, ref]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus, ref]);

  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    if (onSubmit(t) !== false) setText("");
  };

  const field = (
    <textarea
      ref={ref}
      rows={1}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          submit();
        }
      }}
      placeholder={placeholder}
      aria-label={placeholder.replace(/…$/, "")}
      enterKeyHint="send"
      className={cn(
        "min-w-0 flex-1 resize-none bg-transparent text-brand-ink placeholder:text-brand-gray/70 focus:outline-none",
        hero
          ? "block w-full px-2 py-1.5 text-lg leading-relaxed sm:text-xl max-h-[200px]"
          : "py-2 text-base leading-relaxed max-h-[120px]"
      )}
    />
  );

  const send = (
    <button
      type="submit"
      disabled={busy || !text.trim()}
      aria-label={busy ? "Working…" : submitLabel}
      className={cn(
        "grid flex-shrink-0 place-items-center rounded-full bg-brand-navy text-white transition-[transform,background-color,opacity] hover:bg-brand-deep active:scale-[0.96] disabled:opacity-35",
        hero ? "h-12 w-12" : "h-10 w-10"
      )}
    >
      {busy ? (
        <Loader2 size={hero ? 20 : 17} className="motion-safe:animate-spin" aria-hidden="true" />
      ) : (
        <ArrowUp size={hero ? 20 : 17} aria-hidden="true" />
      )}
    </button>
  );

  // On a phone the page composer's chip shrinks to its icon (on /ask it can
  // carry a whole series title). The panel's labels are short ("This
  // message"), so they stay readable there.
  const chip = showScope ? (
    <ScopeChip
      scopes={scopes}
      value={scope}
      onChange={(s) => onScopeChange?.(s)}
      relative={relative}
      dropUp={!hero}
      compact={!hero && width === "page"}
    />
  ) : (
    <span />
  );

  const onFormSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  if (hero) {
    return (
      <form
        onSubmit={onFormSubmit}
        className="rounded-[1.75rem] border border-brand-navy/15 bg-white p-3 shadow-[0_30px_60px_-30px_rgba(23,58,104,0.35)] transition-colors focus-within:border-brand-navy/40 sm:p-4"
      >
        {field}
        <div className="mt-2 flex items-center justify-between gap-3">
          {chip}
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-brand-gray sm:inline">Enter to ask</span>
            {send}
          </div>
        </div>
      </form>
    );
  }

  return (
    <div
      className="flex-shrink-0 border-t border-brand-navy/10 bg-white px-3 pt-3 pb-3.5 transition-transform duration-150 sm:px-6"
      style={{
        transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined,
        paddingBottom: keyboardInset ? undefined : "calc(0.875rem + env(safe-area-inset-bottom))",
      }}
    >
      <form onSubmit={onFormSubmit} className={cn("mx-auto", width === "page" ? "max-w-3xl" : "max-w-none")}>
        <div className="flex items-end gap-1.5 rounded-[1.4rem] border border-brand-navy/15 bg-white p-1.5 shadow-[0_10px_30px_-18px_rgba(23,58,104,0.35)] transition-colors focus-within:border-brand-navy/40">
          <div className="flex h-10 items-center">{chip}</div>
          {field}
          {send}
        </div>
        {/* Hidden on phones so the composer stays one line there. */}
        {hint && <p className="mt-1.5 hidden text-center text-xs text-brand-gray sm:block">{hint}</p>}
      </form>
    </div>
  );
}
