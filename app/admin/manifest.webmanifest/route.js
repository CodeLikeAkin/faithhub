/**
 * The admin console's own web app manifest, at /admin/manifest.webmanifest and
 * linked from app/admin/layout.js (which replaces the member app's manifest on
 * these pages). It makes the console a second installable app: its own icon
 * (white logo on deep navy), launching straight into /admin, and its scope is
 * /admin so the member app and the console never swallow each other's links.
 *
 * Public on purpose: a browser fetches a manifest without the login cookie. It
 * holds nothing private. Icons come from scripts/pwa-icons.mjs.
 */
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    id: "/admin",
    name: "FaithHub Admin",
    short_name: "FH Admin",
    description: "FaithHub admin console: add sermons, check processing, publish series.",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#102A4E",
    theme_color: "#102A4E",
    lang: "en",
    icons: [
      { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/admin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
