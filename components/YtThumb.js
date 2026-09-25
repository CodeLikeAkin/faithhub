"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A YouTube thumbnail that skips dead videos. A deleted or private video still
 * "loads": YouTube answers with a 120×90 grey placeholder (a 404 carrying an
 * image body), so onError alone never fires. Given several ids (e.g. every
 * part of a series), try each in turn until one has a real thumbnail; if none
 * does, render `fallback`. The <img> stays invisible until a load is confirmed,
 * so the grey placeholder never flashes.
 *
 * `quality` may be a list, tried in order for each id before moving to the
 * next id. That matters because the sizes are not the same shape: hqdefault
 * and sddefault are 4:3 with black letterbox bars baked into a 16:9 frame,
 * while maxresdefault (1280×720), hq720 and mqdefault (320×180) are true
 * 16:9. Anywhere the art is shown large, ask for the 16:9 ladder — a 4:3
 * source only hides its bars when the box it fills is exactly 16:9.
 * maxresdefault and hq720 are missing on older or lower-resolution uploads,
 * which is what the ladder is for; mqdefault always exists.
 */
export default function YtThumb({ ids, quality = "hqdefault", className, fallback = null }) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  const sizes = Array.isArray(quality) ? quality : [quality];
  // Every (id, size) pair, id-major: exhaust one video's sizes before giving
  // up on it, since a dead video fails at every size anyway.
  const tries = list.flatMap((id) => sizes.map((size) => ({ id, size })));

  const [index, setIndex] = useState(0);
  const [ok, setOk] = useState(false);
  const ref = useRef(null);
  const judged = useRef(null);
  const attempt = tries[index];
  const key = attempt && `${attempt.id}/${attempt.size}`;

  const judge = (img) => {
    if (!img || judged.current === key) return;
    judged.current = key;
    if (img.naturalWidth > 120) setOk(true);
    else setIndex((i) => i + 1);
  };

  // A cached image can finish loading before React attaches onLoad.
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth) judge(ref.current);
  });

  if (!attempt) return fallback;
  return (
    <img
      key={key}
      ref={ref}
      src={`https://img.youtube.com/vi/${attempt.id}/${attempt.size}.jpg`}
      alt=""
      loading="lazy"
      onLoad={(e) => judge(e.currentTarget)}
      onError={() => {
        judged.current = key;
        setIndex((i) => i + 1);
      }}
      className={cn(className, !ok && "invisible")}
    />
  );
}
