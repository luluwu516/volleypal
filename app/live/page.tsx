import { LiveScoreboard } from "@/components/scoreboard/LiveScoreboard";

export default function LivePage() {
  return (
    <div className="flex flex-col gap-4">
      <LiveScoreboard />
    </div>
  );
}
