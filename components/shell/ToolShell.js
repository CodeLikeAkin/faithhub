"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useMediaQuery, PANEL_DOCKED_QUERY } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import ToolRail from "./ToolRail";
import { deleteStudyWithUndo, useToast } from "./Toast";

/**
 * The frame every tool page shares (Ask, lessons, series). Replaces the global
 * Navbar on these routes (Navbar hides itself there).
 *
 *   [ rail ] [ header / main ] [ panel ]
 *
 * - rail: 248px on desktop (collapsible to a 72px icon strip); a drawer from
 *   the left below lg.
 * - panel (optional): a 400px column from xl; a bottom sheet below that. It is
 *   ONE element whichever way it shows, so its state (a streaming answer, its
 *   scroll) survives a resize.
 * - While a drawer or sheet is open the columns behind it are `inert` and the
 *   body can't scroll; Escape closes it.
 *
 * Rail preference is remembered per page kind ("hof-rail-ask" for every tool
 * page, "hof-rail-lesson" for series/lesson pages): tool pages default
 * expanded, lesson pages default to the icon strip below 2xl so the video
 * gets the room.
 *
 * `overlay` renders OUTSIDE the inert columns (a page's full-screen layer,
 * e.g. Declarations' Speak mode, and its toasts); `coveredByOverlay` makes
 * the whole shell inert while that full-screen layer is up.
 */

// A layout effect on the client (no server-render warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function useRailPref(kind) {
  const [pref, setPref] = useState(null); // null | "open" | "closed"
  const key = `hof-rail-${kind}`;
  // Read before the first paint: most tool pages mount their own shell on
  // navigation, and a passive effect let a collapsed rail flash open first.
  useIsoLayoutEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v === "open" || v === "closed") setPref(v);
    } catch {
      /* storage unavailable */
    }
  }, [key]);
  const save = useCallback(
    (v) => {
      setPref(v);
      try {
        localStorage.setItem(key, v);
      } catch {
        /* storage unavailable */
      }
    },
    [key]
  );
  return [pref, save];
}

const RAIL_WIDTH = { expanded: "w-[248px]", collapsed: "w-[72px]", auto: "w-[72px] 2xl:w-[248px]" };

export default function ToolShell({
  kind = "ask",
  title,
  titleAs: TitleTag = "h1",
  back,
  actions,
  activeStudyId,
  activeBlockId,
  onJumpToBlock,
  onOpenStudy,
  panel,
  panelOpen = null,
  onPanelOpenChange,
  panelLabel = "Ask",
  coveredByOverlay = false,
  overlay = null,
  children,
}) {
  const [railOpen, setRailOpen] = useState(false); // mobile drawer
  // The rail's Undo lives here, outside the inert columns, so it survives
  // the drawer closing.
  const [railToast, showRailToast] = useToast();
  const onDeleteStudy = (id) => deleteStudyWithUndo(id, showRailToast);
  // Lesson pages keep their own rail preference; every other tool page shares one.
  const [pref, setPref] = useRailPref(kind === "lesson" ? "lesson" : "ask");
  const docked = useMediaQuery(PANEL_DOCKED_QUERY);
  const menuButtonRef = useRef(null);
  const drawerCloseRef = useRef(null);
  const sheetRef = useRef(null);

  const mode = pref === "open" ? "expanded" : pref === "closed" ? "collapsed" : kind === "lesson" ? "auto" : "expanded";

  // Width animates only for changes the reader makes here, never on mount.
  const [railAnimate, setRailAnimate] = useState(false);

  const railExpandedNow = () =>
    mode === "expanded" || (mode === "auto" && window.matchMedia("(min-width: 1536px)").matches);

  const toggleCollapse = () => {
    setRailAnimate(true);
    setPref(railExpandedNow() ? "closed" : "open");
  };

  // Whenever the rail is expanded (opened by the reader, or the page default,
  // or just arrived at from the rail), the next click outside it tucks it away.
  // Runs on click (not pointerdown) so the click lands on what the reader
  // aimed at before the layout shifts under it. Clicks inside the rail itself
  // don't count.
  const collapseRailAfterPageClick = (e) => {
    if (e.target.closest?.("[data-tool-rail]")) return;
    if (window.matchMedia("(min-width: 1024px)").matches && railExpandedNow()) {
      setRailAnimate(true);
      setPref("closed");
    }
  };

  // Panel visibility: null = automatic (docked column from xl, closed sheet
  // below), true/false = the reader's explicit choice.
  const sheetOpen = !!panel && panelOpen === true && !docked;
  const panelVisibleDocked = !!panel && panelOpen !== false;
  const overlayOpen = railOpen || sheetOpen;

  // Lock body scroll + close on Escape while a drawer or sheet is open.
  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (railOpen) setRailOpen(false);
      else if (sheetOpen) onPanelOpenChange?.(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [overlayOpen, railOpen, sheetOpen, onPanelOpenChange]);

  // Focus into the drawer when it opens; back to the menu button when it closes.
  const wasRailOpen = useRef(false);
  useEffect(() => {
    if (railOpen) drawerCloseRef.current?.focus();
    else if (wasRailOpen.current) menuButtonRef.current?.focus();
    wasRailOpen.current = railOpen;
  }, [railOpen]);

  // Move focus into the sheet when it opens (its own controls take it from there).
  useEffect(() => {
    if (sheetOpen) sheetRef.current?.focus({ preventScroll: true });
  }, [sheetOpen]);

  // A page-level full-screen overlay (Speak mode) covers the whole shell.
  const inertProps = overlayOpen || coveredByOverlay ? { inert: "" } : {};

  return (
    <div onClickCapture={collapseRailAfterPageClick} className="flex h-dvh overflow-hidden bg-white text-brand-ink">
      {/* Rail — desktop */}
      <aside
        data-tool-rail=""
        {...inertProps}
        aria-label="FaithHub"
        className={cn(
          "hidden flex-shrink-0 overflow-hidden border-r border-brand-navy/10 bg-brand-sky/40 lg:block",
          railAnimate && "transition-[width] duration-200 ease-out",
          RAIL_WIDTH[mode]
        )}
      >
        <ToolRail
          mode={mode}
          onToggleCollapse={toggleCollapse}
          activeStudyId={activeStudyId}
          activeBlockId={activeBlockId}
          onJumpToBlock={onJumpToBlock}
          onDeleteStudy={onDeleteStudy}
          onOpenStudy={onOpenStudy}
        />
      </aside>

      {/* Header + main */}
      <div {...inertProps} className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-shrink-0 items-center gap-1.5 border-b border-brand-navy/10 bg-white px-2 sm:h-16 sm:gap-2 sm:px-4 lg:px-6">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setRailOpen(true)}
            aria-label="Open menu"
            aria-expanded={railOpen}
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-brand-navy transition-colors hover:bg-brand-sky lg:hidden"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:text-base">
            {back && (
              <>
                <span className="hidden min-w-0 max-w-[40%] flex-shrink truncate text-brand-gray sm:inline">{back}</span>
                <span aria-hidden="true" className="hidden text-brand-gray/50 sm:inline">
                  /
                </span>
              </>
            )}
            <TitleTag className="min-w-0 truncate font-semibold text-brand-ink">{title}</TitleTag>
          </div>
          {actions && <div className="flex flex-shrink-0 items-center gap-1.5">{actions}</div>}
        </header>

        <main id="main-content" className="flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </main>
      </div>

      {/* Panel — docked column from xl, bottom sheet below */}
      {panel && (
        <>
          {sheetOpen && (
            <div
              aria-hidden="true"
              onClick={() => onPanelOpenChange?.(false)}
              className="fixed inset-0 z-30 bg-brand-ink/40 xl:hidden"
            />
          )}
          <aside
            ref={sheetRef}
            tabIndex={-1}
            aria-label={panelLabel}
            {...(!docked && !sheetOpen ? { inert: "", "aria-hidden": true } : {})}
            {...(sheetOpen ? { role: "dialog", "aria-modal": true } : {})}
            className={cn(
              "fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+2.75rem)] z-40 flex min-h-0 flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl outline-none transition-transform duration-300",
              sheetOpen ? "translate-y-0" : "pointer-events-none translate-y-full",
              "xl:pointer-events-auto xl:static xl:z-auto xl:w-[400px] xl:flex-shrink-0 xl:translate-y-0 xl:rounded-none xl:border-l xl:border-brand-navy/10 xl:shadow-none xl:transition-none",
              panelVisibleDocked ? "xl:flex" : "xl:hidden"
            )}
          >
            {panel}
          </aside>
        </>
      )}

      {/* Rail — mobile drawer */}
      {railOpen && (
        <div
          aria-hidden="true"
          onClick={() => setRailOpen(false)}
          className="fixed inset-0 z-40 bg-brand-ink/40 lg:hidden"
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        {...(!railOpen ? { inert: "", "aria-hidden": true } : {})}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(20rem,86vw)] bg-brand-sky shadow-2xl transition-transform duration-300 lg:hidden",
          railOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button
          ref={drawerCloseRef}
          type="button"
          onClick={() => setRailOpen(false)}
          aria-label="Close menu"
          className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-brand-gray transition-colors hover:bg-white hover:text-brand-navy"
          style={{ marginTop: "env(safe-area-inset-top)" }}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <ToolRail
          mode="expanded"
          onNavigate={() => setRailOpen(false)}
          activeStudyId={activeStudyId}
          activeBlockId={activeBlockId}
          onJumpToBlock={onJumpToBlock}
          onDeleteStudy={onDeleteStudy}
          onOpenStudy={onOpenStudy}
        />
      </div>

      {overlay}
      {railToast}
    </div>
  );
}

/** A pill button for the shell header's action slot. */
/**
 * `href` makes it a link instead of a button; `iconOnly` drops the visible
 * text (the label still names it for screen readers and the tooltip).
 */
export function HeaderButton({ icon: Icon, label, className, labelClassName, href, iconOnly = false, ...rest }) {
  const Tag = href ? Link : "button";
  return (
    <Tag
      {...(href ? { href } : { type: "button" })}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 flex-shrink-0 items-center gap-1.5 rounded-full border border-brand-navy/15 bg-white px-3 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy sm:h-9",
        iconOnly && "w-10 justify-center px-0 sm:w-9",
        className
      )}
      {...rest}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {!iconOnly && <span className={cn("hidden sm:inline", labelClassName)}>{label}</span>}
    </Tag>
  );
}
