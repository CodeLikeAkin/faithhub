"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteStudy, restoreStudy } from "@/lib/studies";

/**
 * A brief status message at the bottom of a tool page, optionally with one
 * action (e.g. Undo). `const [toast, showToast] = useToast()` — render
 * `{toast}` anywhere in the page, call `showToast("Copied")` or
 * `showToast("Removed", { label: "Undo", run })`. `offset` is how far above
 * the bottom edge it sits (raise it over a docked composer).
 */
export function useToast({ offset = "6rem" } = {}) {
  const [toast, setToast] = useState(null); // { message, action? }
  const timer = useRef(null);

  const show = useCallback((message, action = null) => {
    setToast({ message, action });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), action ? 5000 : 2400);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const node = toast ? (
    <div
      role="status"
      style={{ bottom: `calc(${offset} + env(safe-area-inset-bottom))` }}
      className="fixed left-1/2 z-[70] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-brand-ink py-2.5 pl-4 pr-2 text-sm font-medium text-white shadow-lg"
    >
      <span className="truncate pr-2">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action.run();
            setToast(null);
          }}
          className="flex-shrink-0 rounded-full px-3 py-1 font-bold text-brand-mist transition-colors hover:bg-white/10"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  ) : null;

  return [node, show];
}

/** Copy a declaration (in quotes) and report how it went. */
/** Delete a saved study and offer Undo. */
export function deleteStudyWithUndo(id, showToast) {
  const removed = deleteStudy(id);
  if (removed) showToast("Study deleted", { label: "Undo", run: () => restoreStudy(removed) });
}

export async function copyText(text, showToast, { quoted = true, label = "Declaration copied" } = {}) {
  try {
    await navigator.clipboard.writeText(quoted ? `“${text}”` : text);
    showToast(label);
  } catch {
    showToast("Couldn’t copy — clipboard unavailable");
  }
}
