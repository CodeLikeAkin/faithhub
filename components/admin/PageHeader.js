import { rise } from "@/components/admin/ui";

/** Title block shared by every admin page (the Overview has its own greeting). */
export default function PageHeader({ title, description, actions }) {
  const r = rise(0);
  return (
    <div style={r.style} className={`${r.className} flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`}>
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight text-brand-ink">{title}</h1>
        {description && <p className="mt-2 max-w-[65ch] text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Standard page frame: same width and padding as the Overview. */
export function PageFrame({ children }) {
  return <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-8 sm:py-10">{children}</div>;
}
