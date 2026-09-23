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
 */
export default function YtThumb({ ids, quality = "hqdefault", className, fallback = null }) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  const [index, setIndex] = useState(0);
  const [ok, setOk] = useState(false);
  const ref = useRef(null);
  const judged = useRef(null);
  const id = list[index];

  const judge = (img) => {
    if (!img || judged.current === id) return;
    judged.current = id;
    if (img.naturalWidth > 120) setOk(true);
    else setIndex((i) => i + 1);
  };

  // A cached image can finish loading before React attaches onLoad.
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth) judge(ref.current);
  });

  if (!id) return fallback;
  return (
    <img
      key={id}
      ref={ref}
      src={`https://img.youtube.com/vi/${id}/${quality}.jpg`}
      alt=""
      loading="lazy"
      onLoad={(e) => judge(e.currentTarget)}
      onError={() => {
        judged.current = id;
        setIndex((i) => i + 1);
      }}
      className={cn(className, !ok && "invisible")}
    />
  );
}
