import { BACKGROUND_COLOR, SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from "@/lib/site";

/**
 * The web app manifest, served at /manifest.webmanifest and linked from every
 * page by Next. It's what makes "Add to Home Screen" install a real app: our
 * icon, a full-screen launch with no browser bar, and a white launch screen
 * with the navy logo.
 *
 * No `orientation`: locking it would break landscape on iPad, where the app is
 * reviewed. Icons are drawn by scripts/pwa-icons.mjs; the iOS icon is
 * app/apple-icon.png (iOS ignores manifest icons).
 */
export default function manifest() {
  return {
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
}
