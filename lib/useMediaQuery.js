import { useEffect, useState } from "react";

/**
 * Live `matchMedia` result. Always false on the server and the first client
 * render (so hydration matches), then settles in an effect — lay out the
 * default state with CSS breakpoints and use this only for behaviour.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);

  return matches;
}

/** The breakpoint at which tool pages dock the Ask panel as a column (xl). */
export const PANEL_DOCKED_QUERY = "(min-width: 1280px)";
