import { useEffect, useState } from "react";

/**
 * Track how many pixels the on-screen (iOS/Android) keyboard overlaps the
 * bottom of the layout viewport. Docked composers sit at the bottom of an
 * h-dvh column, which the software keyboard buries; lift the composer by this
 * inset (e.g. `transform: translateY(-inset)`) so the input stays visible.
 *
 * Returns 0 on desktop and whenever the keyboard is closed, so callers can
 * apply it unconditionally.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;

    // Overlap = how much of the layout viewport the visual viewport no longer
    // covers at the bottom. innerHeight stays full-height on iOS while the
    // visual viewport shrinks by the keyboard's height.
    const update = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      setInset(overlap > 1 ? Math.round(overlap) : 0);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
