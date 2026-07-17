// Declarations store the cited moment as a full YouTube watch URL with a
// timestamp (e.g. "https://youtube.com/watch?v=XXXX&t=42s"). The video modal
// needs the bare video_id + start_seconds to build an embed URL.
export function parseYoutubeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const video_id =
      u.hostname.includes("youtu.be")
        ? u.pathname.slice(1)
        : u.searchParams.get("v");
    if (!video_id) return null;
    const t = u.searchParams.get("t") || "";
    const start_seconds = parseInt(t, 10) || 0;
    return { video_id, start_seconds };
  } catch {
    return null;
  }
}
