// Installable-app plumbing: the service worker, the install prompt, and the
// iOS "Add to Home Screen" sheet. No React in here — app/layout.js (a server
// component) imports the inline script below. Hooks are in lib/useInstall.js.

const INSTALL_EVENT = "fh:install";

/**
 * Inlined in <head> by app/layout.js. Chrome / Edge / Android fire
 * `beforeinstallprompt` once the app is installable, which can be before
 * React hydrates, so it's caught here and held on window for the "Install
 * app" button. preventDefault keeps Android's own mini-infobar from popping
 * up over whatever page is open (the Ask composer, say); we offer install on
 * Home and in the sidebar instead. iOS never fires it — see the sheet below.
 */
export const INSTALL_CAPTURE_SCRIPT = `(function(){function n(){window.dispatchEvent(new Event("${INSTALL_EVENT}"))}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__fhInstall=e;n()});window.addEventListener("appinstalled",function(){window.__fhInstall=null;n()})})();`;

const notify = () => window.dispatchEvent(new Event(INSTALL_EVENT));

/** Opened from the home-screen icon (no browser bar). */
export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

/** iPhone, iPod, or iPad — iPadOS Safari reports itself as a Mac, but a Mac has no touch screen. */
export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Facebook / Instagram / LINE's built-in browsers, which can't add to the Home Screen. */
export function isInAppBrowser() {
  return /FBAN|FBAV|Instagram|Line\//.test(navigator.userAgent);
}

/**
 * How this browser installs, or null when it can't (or already has):
 * "prompt" — Chrome / Edge / Android is holding an install prompt;
 * "ios"    — Add to Home Screen by hand, so we show the steps.
 */
export function installKind() {
  if (isStandalone()) return null;
  if (window.__fhInstall) return "prompt";
  if (isIos()) return "ios";
  return null;
}

export function subscribeInstall(onChange) {
  const standalone = window.matchMedia("(display-mode: standalone)");
  window.addEventListener(INSTALL_EVENT, onChange);
  standalone.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener(INSTALL_EVENT, onChange);
    standalone.removeEventListener?.("change", onChange);
  };
}

/** Show the browser's install prompt, or on iOS the Add to Home Screen steps. */
export async function installApp() {
  const prompt = window.__fhInstall;
  if (prompt) {
    window.__fhInstall = null; // a prompt can be shown once; Chrome sends a new one if it's declined
    notify();
    prompt.prompt();
    return (await prompt.userChoice).outcome;
  }
  if (isIos()) iosSheet.open();
  return null;
}

// ── The iOS sheet's open state (rendered once, by components/pwa/PwaRoot) ─────
let sheetOpen = false;
const sheetListeners = new Set();
const setSheet = (open) => {
  sheetOpen = open;
  sheetListeners.forEach((l) => l());
};
export const iosSheet = {
  open: () => setSheet(true),
  close: () => setSheet(false),
  isOpen: () => sheetOpen,
  subscribe(listener) {
    sheetListeners.add(listener);
    return () => sheetListeners.delete(listener);
  },
};

// ── The Home page's install card: once, then quiet for 30 days ───────────────
const NUDGE_KEY = "hof-install-nudge";
const NUDGE_QUIET_MS = 30 * 24 * 60 * 60 * 1000;

export function nudgeDue() {
  try {
    return Date.now() - Number(localStorage.getItem(NUDGE_KEY) || 0) > NUDGE_QUIET_MS;
  } catch {
    return false;
  }
}

export function quietNudge() {
  try {
    localStorage.setItem(NUDGE_KEY, String(Date.now()));
  } catch {
    /* storage unavailable — it just shows again next visit */
  }
}

// ── Service worker ────────────────────────────────────────────────────────────

/**
 * Production only. `next dev` serves its scripts at stable, uncached paths
 * that change on every edit — a worker there would only get in the way — so
 * in development any worker left on this origin by a production test is
 * removed instead. The build id in the URL makes each deploy install a fresh
 * worker (NEXT_PUBLIC_BUILD_ID, next.config.mjs).
 */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") {
    navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((r) => r.unregister()));
    // Every load, not just when a worker is found: one still controlling the
    // page while it unregisters can write a cache back after it's deleted.
    window.caches?.keys().then((names) => names.filter((n) => n.startsWith("fh-")).forEach((n) => caches.delete(n)));
    return;
  }
  const register = () =>
    navigator.serviceWorker
      .register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID}`, { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  // After load, so installing it never competes with the first paint.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
