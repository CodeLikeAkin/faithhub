"use client";

import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";

/*
 * Drag-to-reorder for a vertical list, with no dependencies.
 *
 * Mouse, touch and pen all go through Pointer Events on a grip handle. The
 * arrow keys move a focused handle one place. While a row is dragged, the
 * transforms are written straight to the DOM (no React render per pointer
 * move); React only hears about the result, once, through `onMove`.
 *
 *   const { itemRef, handleProps } = useSortableList({ ids, onMove });
 *   <li ref={itemRef(id)}>  <button {...handleProps(id)} />  </li>
 *
 * The dragged row carries `data-dragging="true"` so it can be styled with
 * Tailwind's `data-[dragging=true]:` variants.
 */

const EDGE = 96; // px from the top/bottom of the window where auto-scroll starts
const MAX_SCROLL = 20; // px per 16ms tick at the very edge
const SETTLE_MS = 180;
const EASE = "cubic-bezier(.2,.8,.2,1)";

const settleMs = () => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : SETTLE_MS);
const translate = (px) => (px ? `translate3d(0, ${px}px, 0)` : "");

export function moveItem(list, from, to) {
  const next = list.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

function createEngine(items, latest, refocus) {
  let drag = null;

  /** Position every row for the current pointer: the dragged one follows it, the rest make room. */
  function paint() {
    const d = drag;
    if (!d || d.settling) return;
    const dy = d.y - d.startY + (window.scrollY - d.startScroll);
    const center = d.mids[d.from] + dy;
    let to = 0;
    d.mids.forEach((mid, i) => {
      if (i !== d.from && mid < center) to++;
    });
    d.to = to;
    d.ids.forEach((id, i) => {
      const el = items.get(id);
      if (!el) return;
      let shift = 0;
      if (i === d.from) shift = dy;
      else if (d.from < to && i > d.from && i <= to) shift = -d.heights[d.from];
      else if (d.from > to && i < d.from && i >= to) shift = d.heights[d.from];
      el.style.transform = translate(shift);
    });
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.y = e.clientY;
    paint();
  }
  const onUp = () => settle(true);
  const onCancel = () => settle(false);
  const onKey = (e) => e.key === "Escape" && settle(false);

  function detach() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("scroll", paint);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }

  /** End the drag. `commit` false (Escape, cancelled) slides everything back. */
  function settle(commit) {
    const d = drag;
    if (!d || d.settling) return;
    d.settling = true;
    detach();
    clearInterval(d.timer);

    const { from, to, heights } = d;
    const ms = settleMs();
    let offset = 0;
    if (commit && to > from) for (let i = from + 1; i <= to; i++) offset += heights[i];
    if (commit && to < from) for (let i = to; i < from; i++) offset -= heights[i];

    // The dragged row slides into the slot it hovers over; rows that made room already sit in place.
    d.ids.forEach((id, i) => {
      const el = items.get(id);
      if (!el) return;
      if (i === from) {
        el.style.transition = `transform ${ms}ms ${EASE}`;
        el.style.transform = translate(offset);
      } else if (!commit) {
        el.style.transform = "";
      }
    });

    d.done = setTimeout(() => {
      // Commit the new order and clear every transform in the same frame, so nothing flashes.
      if (commit && to !== from) {
        flushSync(() => latest.current.onMove(moveItem(d.ids, from, to), { id: d.ids[from], from, to }));
        refocus.current = d.ids[from];
      }
      d.ids.forEach((id) => {
        const el = items.get(id);
        if (!el) return;
        el.style.transition = el.style.transform = el.style.willChange = el.style.position = el.style.zIndex = "";
        delete el.dataset.dragging;
      });
      drag = null;
    }, ms);
  }

  function start(e, id) {
    const { ids, disabled } = latest.current;
    if (disabled || drag) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const from = ids.indexOf(id);
    const els = ids.map((k) => items.get(k));
    if (from < 0 || els.some((el) => !el)) return;
    e.preventDefault();

    const rects = els.map((el) => el.getBoundingClientRect());
    const d = (drag = {
      ids,
      from,
      to: from,
      pointerId: e.pointerId,
      y: e.clientY,
      startY: e.clientY,
      startScroll: window.scrollY,
      heights: rects.map((r) => r.height),
      mids: rects.map((r) => r.top + window.scrollY + r.height / 2),
      settling: false,
      timer: null,
      done: null,
    });

    const ms = settleMs();
    els.forEach((el, i) => {
      el.style.willChange = "transform";
      el.style.transition = i === from ? "none" : `transform ${ms}ms ${EASE}`;
    });
    els[from].style.position = "relative";
    els[from].style.zIndex = "20";
    els[from].dataset.dragging = "true";
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", paint, { passive: true });

    // Scroll the page while the pointer is held near its top or bottom edge.
    d.timer = setInterval(() => {
      const vh = window.innerHeight;
      let step = 0;
      if (d.y < EDGE) step = -MAX_SCROLL * Math.min(1, (EDGE - d.y) / EDGE);
      else if (d.y > vh - EDGE) step = MAX_SCROLL * Math.min(1, (d.y - (vh - EDGE)) / EDGE);
      if (step) {
        window.scrollBy({ top: step, behavior: "instant" }); // <html> is scroll-smooth
        paint();
      }
    }, 16);
  }

  /** Arrow keys on a focused handle: move one place, no drag. */
  function keyDown(e, id) {
    const { ids, onMove, disabled } = latest.current;
    if (disabled || drag) return;
    const dir = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    const from = ids.indexOf(id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= ids.length) return;
    refocus.current = id;
    onMove(moveItem(ids, from, to), { id, from, to });
  }

  /** Leaving mid-drag must not leave listeners or a locked body behind. */
  function dispose() {
    if (!drag) return;
    clearInterval(drag.timer);
    clearTimeout(drag.done);
    detach();
    drag = null;
  }

  return { start, keyDown, dispose };
}

export function useSortableList({ ids, onMove, disabled = false }) {
  const items = useRef(new Map()); // id -> row element
  const handles = useRef(new Map()); // id -> handle element
  const refocus = useRef(null);
  const latest = useRef({});
  latest.current = { ids, onMove, disabled };

  const engine = useRef(null);
  if (!engine.current) engine.current = createEngine(items.current, latest, refocus);

  // A keyboard move makes React re-insert the row, which drops focus; put it back.
  useEffect(() => {
    if (refocus.current) handles.current.get(refocus.current)?.focus();
    refocus.current = null;
  });
  useEffect(() => () => engine.current.dispose(), []);

  const track = (map, id) => (el) => {
    if (el) map.set(id, el);
    else map.delete(id);
  };

  return {
    itemRef: (id) => track(items.current, id),
    handleProps: (id) => ({
      ref: track(handles.current, id),
      onPointerDown: (e) => engine.current.start(e, id),
      onKeyDown: (e) => engine.current.keyDown(e, id),
      onContextMenu: (e) => e.preventDefault(), // a touch long-press must not open a menu mid-drag
      style: { touchAction: "none" },
    }),
  };
}
