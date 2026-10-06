import ToolShell from "@/components/shell/ToolShell";
import HomeHero from "@/components/home/HomeHero";
import TodayCard from "@/components/home/TodayCard";
import ContinueCard from "@/components/home/ContinueCard";
import LatestShelf from "@/components/home/LatestShelf";
import GoDeeper from "@/components/home/GoDeeper";
import VisionStrip from "@/components/home/VisionStrip";
import { DotGrid } from "@/components/Decor";

/**
 * Home, inside the same frame as every other page: the church photo as a
 * welcome banner with an ask box, today's declaration beside the lesson to
 * pick up, the newest messages, the four tools, and the vision.
 */
export default function Home() {
  // `titleAs="p"` because HomeHero already carries the page's <h1>, the same
  // way /ask, /series, /word and the lesson pages do. Left at the default the
  // masthead emitted a second <h1> ("Home"), ahead of the real one in DOM order.
  return (
    <ToolShell kind="home" title="Home" titleAs="p">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* The Vision page's backdrop: a sky wash under the middle of the
            page and dot grids pinned to opposite edges, fading inward. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[26rem] h-[70rem] bg-gradient-to-b from-white via-brand-sky/70 to-white" />
        <DotGrid className="left-0 top-[30rem] h-[36rem] w-[36rem] max-w-full [mask-image:radial-gradient(circle_at_left,black,transparent_65%)]" />
        <DotGrid className="right-0 top-[64rem] h-[32rem] w-[32rem] max-w-full [mask-image:radial-gradient(circle_at_right,black,transparent_65%)]" />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-12 pt-3 sm:gap-6 sm:px-6 sm:pt-6 lg:px-8">
          <HomeHero />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <TodayCard className="fh-rise" style={{ "--i": 1 }} />
            <ContinueCard className="fh-rise" style={{ "--i": 2 }} />
          </div>
          <LatestShelf style={{ "--i": 3 }} />
          <GoDeeper startIndex={4} />
          <VisionStrip style={{ "--i": 8 }} />
        </div>
      </div>
    </ToolShell>
  );
}
