import { LiveScoreboard } from "@/components/scoreboard/LiveScoreboard";

export default function LivePage() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-xl font-bold">即時比分</h1>
      <LiveScoreboard />
    </div>
  );
}
