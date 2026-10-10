/*
 * FaithHub service worker — hand-written, no build step. Registered by
 * lib/pwa.js (production only) as /sw.js?v=<build id>, so every deploy
 * installs a fresh copy, which re-saves the offline pages below.
 *
 * What it caches:
 *   precache       the offline page, the logo and an icon; must succeed or the
 *                  worker doesn't install
 *   pages          page loads, network first; the saved copy when the
 *                  network fails or is too slow
 *   static         /_next/static (hashed scripts, CSS, fonts): cache first —
 *                  a hashed file never changes
 *   images         same-origin images: served from cache, refreshed behind
 *
 * What it never touches: anything that isn't a same-origin GET (YouTube
 * embeds, Supabase, the Bible API, every POST), every /api/ route — the
 * streamed AI answers (/api/ask, /api/series-chat, /api/declarations,
 * /api/series-summary, /api/search), /api/feedback and /api/admin/* — and the
 * router's own data requests. Admin pages go to the network and are never
 * saved.
 *
 * The member's own data (saved declarations, streak, studies) is in
 * localStorage, not here; caching the pages that read it is what makes it
 * readable offline.
 */

// Bump only when the caching rules change: activation deletes every fh-
// cache not named here.
const VERSION = "v1";
const PRECACHE = `fh-precache-${VERSION}`;
const PAGES = `fh-pages-${VERSION}`;
const STATIC = `fh-static-${VERSION}`;
const IMAGES = `fh-images-${VERSION}`;
const CURRENT = [PRECACHE, PAGES, STATIC, IMAGES];

// Oldest entries go first once a cache passes its limit.
const LIMITS = { [PAGES]: 40, [STATIC]: 300, [IMAGES]: 120 };

const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/hofng-logo.svg", "/icons/icon-192.png"];

// Saved at install with their scripts and styles, so they open offline even
// if the member never visited them after installing: the home screen's start
// page, and the two that show what's saved on the device.
const WARM_PAGES = ["/", "/declarations", "/declarations/mine", "/ask"];

// A page slower than this is answered from the saved copy, if there is one;
// the network response still lands in the cache for next time.
const NAV_TIMEOUT_MS = 5000;

const NEVER = [/^\/api\//, /^\/_next\/webpack-hmr/, /^\/_vercel\//, /^\/__nextjs/];
const IMAGE_FILE = /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i;
// Script / style / font paths in a page's HTML — both <script src> and the
// "static/chunks/…" references inside the inline router payload.
const ASSET_PATH = /(?:\/_next\/)?(static\/(?:chunks|css|media)\/[^"'\s\\<>()]+?\.(?:js|css|woff2?))/g;
// Fonts are named only inside the CSS, which lists every language subset
// (55 files). next/font marks the ones pages actually load with ".p." —
// those three are all a page needs.
const PRELOAD_FONT = /\/_next\/static\/media\/[^)"'\s]+\.p\.woff2/g;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" })));
      await warm();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Lets the page request start while the worker is still waking up.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("fh-") && !CURRENT.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (NEVER.some((re) => re.test(url.pathname))) return;
  if (request.headers.has("RSC") || url.searchParams.has("_rsc") || request.headers.has("Range")) return;

  if (request.mode === "navigate") return page(event, url);
  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(cacheFirst(event));
  if (request.destination === "image" || url.pathname === "/_next/image" || IMAGE_FILE.test(url.pathname)) {
    return event.respondWith(staleWhileRevalidate(event));
  }
});

// ── Pages: network first ──────────────────────────────────────────────────────

function page(event, url) {
  const keep = !url.pathname.startsWith("/admin");
  const fromNetwork = Promise.resolve(event.preloadResponse).then((preloaded) => preloaded || fetch(event.request));
  // Saved off a copy so the page itself still streams in.
  const saved = fromNetwork.then((response) => (keep && cacheable(response) ? put(PAGES, event.request, response.clone()) : null));
  event.waitUntil(saved.catch(() => {}));
  event.respondWith(answerPage(fromNetwork, keep ? savedPage(event.request) : Promise.resolve(undefined)));
}

async function answerPage(fromNetwork, saved) {
  let timer;
  const slow = new Promise((resolve) => (timer = setTimeout(resolve, NAV_TIMEOUT_MS, "slow")));
  try {
    const first = await Promise.race([fromNetwork, slow]);
    if (first !== "slow") return first;
    return (await saved) || (await fromNetwork);
  } catch {
    return (await saved) || (await caches.match(OFFLINE_URL)) || Response.error();
  } finally {
    clearTimeout(timer);
  }
}

async function savedPage(request) {
  const cache = await caches.open(PAGES);
  // Exact URL first; then the same page under any query (/ask?study=… is the
  // /ask page — it reads the query itself).
  return (
    (await cache.match(request, { ignoreVary: true })) ||
    (await cache.match(request, { ignoreVary: true, ignoreSearch: true }))
  );
}

// ── Assets ────────────────────────────────────────────────────────────────────

async function cacheFirst(event) {
  const hit = await caches.match(event.request);
  if (hit) return hit;
  const response = await fetch(event.request);
  if (immutable(response)) event.waitUntil(put(STATIC, event.request, response.clone()));
  return response;
}

async function staleWhileRevalidate(event) {
  const hit = await caches.match(event.request);
  const refresh = fetch(event.request).then((response) => {
    if (cacheable(response)) event.waitUntil(put(IMAGES, event.request, response.clone()));
    return response;
  });
  if (!hit) return refresh;
  event.waitUntil(refresh.catch(() => {}));
  return hit;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cacheable(response) {
  return response && response.status === 200 && response.type === "basic" && !response.redirected;
}

// Only a file the server marks immutable (every production build); `next dev`
// serves the same paths uncacheable, and they change on every edit.
function immutable(response) {
  return cacheable(response) && /immutable/.test(response.headers.get("Cache-Control") || "");
}

async function put(name, request, response) {
  const cache = await caches.open(name);
  await cache.put(request, response);
  const limit = LIMITS[name];
  if (!limit) return;
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}

/** Save WARM_PAGES and every script, stylesheet and font they load. Best effort. */
async function warm() {
  const assets = new Set();
  await Promise.allSettled(
    WARM_PAGES.map(async (path) => {
      const response = await fetch(path, { cache: "reload" });
      if (!cacheable(response)) return;
      const html = await response.clone().text();
      await put(PAGES, path, response);
      for (const match of html.matchAll(ASSET_PATH)) assets.add(`/_next/${match[1]}`);
    })
  );
  const fonts = new Set();
  await Promise.allSettled(
    [...assets].map(async (path) => {
      const response = await saveStatic(path);
      if (response && path.endsWith(".css")) {
        for (const match of (await response.text()).matchAll(PRELOAD_FONT)) fonts.add(match[0]);
      }
    })
  );
  await Promise.allSettled([...fonts].map(saveStatic));
}

async function saveStatic(path) {
  const hit = await caches.match(path);
  if (hit) return hit;
  const response = await fetch(path);
  if (!immutable(response)) return null;
  await put(STATIC, path, response.clone());
  return response;
}

// ── Push: groundwork only ─────────────────────────────────────────────────────
// Nothing subscribes yet, so no push can arrive. When it's switched on (iOS
// needs 16.4+, the app opened from its home-screen icon, and permission asked
// from a tap), the server sends JSON { title, body, url }.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "FaithHub", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).pathname === target.pathname);
      return open ? open.focus() : self.clients.openWindow(target.href);
    })()
  );
});
