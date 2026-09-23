// Scrolling inside the tool pages' own overflow containers. scrollIntoView()
// and relative scrollBy() proved unreliable across these nested containers
// (Chrome's scroll anchoring nudges scrollTop on its own when off-screen
// content resizes), so this walks up to the real scroll parent and scrolls it
// to an ABSOLUTE target instead.

export function scrollParent(el) {
  let node = el?.parentElement;
  while (
    node &&
    !(
      /(auto|scroll)/.test(getComputedStyle(node).overflowY) &&
      node.scrollHeight > node.clientHeight
    )
  ) {
    node = node.parentElement;
  }
  return node || null;
}

/**
 * Scroll `el` into its scroll parent.
 *   align "start"   — put its top `offset` px below the container's top
 *   align "nearest" — only move if it isn't fully visible already
 * With `nested`, every scrolling ancestor is brought along too (e.g. a card
 * inside a scrollable margin column inside the scrolling document).
 */
export function scrollToElement(el, { offset = 12, align = "start", smooth = true, nested = false } = {}) {
  if (!el) return;
  if (nested) {
    let target = el;
    while (target) {
      scrollOne(target, { offset, align, smooth });
      target = scrollParent(target);
    }
    return;
  }
  scrollOne(el, { offset, align, smooth });
}

function scrollOne(el, { offset, align, smooth }) {
  const parent = scrollParent(el);
  if (!parent) return;

  const elTop =
    el.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop;
  let top = elTop - offset;

  if (align === "nearest") {
    const viewTop = parent.scrollTop;
    const viewBottom = viewTop + parent.clientHeight;
    const elBottom = elTop + el.offsetHeight;
    if (elTop >= viewTop + offset && elBottom <= viewBottom - offset) return;
    top = elTop < viewTop + offset ? elTop - offset : elBottom - parent.clientHeight + offset;
  }

  top = Math.max(0, Math.round(top));
  const from = parent.scrollTop;
  parent.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });

  // Some embedded browsers ignore smooth scrolling entirely — if nothing has
  // moved shortly after, jump straight there.
  if (smooth && Math.abs(from - top) > 2) {
    setTimeout(() => {
      if (parent.scrollTop === from) parent.scrollTop = top;
    }, 350);
  }
}

/**
 * Run once the DOM React just committed has been laid out: two animation
 * frames — or a short timer, whichever comes first, because frames are
 * paused when the page isn't being painted (a backgrounded or embedded view)
 * and the scroll must not wait on one. Callers run from effects, so the new
 * content is already in the DOM either way.
 */
export function afterLayout(fn) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    fn();
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
  setTimeout(run, 120);
}
