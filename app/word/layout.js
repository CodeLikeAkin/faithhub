"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import ToolShell from "@/components/shell/ToolShell";
import BibleNav from "@/components/word/BibleNav";
import { bookFromSlug } from "@/lib/canon";

/**
 * The Word — two panes that persist across /word, /word/[book] and
 * /word/[book]/[chapter]: the Bible (by canon section) on the left, the
 * current view on the right. Below xl it's one pane; the landing view shows
 * the Bible inline instead.
 */
export default function WordLayout({ children }) {
  const params = useParams();
  const pathname = usePathname();
  const book = bookFromSlug(params?.book);
  const chapter = params?.chapter;
  const detailRef = useRef(null);

  // The detail pane outlives each view, so start every new one at its top
  // (a #v28 anchor is handled by the chapter view itself).
  useEffect(() => {
    if (!window.location.hash) detailRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <ToolShell
      kind="word"
      title={book ? (chapter ? `${book.name} ${chapter}` : book.name) : "The Word"}
      titleAs="p"
      back={book ? <Link href="/word" className="hover:text-brand-navy">The Word</Link> : null}
    >
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-80 flex-shrink-0 overflow-y-auto border-r border-brand-navy/10 bg-white custom-scrollbar xl:block">
          <BibleNav selectedId={book?.id} />
        </aside>
        <div ref={detailRef} className="min-w-0 flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </ToolShell>
  );
}
