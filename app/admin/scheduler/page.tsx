import {
  getCurrentTournament,
  listMatches,
  listTeams,
} from "@/lib/db/repository";
import { GenerateScheduleForm } from "./_components/GenerateScheduleForm";
import { BackLink } from "@/components/nav/BackLink";
import { ScheduleList } from "@/components/admin/ScheduleList";
import { LockedBanner } from "@/components/LockedBanner";
import { getAdminSession } from "@/lib/auth/getSession";

export const dynamic = "force-dynamic";

export default async function SchedulerPage() {
  const tournament = await getCurrentTournament().catch(() => null);
  if (!tournament) return <p>沒有賽事</p>;
  const sess = await getAdminSession();
  const locked = Boolean(sess.locked);
  const [matches, teams] = await Promise.all([
    listMatches(tournament.id),
    listTeams(tournament.id),
  ]);
  return (
    <div className="flex flex-col gap-4 pt-2">
      <BackLink />
      {locked && <LockedBanner />}
      <h1 className="text-xl font-bold">賽程</h1>
      <p className="text-xs text-muted-foreground">
        現有 {matches.length} 場比賽 · {teams.length} 個隊伍
      </p>
      <GenerateScheduleForm
        tournamentId={tournament.id}
        defaultCourts={tournament.num_courts}
        defaultDuration={tournament.match_duration_min}
        existingCount={matches.length}
        teamCount={teams.length}
        disabled={locked}
      />

      <section className="mt-2">
        <h2 className="text-sm font-semibold mb-2">已排定賽程</h2>
        <ScheduleList matches={matches} teams={teams} />
      </section>
    </div>
  );
}
