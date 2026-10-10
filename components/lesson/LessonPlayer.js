"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { fmtTime } from "@/lib/ask-format";
import { cleanTitle } from "@/lib/titles";
import { DotGrid, Rings } from "@/components/Decor";
import { usePlayer } from "@/components/player/PlayerProvider";

/**
 * The lesson's own video, played in the page (the old workspace sent people
 * off to YouTube). A thumbnail facade until first play, so a lesson doesn't
 * load YouTube's player until it's wanted.
 *
 * `seek = { videoId, t, n }` — a request to play THIS video from `t`
 * seconds (a citation or declaration was tapped); `n` makes each request
 * unique. Once the player is up, seeks go over the YouTube IFrame API
 * (postMessage, enablejsapi=1), so the video jumps without reloading. The
 * player's own onReady / onError events come back the same way: a seek that
 * arrives early waits for onReady, and a video YouTube refuses to play here
 * (private, restricted) gets a plain explanation instead of YouTube's error.
 */

const YT_ORIGIN = "https://www.youtube.com";

const buildSrc = (videoId, start) => {
  const origin = typeof window !== "undefined" ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
  return `${YT_ORIGIN}/embed/${videoId}?enablejsapi=1&autoplay=1&playsinline=1&rel=0&cc_load_policy=0&start=${Math.max(
    0,
    Math.floor(start || 0)
  )}${origin}`;
};

export default function LessonPlayer({ videoId, title, startAt = 0, seek }) {
  // Only one video plays at a time. This player starting closes the app-wide
  // corner player (components/player/); the corner player starting pauses this.
  const { seg: cornerSeg, stop: stopCorner } = usePlayer();
  const [src, setSrc] = useState(null); // null → facade
  const [thumb, setThumb] = useState("maxresdefault"); // → hqdefault → none
  const [failed, setFailed] = useState(false);
  const [gen, setGen] = useState(0);
  const iframeRef = useRef(null);
  const ready = useRef(false);
  const queued = useRef(null); // a seek that arrived before the player was ready
  const lastVideo = useRef(videoId);
  const handledSeek = useRef(null);

  const post = (message) => iframeRef.current?.contentWindow?.postMessage(JSON.stringify(message), YT_ORIGIN);
  const command = (func, args = []) => post({ event: "command", func, args });
  const seekNow = (t) => {
    stopCorner();
    command("seekTo", [t, true]);
    command("playVideo");
  };
  // Phones: captions off (cc_load_policy=0 alone loses to a viewer's own YouTube
  // setting, so the captions module is unloaded too). Desktop keeps their choice.
  const captionsOff = () => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    command("unloadModule", ["captions"]);
    command("unloadModule", ["cc"]);
  };

  const mount = (t) => {
    stopCorner();
    ready.current = false;
    queued.current = null;
    setFailed(false);
    setSrc(buildSrc(videoId, t));
    // Same src again (the same moment tapped twice) must still rebuild the player.
    setGen((g) => g + 1);
  };

  useEffect(() => {
    const videoChanged = lastVideo.current !== videoId;
    lastVideo.current = videoId;
    const wantSeek = seek && seek.videoId === videoId && seek.n !== handledSeek.current;
    if (wantSeek) handledSeek.current = seek.n;

    if (videoChanged) {
      setThumb("maxresdefault");
      if (wantSeek) mount(seek.t);
      else {
        ready.current = false;
        queued.current = null;
        setFailed(false);
        setSrc(null);
      }
      return;
    }
    if (!wantSeek) return;
    if (!src) mount(seek.t);
    else if (ready.current) {
      // Phones only let a video start by itself when the player is created inside
      // the tap that asked for it. A postMessage play() sent to a player that is
      // already up has no tap behind it, so it seeks but stays paused. Rebuild
      // the player at the new time instead.
      const touch = window.matchMedia("(pointer: coarse)").matches;
      if (touch) mount(seek.t);
      else seekNow(seek.t);
    } else queued.current = seek.t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, seek]);

  // The corner player started a video: pause this one.
  useEffect(() => {
    if (cornerSeg) command("pauseVideo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cornerSeg]);

  // Events from the player (after the "listening" handshake sent on load).
  useEffect(() => {
    if (!src) return;
    const onMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      let data;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data?.event === "onStateChange" && data.info === 1) captionsOff();
      else if (data?.event === "onReady") {
        ready.current = true;
        captionsOff();
        if (queued.current != null) {
          const t = queued.current;
          queued.current = null;
          seekNow(t);
        }
      } else if (data?.event === "onError") {
        setFailed(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const onLoad = () => {
    post({ event: "listening", id: "lesson-player", channel: "widget" });
    // Belt and braces: if onReady never arrives, treat the player as ready
    // shortly after load so a queued seek still lands.
    setTimeout(() => {
      if (ready.current) return;
      ready.current = true;
      if (queued.current != null) {
        const t = queued.current;
        queued.current = null;
        seekNow(t);
      }
    }, 1500);
  };

  const youtubeHref = `https://www.youtube.com/watch?v=${videoId}`;

  if (!videoId) {
    return (
      <div className="grid aspect-video w-full place-items-center bg-brand-sky text-sm text-brand-gray sm:rounded-[1.5rem]">
        This message&rsquo;s video isn&rsquo;t available.
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden bg-brand-deep shadow-[0_30px_60px_-35px_rgba(16,42,78,0.6)] sm:rounded-[1.5rem]">
        {src ? (
          <iframe
            ref={iframeRef}
            key={`${src}#${gen}`}
            src={src}
            title={cleanTitle(title) || "Message video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={onLoad}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => mount(startAt)}
            aria-label={startAt ? `Play from ${fmtTime(startAt)}` : "Play this message"}
            className="group absolute inset-0 block h-full w-full focus-visible:outline-none"
          >
            {thumb !== "none" ? (
              <img
                src={`https://img.youtube.com/vi/${videoId}/${thumb}.jpg`}
                alt=""
                // YouTube answers a missing size with a 120px grey stand-in:
                // step down to hqdefault, then to the plain navy panel.
                onLoad={(e) =>
                  e.currentTarget.naturalWidth <= 120 && setThumb(thumb === "maxresdefault" ? "hqdefault" : "none")
                }
                onError={() => setThumb(thumb === "maxresdefault" ? "hqdefault" : "none")}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
            ) : (
              <span aria-hidden="true" className="absolute inset-0">
                <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
                <Rings className="absolute left-1/2 top-1/2 h-[140%] w-auto -translate-x-1/2 -translate-y-1/2 text-white/[0.07]" />
              </span>
            )}
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-brand-navy shadow-lg shadow-black/30 transition-transform group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-white/60 sm:h-14 sm:w-14">
                <Play className="h-5 w-5 translate-x-0.5 fill-current sm:h-6 sm:w-6" aria-hidden="true" />
              </span>
            </span>
          </button>
        )}

        {failed && (
          <div role="alert" className="absolute inset-0 grid place-items-center bg-brand-deep p-6 text-center text-white">
            <div className="max-w-sm">
              <p className="font-display text-2xl font-medium">This video can&rsquo;t play here</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                YouTube won&rsquo;t show it inside other sites — it may be private or restricted. The notes,
                scriptures and declarations below still come from this message.
              </p>
              <a
                href={youtubeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-sky"
              >
                Try it on YouTube <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
