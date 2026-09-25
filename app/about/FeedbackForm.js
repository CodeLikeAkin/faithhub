"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, ImagePlus, Loader2, Send, X } from "lucide-react";
import { clientIdHeader } from "@/lib/client-id";
import { cn } from "@/lib/utils";

const KINDS = [
  { value: "general", label: "General feedback" },
  { value: "idea", label: "An idea" },
  { value: "problem", label: "Something's broken" },
  { value: "testimony", label: "A testimony" },
];

// Screenshots are shrunk in the browser before upload: a phone or desktop
// screenshot is often 2-5 MB as PNG, but a 1920px JPEG of the same thing is a
// few hundred KB and just as readable. That keeps three of them comfortably
// under Vercel's 4.5 MB request limit. The API route re-checks all of this.
const MAX_SHOTS = 3;
const MAX_EDGE = 1920;
const TARGET_BYTES = 1.2 * 1024 * 1024;

// Where the visitor was before /about. A bug report is far more useful with
// it, and asking "which page?" in the form is a question most people skip.
// Same-origin only — we don't record where else on the web they've been.
function originPage() {
  if (typeof document === "undefined") return null;
  try {
    const ref = document.referrer;
    if (!ref) return null;
    const url = new URL(ref);
    return url.origin === window.location.origin ? url.pathname : null;
  } catch {
    return null;
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

// Redraw onto a canvas as JPEG, stepping down size/quality until it fits.
// White fill first, so a transparent PNG doesn't turn black in JPEG.
async function shrink(file) {
  const img = await loadImage(file);
  const steps = [
    [MAX_EDGE, 0.85],
    [1600, 0.75],
    [1280, 0.7],
  ];
  for (const [edge, quality] of steps) {
    const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= TARGET_BYTES) return blob;
  }
  throw new Error("too-large");
}

export default function FeedbackForm() {
  const [kind, setKind] = useState("general");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — see the API route
  const [shots, setShots] = useState([]); // [{ id, blob, url }]
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [shotError, setShotError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");
  const fileInput = useRef(null);

  // Preview URLs hold the image in memory until revoked. Keep the latest list
  // in a ref so the unmount cleanup sees it, not the first render's copy.
  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const clearShots = () => {
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
  };

  const removeShot = (id) => {
    setShots((prev) => {
      const gone = prev.find((s) => s.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((s) => s.id !== id);
    });
    setShotError("");
  };

  const addFiles = async (fileList) => {
    const images = [...fileList].filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      setShotError("That isn't an image. Please attach a screenshot.");
      return;
    }

    const room = MAX_SHOTS - shots.length;
    if (room <= 0) {
      setShotError(`You can attach up to ${MAX_SHOTS} screenshots.`);
      return;
    }

    setAdding(true);
    setShotError(
      images.length > room ? `Only the first ${room} were added. The limit is ${MAX_SHOTS}.` : ""
    );

    const added = [];
    for (const file of images.slice(0, room)) {
      try {
        const blob = await shrink(file);
        added.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, blob, url: URL.createObjectURL(blob) });
      } catch (err) {
        setShotError(
          err.message === "too-large"
            ? "That image is too large even after shrinking it. Try cropping it first."
            : "Couldn't read that image. Try saving it as a PNG or JPG."
        );
      }
    }
    setShots((prev) => [...prev, ...added].slice(0, MAX_SHOTS));
    setAdding(false);
  };

  // Paste a screenshot straight from the clipboard, anywhere in the form.
  // Only intercept when the clipboard actually holds an image, so pasting
  // text into the message box behaves normally.
  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    e.preventDefault();
    addFiles(files);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (status === "sending" || adding) return;

    setStatus("sending");
    setError("");

    const body = new FormData();
    body.append("kind", kind);
    body.append("name", name);
    body.append("email", email);
    body.append("message", message);
    body.append("website", website);
    const page = originPage();
    if (page) body.append("page", page);
    shots.forEach((s, i) => body.append("screenshots", s.blob, `screenshot-${i + 1}.jpg`));

    try {
      // No Content-Type header: the browser sets the multipart boundary itself.
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: clientIdHeader(),
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("sent");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="rounded-[1.5rem] border border-brand-navy/10 bg-white p-8 text-center sm:p-12">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-sky text-brand-navy">
          <Check className="h-7 w-7" aria-hidden="true" />
        </span>
        <h3 className="mt-5 font-display text-2xl text-brand-ink">
          Thank you. We&apos;ve received it.
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-brand-gray">
          {email
            ? "If it needs a reply, you'll hear back at the address you left."
            : "You didn't leave an email, so we can't reply. Send another note with one if you'd like an answer."}
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setMessage("");
            setKind("general");
            clearShots();
            setShotError("");
          }}
          className="mt-6 text-sm font-bold text-brand-navy underline underline-offset-4 hover:text-brand-deep"
        >
          Send another
        </button>
      </div>
    );
  }

  const inputClasses =
    "w-full rounded-xl border border-brand-navy/15 bg-white px-4 py-3 text-base text-brand-ink placeholder:text-brand-gray/70 transition-colors focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20";

  const full = shots.length >= MAX_SHOTS;

  return (
    <form
      onSubmit={submit}
      onPaste={onPaste}
      className="relative rounded-[1.5rem] border border-brand-navy/10 bg-white p-6 sm:p-8"
    >
      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-[0.16em] text-brand-navy">
          What&apos;s this about?
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k.value}
              className={cn(
                "cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-brand-navy/30",
                kind === k.value
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-brand-navy/15 bg-white text-brand-gray hover:border-brand-navy/40 hover:text-brand-ink"
              )}
            >
              <input
                type="radio"
                name="kind"
                value={k.value}
                checked={kind === k.value}
                onChange={() => setKind(k.value)}
                className="sr-only"
              />
              {k.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fb-name" className="block text-sm font-medium text-brand-ink">
            Your name <span className="font-normal text-brand-gray">(optional)</span>
          </label>
          <input
            id="fb-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            className={cn(inputClasses, "mt-1.5")}
            placeholder="Sister Ada"
          />
        </div>
        <div>
          <label htmlFor="fb-email" className="block text-sm font-medium text-brand-ink">
            Email <span className="font-normal text-brand-gray">(only if you want a reply)</span>
          </label>
          <input
            id="fb-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            autoComplete="email"
            className={cn(inputClasses, "mt-1.5")}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="fb-message" className="block text-sm font-medium text-brand-ink">
          Your message
        </label>
        <textarea
          id="fb-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={6}
          maxLength={4000}
          className={cn(inputClasses, "mt-1.5 resize-y")}
          placeholder="What would make FaithHub more useful to you? If something is broken, tell us which page and what happened."
        />
        <p className="mt-1.5 text-xs text-brand-gray">{message.length} / 4000</p>
      </div>

      {/* ── screenshots ── */}
      <div className="mt-4">
        <p className="text-sm font-medium text-brand-ink">
          Screenshots{" "}
          <span className="font-normal text-brand-gray">
            (optional, up to {MAX_SHOTS}
            {kind === "problem" ? ", and they help with a problem" : ""})
          </span>
        </p>

        <div className="mt-1.5 flex flex-wrap gap-3">
          {shots.map((s, i) => (
            <div
              key={s.id}
              className="group relative h-24 w-32 overflow-hidden rounded-xl border border-brand-navy/15 bg-brand-light"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimisable asset */}
              <img src={s.url} alt={`Screenshot ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeShot(s.id)}
                aria-label={`Remove screenshot ${i + 1}`}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-brand-ink/75 text-white backdrop-blur transition-colors hover:bg-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}

          {!full && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              disabled={adding}
              className={cn(
                "flex h-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30 disabled:cursor-wait",
                shots.length ? "w-32" : "w-full",
                dragging
                  ? "border-brand-navy bg-brand-sky text-brand-navy"
                  : "border-brand-navy/25 bg-brand-light/60 text-brand-gray hover:border-brand-navy/50 hover:text-brand-navy"
              )}
            >
              {adding ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
              )}
              <span className="text-xs font-medium">
                {adding
                  ? "Preparing…"
                  : shots.length
                    ? "Add another"
                    : "Drop a screenshot, paste it (Ctrl+V), or click to browse"}
              </span>
            </button>
          )}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = ""; // so picking the same file again still fires
          }}
        />

        {shotError && (
          <p role="status" className="mt-2 text-xs text-red-700">
            {shotError}
          </p>
        )}
      </div>

      {/* Honeypot. Positioned off-screen, hidden from screen readers and
          skipped by tabbing — a human can't fill it, so anything in it is a
          bot. The API route silently drops those. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor="fb-website">Leave this field empty</label>
        <input
          id="fb-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {status === "error" && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-brand-gray">
          Nothing here is shared or sold. Your email is used only to reply to you.
        </p>
        <button
          type="submit"
          disabled={status === "sending" || adding || message.trim().length < 5}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-navy/20 transition-colors hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-shrink-0"
        >
          {status === "sending" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending
            </>
          ) : (
            <>
              Send it
              <Send className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
