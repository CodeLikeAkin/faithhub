/** @type {import('next').NextConfig} */
const nextConfig = {
  // A second dev server in the same folder (e.g. a preview next to your own)
  // can set NEXT_DIST_DIR so the two don't overwrite each other's build files.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // New on every build, so each deploy installs a fresh service worker
  // (registered as /sw.js?v=<this>), which re-saves the offline pages.
  env: {
    NEXT_PUBLIC_BUILD_ID: String(Date.now()),
  },
  // The admin console and its API are private: never cached, never indexed.
  async headers() {
    const privateHeaders = [
      { key: 'Cache-Control', value: 'no-store' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ];
    return [
      { source: '/admin/:path*', headers: privateHeaders },
      { source: '/api/admin/:path*', headers: privateHeaders },
    ];
  },
};

export default nextConfig;
