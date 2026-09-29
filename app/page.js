import ToolShell from "@/components/shell/ToolShell";
import HomeHero from "@/components/home/HomeHero";
import TodayCard from "@/components/home/TodayCard";
import ContinueCard from "@/components/home/ContinueCard";
import LatestShelf from "@/components/home/LatestShelf";
import GoDeeper from "@/components/home/GoDeeper";
import VisionStrip from "@/components/home/VisionStrip";

/**
 * Home, inside the same frame as every other page: the church photo as a
 * welcome banner with an ask box, today's declaration beside the lesson to
 * pick up, the newest messages, the four tools, and the vision.
 */
export default function Home() {
  return (
    <ToolShell kind="home" title="Home">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 pb-12 pt-3 sm:gap-6 sm:px-6 sm:pt-6 lg:px-8">
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
