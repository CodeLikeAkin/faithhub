"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import VideoModal from "@/components/VideoModal";

/**
 * The one video player for the whole app, mounted in app/layout.js.
 *
 * It used to be rendered by each page that cited a moment, so changing page
 * unmounted it and the video stopped. Living in the layout, it survives
 * in-app navigation: a full-size video shrinks to the draggable corner
 * mini-player when the page changes, and keeps playing.
 *
 * Pages ask for a video through `usePlayer().play(seg, { minimized })`. Each
 * call should hand over a fresh seg object (`play` copies it) so tapping the
 * same moment twice still counts as a new request. Only one video exists at a
 * time: a new `play` swaps the video in place, and a lesson page's own
 * embedded player calls `stop()` when it starts (see LessonPlayer).
 */

const PlayerContext = createContext({
  seg: null,
  minimized: false,
  play: () => {},
  watch: () => {},
  stop: () => {},
});

export const usePlayer = () => useContext(PlayerContext);

export default function PlayerProvider({ children }) {
  const [seg, setSeg] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const segRef = useRef(null);
  const pathname = usePathname();

  const stop = useCallback(() => {
    segRef.current = null;
    setSeg(null);
    setMinimized(false);
  }, []);

  const play = useCallback(
    (next, opts) => {
      if (!next?.video_id) {
        if (!next) stop();
        return;
      }
      // Only a fresh open picks the size. A player that is already up (maybe
      // minimized, maybe dragged) just swaps the video and keeps its state.
      if (!segRef.current) setMinimized(!!opts?.minimized);
      segRef.current = { ...next };
      setSeg(segRef.current);
    },
    [stop]
  );

  // Changing page shrinks a full-size video to the corner so it keeps playing
  // while the reader moves on. (The first render is not a change.)
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (segRef.current) setMinimized(true);
  }, [pathname]);

  // `watch` is `play` with exactly one argument, for handing straight to an
  // `onWatch={...}` prop that may call back with extra arguments.
  const watch = useCallback((s) => play(s), [play]);

  const value = useMemo(
    () => ({ seg, minimized, play, watch, stop }),
    [seg, minimized, play, watch, stop]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <VideoModal seg={seg} onClose={stop} minimized={minimized} onMinimizedChange={setMinimized} />
    </PlayerContext.Provider>
  );
}
