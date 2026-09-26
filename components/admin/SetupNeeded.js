import { Database } from "lucide-react";

/** Shown when a page needs a database setup file that hasn't been run yet. */
export default function SetupNeeded({ file }) {
  return (
    <div className="flex items-start gap-4 rounded-3xl bg-white p-6 ring-1 ring-brand-navy/[0.07]">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-sky text-brand-navy">
        <Database size={20} aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-lg font-bold text-brand-ink">One-time database setup needed</h2>
        <p className="mt-1 max-w-[65ch] text-slate-600">
          Run <span className="font-semibold text-brand-ink">{file}</span> in the Supabase SQL editor, then reload this
          page. It only adds new things; nothing that exists is changed.
        </p>
      </div>
    </div>
  );
}
