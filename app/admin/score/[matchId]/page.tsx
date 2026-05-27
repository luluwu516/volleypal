import { notFound } from "next/navigation";
import {
  getCurrentTournament,
  listMatches,
  listMatchSets,
  listTeams,
} from "@/lib/db/repository";
import { AdminScoreboard } from "./_components/AdminScoreboard";
import { BackLink } from "@/components/nav/BackLink";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ matchId: string }>;
}

export default async function ScoreEditPage({ params }: Props) {
  const { matchId } = await params;
  const tournament = await getCurrentTournament().catch(() => null);
  if (!tournament) return notFound();
  const matches = await listMatches(tournament.id);
  const match = matches.find((m) => m.id === matchId);
  if (!match) return notFound();
  const [teams, sets] = await Promise.all([
    listTeams(tournament.id),
    listMatchSets([matchId]),
  ]);
  return (
    <div className="flex flex-col gap-4 pt-2">
      <BackLink href="/admin/score" label="挑場比賽" />
      <h1 className="text-xl font-bold">計分</h1>
      <AdminScoreboard
        match={match}
        teams={teams}
        initialSets={sets}
        groupTimeLimitMin={
          match.phase === "group"
            ? tournament.group_stage_time_limit_min
            : null
        }
      />
    </div>
  );
}
