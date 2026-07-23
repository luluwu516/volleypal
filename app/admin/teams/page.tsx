import {
  getCurrentTournament,
  listTeams,
  listRegistrations,
} from "@/lib/db/repository";
import { GenerateTeamsButton } from "./_components/GenerateTeamsButton";
import { CancelTeamsButton } from "./_components/CancelTeamsButton";
import { RosterList } from "./_components/RosterList";
import { TeamsBoard } from "./_components/TeamsBoard";
import { BackLink } from "@/components/nav/BackLink";
import { LockedBanner } from "@/components/LockedBanner";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/getSession";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const tournament = await getCurrentTournament().catch(() => null);
  if (!tournament) return <p>沒有賽事</p>;
  const sess = await getAdminSession();
  const locked = Boolean(sess.locked);

  const [teams, registrations] = await Promise.all([
    listTeams(tournament.id),
    listRegistrations(tournament.id),
  ]);

  const { data: members } = await supabaseAdmin()
    .from("team_members")
    .select("team_id, registration_id")
    .in(
      "team_id",
      teams.map((t) => t.id),
    );

  const canGenerate =
    tournament.mode === "zodiac" && registrations.length >= 8;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <BackLink />
      {locked && <LockedBanner />}
      <header>
        <h1 className="text-xl font-bold">分隊</h1>
        <p className="text-xs text-muted-foreground">
          報名人數: {registrations.length} · 已建立隊伍: {teams.length}
        </p>
      </header>

      <section>
        <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
          球員列表
        </h2>
        <RosterList registrations={registrations} disabled={locked} />
      </section>

      {teams.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
            目前分隊
          </h2>
          <TeamsBoard
            teams={teams}
            registrations={registrations}
            initialMembers={members ?? []}
            disabled={locked}
          />
        </section>
      )}

      {tournament.mode === "zodiac" && (
        <section className="flex flex-col gap-2 sticky bottom-20 bg-background/80 backdrop-blur-sm py-2 -mx-4 px-4 border-t border-border/30">
          <GenerateTeamsButton
            tournamentId={tournament.id}
            existingCount={teams.length}
            disabled={locked}
          />
          {!canGenerate && registrations.length < 8 && (
            <p className="text-xs text-amber-400 text-center">
              ⚠ 需 ≥ 8 位報名者才能分隊（目前 {registrations.length}）
            </p>
          )}
          {teams.length > 0 && (
            <CancelTeamsButton
              tournamentId={tournament.id}
              teamCount={teams.length}
              disabled={locked}
            />
          )}
        </section>
      )}
    </div>
  );
}
