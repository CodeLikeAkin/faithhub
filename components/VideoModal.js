"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Minimize2, Maximize2, GripHorizontal } from "lucide-react";
import { cleanTitle } from "@/lib/titles";

/**
 * Fullscreen overlay embedding a cited moment without leaving the page.
 * Can shrink to a corner mini-player so the reader can keep studying while
 * it plays. Shared by every surface that cites a sermon moment (study chat,
 * Ask the Word, declarations) so citations never bounce out to YouTube.
 *
 * The minimized and full-size states render the SAME element tree shape
 * (only classNames/handlers differ) so React never unmounts the <iframe> —
 * unmounting would reload the embed and restart playback from `start=`
 * instead of continuing where the viewer left off.
 *
 * The mini-player is DRAGGABLE by its title bar. It starts in the bottom-right
 * corner but nothing forces it to stay there — whatever it covers (a
 * declaration, a cited line, the composer) the reader can just move it off.
 */
const EDGE = 8; // keep this much of a gap between the mini-player and the viewport edge

const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));

export default function VideoModal({ seg, onClose }) {
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState(null); // {x,y} once dragged; null = default corner
  const cardRef = useRef(null);
  const dragRef = useRef(null); // { dx, dy } while a drag is live

  // Each newly-cited video opens full-size, even if the last one was minimized,
  // and back in the default corner.
  useEffect(() => {
    setMinimized(false);
    setPos(null);
  }, [seg?.video_id, seg?.start_seconds]);

  // A dragged-to position is absolute, so a resize (or a phone rotating) can
  // strand the player off-screen. Pull it back inside.
  useEffect(() => {
    if (!pos) return;
    const onResize = () => {
      const el = cardRef.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      setPos((p) =>
        p && {
          x: clamp(p.x, EDGE, window.innerWidth - width - EDGE),
          y: clamp(p.y, EDGE, window.innerHeight - height - EDGE),
        }
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  // Drag runs on pointer events with pointer capture — capture is what keeps
  // the moves coming once the cursor crosses the <iframe>, which would
  // otherwise swallow them and drop the player mid-drag.
  const startDrag = useCallback(
    (e) => {
      if (!minimized || e.button > 0) return;
      if (e.target.closest("button")) return; // let expand/close win their own taps
      const el = cardRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      setPos({ x: r.left, y: r.top }); // pin where it already is, so nothing jumps
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture unavailable — drag still tracks, just not over the iframe */
      }
      e.preventDefault();
    },
    [minimized]
  );

  const onDrag = useCallback((e) => {
    const d = dragRef.current;
    const el = cardRef.current;
    if (!d || !el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: clamp(e.clientX - d.dx, EDGE, window.innerWidth - width - EDGE),
      y: clamp(e.clientY - d.dy, EDGE, window.innerHeight - height - EDGE),
    });
  }, []);

  const endDrag = useCallback((e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  useEffect(() => {
    if (minimized) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, minimized]);

  // Lock body scroll while the full-size overlay is open (not when minimized —
  // the reader is meant to keep scrolling with the mini-player running).
  useEffect(() => {
    if (!seg || minimized) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [seg, minimized]);

  if (!seg) return null;

  const src = `https://www.youtube.com/embed/${seg.video_id}?start=${Math.max(
    0,
    Math.floor(seg.start_seconds || 0)
  )}&autoplay=1`;

  const docked = minimized && !pos; // still in its default corner

  return (
    <div
      ref={cardRef}
      className={
        minimized
          ? // Default corner floats clear of the docked chat composer on phones
            // (it sits at the bottom of an h-dvh column and would otherwise bury
            // the mini-player). Once dragged, left/top take over entirely.
            `fixed z-50 w-56 sm:w-72 ${
              docked
                ? "right-4 bottom-[calc(9.75rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1rem+env(safe-area-inset-bottom))]"
                : ""
            }`
          : "fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      }
      style={pos && minimized ? { left: pos.x, top: pos.y } : undefined}
      onClick={minimized ? undefined : onClose}
    >
      <div
        className={
          minimized
            ? "rounded-xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10"
            : "w-full max-w-2xl"
        }
        onClick={minimized ? undefined : (e) => e.stopPropagation()}
      >
        {/* Title bar doubles as the drag handle when minimized. The iframe can't
            be the handle — YouTube owns those pointer events. */}
        <div
          onPointerDown={startDrag}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={
            minimized
              ? "flex items-center justify-between bg-black/90 px-2 py-1.5 select-none touch-none cursor-grab active:cursor-grabbing"
              : "flex items-center justify-between mb-2"
          }
        >
          {minimized && (
            <GripHorizontal
              size={13}
              aria-hidden="true"
              className="text-white/40 flex-shrink-0 mr-1.5"
            />
          )}
          <p
            className={
              minimized
                ? "text-white text-xs font-medium truncate pr-2 flex-1 min-w-0"
                : "text-white text-sm font-medium truncate pr-3"
            }
          >
            {cleanTitle(seg.sermon_title)}
          </p>
          <div
            className={
              minimized
                ? "flex items-center gap-2 flex-shrink-0"
                : "flex items-center gap-2 flex-shrink-0"
            }
          >
            {minimized ? (
              <button
                type="button"
                onClick={() => setMinimized(false)}
                aria-label="Expand"
                className="relative w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center before:content-[''] before:absolute before:-inset-2"
              >
                <Maximize2 size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Minimize — keep watching while you study"
                title="Minimize — keep watching while you study"
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <Minimize2 size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={
                minimized
                  ? "relative w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center before:content-[''] before:absolute before:-inset-2"
                  : "w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              }
            >
              <X size={minimized ? 13 : 16} />
            </button>
          </div>
        </div>
        <div
          className={
            minimized
              ? "relative w-full aspect-video"
              : "relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl"
          }
        >
          <iframe
            src={src}
            title={seg.sermon_title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
