import { BACKGROUND_COLOR, SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from "@/lib/site";

/**
 * The web app manifest, served at /manifest.webmanifest and linked from every
 * page by app/layout.js. It's what makes "Add to Home Screen" install a real
 * app: our icon, a full-screen launch with no browser bar, and a white launch
 * screen with the navy logo.
 *
 * A route handler, not Next's app/manifest.js file: a file-based manifest
 * can't be replaced by a nested layout, and /admin needs its own (see
 * app/admin/manifest.webmanifest). Same for the iOS icon, which is
 * public/icons/apple-180.png.
 *
 * No `orientation`: locking it would break landscape on iPad, where the app is
 * reviewed. Icons are drawn by scripts/pwa-icons.mjs.
 */
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    id: "/",
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
