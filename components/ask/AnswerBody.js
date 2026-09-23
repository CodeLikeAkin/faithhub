"use client";

import { Fragment, cloneElement, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import { SCRIPTURE_RE, fmtTime } from "@/lib/ask-format";
import { cleanTitle } from "@/lib/titles";
import { cn } from "@/lib/utils";

/**
 * A grounded answer as article text: markdown (both prompts ask for numbered
 * lists when Rev. Peter enumerates points), [N] citations as pills that play
 * the cited moment, and scripture references that focus their verse card.
 */

// [3] · [3][7] · [3] [7] · [3, 7]
const CITE_GROUP_RE = /\[\d+\](?:\s*\[\d+\])*|\[\d+(?:,\s*\d+)+\]/g;
// Citations become ⟦N⟧ tokens before markdown parsing — plain brackets could
// be read as link syntax, these can't.
const TOKEN_SPLIT_RE = /(⟦\d+⟧)/g;
const TOKEN_RE = /^⟦(\d+)⟧$/;

const tokenize = (text) =>
  (text || "").replace(CITE_GROUP_RE, (m) =>
    [...m.matchAll(/\d+/g)].map((x) => `⟦${x[0]}⟧`).join("")
  );

function CitationPill({ n, seg, onCite, onHover }) {
  if (!seg?.video_id) return <sup className="text-xs text-brand-gray">[{n}]</sup>;
  const title = cleanTitle(seg.sermon_title);
  return (
    <button
      type="button"
      onClick={() => onCite?.(seg)}
      onMouseEnter={() => onHover?.(n)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(n)}
      onBlur={() => onHover?.(null)}
      title={`${title} · ${fmtTime(seg.start_seconds)}`}
      aria-label={`Play source ${n}: ${title}, at ${fmtTime(seg.start_seconds)}`}
      className="relative mx-0.5 inline-flex h-5 min-w-[1.25rem] -translate-y-0.5 items-center justify-center rounded-full bg-brand-navy/10 px-1.5 align-middle text-xs font-bold leading-none text-brand-navy transition-colors before:absolute before:-inset-2.5 before:content-[''] hover:bg-brand-navy hover:text-white focus-visible:bg-brand-navy focus-visible:text-white focus-visible:outline-none"
    >
      {n}
    </button>
  );
}

export default function AnswerBody({
  text,
  segmentMap,
  onCite,
  onHoverCite,
  onVerse,
  density = "page",
  className,
}) {
  // Scripture references inside a run of plain text.
  const withScripture = (str, key) => {
    const re = new RegExp(SCRIPTURE_RE.source, "g");
    const out = [];
    let last = 0;
    let m;
    while ((m = re.exec(str))) {
      if (m.index > last) out.push(str.slice(last, m.index));
      const ref = m[0].replace(/\s+/g, " ");
      out.push(
        onVerse ? (
          <button
            key={`${key}-v${m.index}`}
            type="button"
            data-scripture=""
            onClick={() => onVerse(ref)}
            className="font-semibold text-brand-navy underline decoration-brand-navy/25 decoration-2 underline-offset-[3px] transition-colors hover:decoration-brand-navy"
          >
            {m[0]}
          </button>
        ) : (
          <span key={`${key}-v${m.index}`} data-scripture="" className="font-semibold text-brand-navy">
            {m[0]}
          </span>
        )
      );
      last = m.index + m[0].length;
    }
    if (last < str.length) out.push(str.slice(last));
    return out;
  };

  const renderString = (str, key) =>
    str.split(TOKEN_SPLIT_RE).map((part, i) => {
      const tok = part.match(TOKEN_RE);
      if (tok) {
        return (
          <CitationPill
            key={`${key}-c${i}`}
            n={tok[1]}
            seg={segmentMap?.[tok[1]]}
            onCite={onCite}
            onHover={onHoverCite}
          />
        );
      }
      return part ? <Fragment key={`${key}-t${i}`}>{withScripture(part, `${key}-${i}`)}</Fragment> : null;
    });

  // Markdown hands block renderers a string, an array, or nested elements
  // (<strong>, <em>) — walk all of them so a citation inside bold text still
  // becomes a pill. A block inside a block (a <p> in a loose list item, a
  // nested list) is walked by both renderers, so skip what's already been
  // turned into a pill or a scripture link — re-walking a scripture link
  // would wrap it in a second <button>.
  const walk = (children, key = "n") => {
    if (typeof children === "string") return renderString(children, key);
    if (isValidElement(children) && (children.type === CitationPill || children.props?.["data-scripture"] != null))
      return children;
    if (Array.isArray(children))
      return children.map((child, i) => <Fragment key={`${key}-${i}`}>{walk(child, `${key}-${i}`)}</Fragment>);
    if (isValidElement(children) && children.props?.children != null)
      return cloneElement(children, undefined, walk(children.props.children, key));
    return children;
  };

  const page = density === "page";

  return (
    <div
      className={cn(
        "text-brand-ink/90 [&>p:first-child]:font-medium [&>p:first-child]:text-brand-ink",
        page ? "text-base leading-[1.8] lg:text-lg lg:leading-[1.75]" : "text-base leading-[1.75]",
        className
      )}
    >
      <ReactMarkdown
        components={{
          p: ({ node, children, ...props }) => (
            <p className="mb-5 last:mb-0" {...props}>
              {walk(children)}
            </p>
          ),
          li: ({ node, children, ...props }) => (
            <li className="pl-1" {...props}>
              {walk(children)}
            </li>
          ),
          ul: ({ node, ...props }) => (
            <ul className="my-5 list-disc space-y-2.5 pl-6 marker:text-brand-navy/50" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="my-5 list-decimal space-y-2.5 pl-6 marker:font-semibold marker:text-brand-navy/70" {...props} />
          ),
          strong: ({ node, children, ...props }) => (
            <strong className="font-semibold text-brand-ink" {...props}>
              {children}
            </strong>
          ),
          em: ({ node, children, ...props }) => (
            <em className="italic" {...props}>
              {children}
            </em>
          ),
          h1: ({ node, children, ...props }) => (
            <h3 className="mb-3 mt-8 font-display text-2xl font-medium text-brand-ink first:mt-0" {...props}>
              {walk(children)}
            </h3>
          ),
          h2: ({ node, children, ...props }) => (
            <h3 className="mb-3 mt-8 font-display text-2xl font-medium text-brand-ink first:mt-0" {...props}>
              {walk(children)}
            </h3>
          ),
          h3: ({ node, children, ...props }) => (
            <h4 className="mb-2 mt-6 font-display text-xl font-medium text-brand-ink first:mt-0" {...props}>
              {walk(children)}
            </h4>
          ),
          blockquote: ({ node, children, ...props }) => (
            <blockquote className="my-5 border-l-2 border-brand-navy/30 pl-4 font-display italic text-brand-ink" {...props}>
              {children}
            </blockquote>
          ),
          a: ({ node, children, href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-navy underline underline-offset-2"
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {tokenize(text)}
      </ReactMarkdown>
    </div>
  );
}
