"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Admin form controls. One shape system: pill buttons, 16px-radius fields,
 * 24px-radius cards. Labels sit above inputs; errors sit below. Inputs are
 * 16px text (the app's input floor, and it stops iOS zooming in).
 */

const BTN = {
  primary:
    "bg-brand-navy text-white shadow-[0_8px_20px_-10px_rgba(23,58,104,0.8)] hover:bg-brand-deep focus-visible:ring-brand-navy",
  secondary: "bg-white text-brand-navy ring-1 ring-inset ring-brand-navy/20 hover:bg-brand-sky focus-visible:ring-brand-navy",
  ghost: "text-brand-navy hover:bg-brand-sky focus-visible:ring-brand-navy",
  danger: "bg-[#b42318] text-white hover:bg-[#912018] focus-visible:ring-[#b42318]",
  dangerSoft: "text-[#b42318] ring-1 ring-inset ring-[#b42318]/25 hover:bg-[#b42318]/[0.06] focus-visible:ring-[#b42318]",
};

export const Btn = forwardRef(function Btn(
  { variant = "primary", size = "md", busy = false, icon: Icon, className, children, disabled, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "px-3.5 py-1.5 text-sm" : "px-5 py-2.5 text-sm",
        BTN[variant],
        className
      )}
      {...rest}
    >
      {busy ? (
        <Loader2 size={16} aria-hidden="true" className="animate-spin" />
      ) : (
        Icon && <Icon size={16} aria-hidden="true" />
      )}
      {children}
    </button>
  );
});

/**
 * Two-step button for anything that changes the live site: the first click
 * asks, the second does it. Resets itself after a few seconds.
 */
export function ConfirmBtn({ onConfirm, question = "Are you sure?", confirmLabel = "Yes", variant = "dangerSoft", size = "sm", children, busy, ...rest }) {
  const [asking, setAsking] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!asking) {
    return (
      <Btn
        variant={variant}
        size={size}
        busy={busy}
        onClick={() => {
          setAsking(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setAsking(false), 6000);
        }}
        {...rest}
      >
        {children}
      </Btn>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label={question}>
      <span className="text-sm font-medium text-brand-ink">{question}</span>
      <Btn
        variant={variant === "dangerSoft" ? "danger" : "primary"}
        size="sm"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Btn>
      <Btn variant="ghost" size="sm" onClick={() => setAsking(false)}>
        Cancel
      </Btn>
    </span>
  );
}

export function Field({ label, hint, error, id, children, className }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-brand-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={id ? `${id}-error` : undefined} role="alert" className="text-sm font-medium text-[#b42318]">
          {error}
        </p>
      ) : (
        hint && (
          <p id={id ? `${id}-hint` : undefined} className="text-sm text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const FIELD =
  "block w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-base text-brand-ink placeholder:text-slate-400 transition-shadow focus:border-brand-navy focus:outline-none focus:ring-4 focus:ring-brand-navy/15 disabled:bg-slate-50";

export const Input = forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(FIELD, className)} {...rest} />;
});

export const TextArea = forwardRef(function TextArea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(FIELD, "leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(FIELD, "pr-10", className)} {...rest}>
      {children}
    </select>
  );
});

/** Inline success / error line after an action. */
export function Notice({ tone = "info", children, className }) {
  if (!children) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-2xl px-4 py-3 text-sm",
        tone === "error" && "bg-[#b42318]/[0.07] font-medium text-[#912018]",
        tone === "success" && "bg-[#0ca30c]/[0.08] font-medium text-[#0a6b0a]",
        tone === "info" && "bg-brand-sky text-brand-ink",
        className
      )}
    >
      {children}
    </p>
  );
}

export function Chip({ children, tone = "sky", className }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "sky" && "bg-brand-sky text-brand-navy",
        tone === "outline" && "border border-slate-200 text-slate-600",
        tone === "good" && "bg-[#0ca30c]/10 text-[#0a6b0a]",
        tone === "warn" && "bg-[#fab219]/20 text-[#7a4f00]",
        tone === "bad" && "bg-[#d03b3b]/10 text-[#912018]",
        className
      )}
    >
      {children}
    </span>
  );
}
