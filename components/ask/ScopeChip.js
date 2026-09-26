"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FileText, Globe, Layers } from "lucide-react";
import { scopeKey } from "@/lib/studies";
import { displayTitle } from "@/lib/titles";
import { cn } from "@/lib/utils";

export const SCOPE_ICONS = { all: Globe, series: Layers, message: FileText };

/**
 * `relative` phrasing ("This series") is for pages that ARE the series or
 * message; elsewhere (e.g. /ask) the scope is named ("Walking by Faith").
 */
export function scopeName(scope, relative) {
  if (!scope || scope.type === "all") return "Everything";
  if (scope.type === "series") return relative ? "This series" : displayTitle(scope.label);
  return relative ? "This message" : displayTitle(scope.label);
}

function scopeDetail(scope) {
  if (!scope || scope.type === "all") return "Every message Rev. Peter has taught";
  return displayTitle(scope.label);
}

/** The kind of scope, for menu rows and labels: "This series" / "Series". */
function scopeKind(scope, relative) {
  if (!scope || scope.type === "all") return "Everything";
  if (scope.type === "series") return relative ? "This series" : "Series";
  return relative ? "This message" : "Message";
}

/** Phrase for "Searching …" / placeholder text. */
export function scopePhrase(scope) {
  if (!scope || scope.type === "all") return "every message";
  return scope.type === "series" ? "this series" : "this message";
}

/**
 * The scope switch inside the composer: Everything / This series / This
 * message. A single available scope renders as a quiet static label.
 */
export default function ScopeChip({ scopes, value, onChange, relative = false, dropUp = false, compact = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);

  const current = scopes.find((s) => scopeKey(s) === scopeKey(value)) || scopes[0];
  const Icon = SCOPE_ICONS[current.type] || Globe;
  const label = scopeName(current, relative);

  // Close on outside press / Escape. A document listener (not a fixed
  // click-away layer) because the docked composer can carry a transform,
  // which would trap a position:fixed layer inside it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    const checked = scopes.findIndex((s) => scopeKey(s) === scopeKey(current));
    itemRefs.current[Math.max(0, checked)]?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // focus only when opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (scopes.length < 2) {
    return (
      <span
        className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm text-brand-gray"
        title={scopeDetail(current)}
      >
        <Icon size={15} aria-hidden="true" />
        <span className={compact ? "hidden sm:inline" : undefined}>{label}</span>
      </span>
    );
  }

  const onMenuKey = (e) => {
    const items = itemRefs.current.filter(Boolean);
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Search in: ${scopeKind(current, relative)} — ${scopeDetail(current)}. Change`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full bg-brand-sky px-3 text-sm font-medium text-brand-navy transition hover:bg-brand-mist/60 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
      >
        <Icon size={15} aria-hidden="true" className="flex-shrink-0" />
        <span className={cn("truncate", compact ? "hidden max-w-[9rem] sm:inline" : "max-w-[12rem]")}>
          {label}
        </span>
        <ChevronDown size={14} aria-hidden="true" className={cn("flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Search in"
          onKeyDown={onMenuKey}
          className={cn(
            "absolute left-0 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-brand-navy/10 bg-white p-1.5 shadow-xl shadow-brand-navy/15",
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          <p className="px-3 pb-1 pt-2 text-xs text-brand-gray">Search in</p>
          {scopes.map((s, i) => {
            const ItemIcon = SCOPE_ICONS[s.type] || Globe;
            const checked = scopeKey(s) === scopeKey(current);
            return (
              <button
                key={scopeKey(s)}
                ref={(el) => (itemRefs.current[i] = el)}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none",
                  checked ? "bg-brand-sky" : "hover:bg-brand-sky/60 focus-visible:bg-brand-sky/60"
                )}
              >
                <ItemIcon size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-brand-navy" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-brand-ink">{scopeKind(s, relative)}</span>
                  <span className="block truncate text-xs text-brand-gray">{scopeDetail(s)}</span>
                </span>
                {checked && <Check size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-brand-navy" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
