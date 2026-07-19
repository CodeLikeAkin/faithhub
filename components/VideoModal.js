"use client";

import { useEffect, useState } from "react";
import { X, Minimize2, Maximize2 } from "lucide-react";
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
 */
export default function VideoModal({ seg, onClose }) {
  const [minimized, setMinimized] = useState(false);

  // Each newly-cited video opens full-size, even if the last one was minimized.
  useEffect(() => {
    setMinimized(false);
  }, [seg?.video_id, seg?.start_seconds]);

  useEffect(() => {
    if (minimized) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, minimized]);

  if (!seg) return null;

  const src = `https://www.youtube.com/embed/${seg.video_id}?start=${Math.max(
    0,
    Math.floor(seg.start_seconds || 0)
  )}&autoplay=1`;

  return (
    <div
      className={
        minimized
          ? "fixed bottom-4 right-4 z-50 w-64 sm:w-72"
          : "fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      }
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
        <div
          className={
            minimized
              ? "flex items-center justify-between bg-black/90 px-2 py-1.5"
              : "flex items-center justify-between mb-2"
          }
        >
          <p
            className={
              minimized
                ? "text-white text-[11px] font-medium truncate pr-2"
                : "text-white text-sm font-medium truncate pr-3"
            }
          >
            {cleanTitle(seg.sermon_title)}
          </p>
          <div
            className={
              minimized
                ? "flex items-center gap-1 flex-shrink-0"
                : "flex items-center gap-2 flex-shrink-0"
            }
          >
            {minimized ? (
              <button
                type="button"
                onClick={() => setMinimized(false)}
                aria-label="Expand"
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <Maximize2 size={12} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Minimize — keep watching while you study"
                title="Minimize — keep watching while you study"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <Minimize2 size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={
                minimized
                  ? "w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  : "w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              }
            >
              <X size={minimized ? 12 : 16} />
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
