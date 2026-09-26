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

// Momentum projection from Apple's "Designing Fluid Interfaces" sample code —
// the exponential-decay form (NOT the v²/2a textbook one). Predicts where a
// flick of the given velocity (px/s) would coast to rest, so the release snaps
// to where the gesture was *going*, not where the finger happened to lift.
const project = (velocity, decel = 0.998) => ((velocity / 1000) * decel) / (1 - decel);

// A critically-damped spring (damping 1.0, response 0.4s — Apple's "move /
// reposition" values) so the mini-player settles onto its edge with no bounce.
const SPRING_RESPONSE = 0.4;

export default function VideoModal({ seg, onClose, initialMinimized = false }) {
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState(null); // {x,y} once dragged; null = default corner
  const cardRef = useRef(null);
  const dragRef = useRef(null); // { dx, dy, startX, startY, moved } while a drag is live
  const samplesRef = useRef([]); // recent {t,x,y} pointer samples → release velocity
  const animRef = useRef(null); // rAF id of a running snap, so a new grab cancels it

  // A citation clicked while the player is closed opens in the surface's
  // default size — full-screen normally, or the corner mini-player where the
  // reader is meant to keep studying alongside it (Ask, `initialMinimized`).
  // But if the player is already open — including minimized — clicking a
  // different citation just swaps the video in place and keeps whatever state
  // (minimized, dragged position) it had, so playback keeps going in the
  // mini-player instead of popping back open.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const isFreshOpen = !!seg && !wasOpenRef.current;
    if (isFreshOpen) {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      setMinimized(initialMinimized);
      setPos(null);
    }
    wasOpenRef.current = !!seg;
  }, [seg?.video_id, seg?.start_seconds, initialMinimized]);

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
  // Spring the card from its current position to a target, handing off the
  // release velocity so there's no seam between the drag and the animation.
  // X and Y run as independent springs (a single 2D spring desyncs when the
  // two axes carry different velocities). Interruptible: a new grab cancels it.
  const springSnap = useCallback((target, v0) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const omega = (2 * Math.PI) / SPRING_RESPONSE;
    const el = cardRef.current;
    const r0 = el.getBoundingClientRect();
    const cur = { x: r0.left, y: r0.top };
    const vel = { x: v0.x, y: v0.y };
    let last = performance.now();
    const step = (now) => {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 1 / 30) dt = 1 / 30; // tab-throttle guard — never integrate a huge step
      let settled = true;
      for (const ax of ["x", "y"]) {
        // critically-damped spring: a = -ω²·displacement - 2ω·velocity
        const a = -omega * omega * (cur[ax] - target[ax]) - 2 * omega * vel[ax];
        vel[ax] += a * dt;
        cur[ax] += vel[ax] * dt;
        if (Math.abs(cur[ax] - target[ax]) > 0.5 || Math.abs(vel[ax]) > 5) settled = false;
      }
      if (settled) {
        animRef.current = null;
        setPos({ x: target.x, y: target.y });
        return;
      }
      setPos({ x: cur.x, y: cur.y });
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  const startDrag = useCallback(
    (e) => {
      if (!minimized || e.button > 0) return;
      if (e.target.closest("button")) return; // let expand/close win their own taps
      const el = cardRef.current;
      if (!el) return;
      if (animRef.current) {
        // Grab a mid-flight snap and continue from where it visually is.
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      const r = el.getBoundingClientRect();
      dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, startX: r.left, startY: r.top, moved: false };
      samplesRef.current = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
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
    if (Math.abs(e.clientX - d.startX - d.dx) > 3 || Math.abs(e.clientY - d.startY - d.dy) > 3) d.moved = true;
    const s = samplesRef.current;
    s.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (s.length > 6) s.shift(); // a short history is all the release velocity needs
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: clamp(e.clientX - d.dx, EDGE, window.innerWidth - width - EDGE),
      y: clamp(e.clientY - d.dy, EDGE, window.innerHeight - height - EDGE),
    });
  }, []);

  const endDrag = useCallback(
    (e) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (!d.moved) return; // a tap on the handle shouldn't reposition anything

      const el = cardRef.current;
      const r = el.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      const maxX = Math.max(EDGE, window.innerWidth - w - EDGE);
      const maxY = Math.max(EDGE, window.innerHeight - h - EDGE);

      // Release velocity from the last few samples (px/s over a ~30ms+ window).
      const s = samplesRef.current;
      let vx = 0;
      let vy = 0;
      if (s.length >= 2) {
        const lastS = s[s.length - 1];
        let refS = s[0];
        for (let i = s.length - 2; i >= 0; i--) {
          refS = s[i];
          if (lastS.t - s[i].t >= 30) break;
        }
        const dtv = (lastS.t - refS.t) / 1000;
        if (dtv > 0) {
          vx = (lastS.x - refS.x) / dtv;
          vy = (lastS.y - refS.y) / dtv;
        }
      }

      // Snap to the nearer side (by where a flick would land), keep vertical
      // position with its own momentum — the PiP feel: it sticks to an edge but
      // stays roughly where the reader put it.
      const projCenterX = r.left + w / 2 + project(vx);
      const targetX = projCenterX < window.innerWidth / 2 ? EDGE : maxX;
      const targetY = clamp(r.top + project(vy), EDGE, maxY);

      const reduced =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        setPos({ x: targetX, y: targetY });
        return;
      }
      springSnap({ x: targetX, y: targetY }, { x: vx, y: vy });
    },
    [springSnap]
  );

  // Cancel any in-flight snap on unmount / close.
  useEffect(() => {
    if (!seg && animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [seg]);

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
                className="relative w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-90 before:content-[''] before:absolute before:-inset-2"
              >
                <Maximize2 size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Minimize — keep watching while you study"
                title="Minimize — keep watching while you study"
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-90"
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
                  ? "relative w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-90 before:content-[''] before:absolute before:-inset-2"
                  : "w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-90"
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
            title={cleanTitle(seg.sermon_title)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
