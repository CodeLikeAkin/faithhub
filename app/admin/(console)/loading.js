// Shown while any admin page loads: a title and a few cards, so nothing jumps.
const Block = ({ className }) => (
  <div className={`rounded-3xl bg-white/70 ring-1 ring-brand-navy/[0.05] motion-safe:animate-pulse ${className}`} />
);

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-8 sm:py-10" aria-busy="true" aria-label="Loading">
      <div>
        <div className="h-4 w-40 rounded-full bg-brand-mist/50 motion-safe:animate-pulse" />
        <div className="mt-3 h-12 w-72 rounded-2xl bg-brand-mist/50 motion-safe:animate-pulse" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Block className="h-72 xl:col-span-2" />
        <Block className="h-72" />
        <Block className="h-56 xl:col-span-3" />
      </div>
    </div>
  );
}
