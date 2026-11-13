import {
  getCurrentTournament,
  listTeams,
  listRegistrations,
} from "@/lib/db/repository";
import { GenerateTeamsButton } from "./_components/GenerateTeamsButton";
import { CancelTeamsButton } from "./_components/CancelTeamsButton";
import { PublishTimePicker } from "./_components/PublishTimePicker";
import { ActiveRosterHeader } from "./_components/ActiveRosterHeader";
import { RegistrationTabs } from "./_components/RegistrationTabs";
import { PendingWaiverList } from "./_components/PendingWaiverList";
import { TeamsBoard } from "./_components/TeamsBoard";
import { UnassignedPlayers } from "./_components/UnassignedPlayers";
import { SkillStoreProvider } from "./_components/SkillStore";
import { LockedBanner } from "@/components/LockedBanner";
import { EmptyState } from "@/components/EmptyState";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/getSession";
import type { PendingWaiver } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  // Let DB errors bubble to error.tsx (with retry). null → not-yet-created,
  // show the shared empty state with a nudge toward settings.
  const tournament = await getCurrentTournament();
  const sess = await getAdminSession();
  if (!tournament) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">分隊</h1>
        <EmptyState
          glyph="🗂"
          title="尚未建立賽事"
          body="請先到管理首頁完成賽事設定,再回來這裡分隊。"
          cta={{ href: "/admin", label: "回管理首頁" }}
        />
      </div>
    );
  }
  const locked = Boolean(sess.locked);

  const db = supabaseAdmin();
  const [teams, registrations, pendingWaiversRes] = await Promise.all([
    listTeams(tournament.id),
    listRegistrations(tournament.id),
    db
      .from("pending_waivers")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("submitted_at", { ascending: true }),
  ]);
  const pendingWaivers = (pendingWaiversRes.data ?? []) as PendingWaiver[];

  const { data: members } = await db
    .from("team_members")
    .select("team_id, registration_id")
    .in(
      "team_id",
      teams.map((t) => t.id),
    );

  const activeCount = registrations.filter((r) => r.is_active).length;
  const canGenerate = activeCount >= 8;
  // Confirmed players with no seat. Produced by the replacement flow: 退回候補
  // frees a seat, and the waitlisted player confirmed into it arrives with no
  // team of their own. Nothing else on the page would show them.
  const assignedIds = new Set((members ?? []).map((m) => m.registration_id));
  const unassigned = registrations.filter(
    (r) => r.is_active && !assignedIds.has(r.id),
  );
  const STRATEGY_LABEL: Record<string, string> = {
    zodiac_together: "同星座象",
    zodiac_mixed: "打散星座象",
    mbti_together: "同 MBTI 氣質",
    mbti_mixed: "打散 MBTI 氣質",
  };
  const strategyLabel =
    STRATEGY_LABEL[tournament.grouping_strategy] ?? tournament.grouping_strategy;

  return (
    <div className="flex flex-col gap-4">
      {locked && <LockedBanner />}
      <header>
        <h1 className="text-xl font-bold">分隊</h1>
        <p className="text-xs text-muted-foreground">
          已確認 {activeCount} · 隊伍 {teams.length} · 策略 {strategyLabel}
        </p>
      </header>

      <PublishTimePicker
        tournamentId={tournament.id}
        initialIso={tournament.teams_public_at}
        matchDayDate={tournament.match_day_date}
        disabled={locked}
      />

      <ActiveRosterHeader
        tournament={tournament}
        registrations={registrations}
      />

      {/* Ratings are edited in the roster but read back as team averages in
          the board, so the two need somewhere shared to put an edit. Renders
          no DOM of its own — the sections below stay direct flex children. */}
      <SkillStoreProvider registrations={registrations}>
        {/* Teams board sits above the roster: once teams exist it's the thing
            admin came here to look at, while the roster (64+ rows) becomes
            reference data. Before generation the board isn't rendered at all,
            so the roster naturally stays at the top during the confirm phase. */}
        {teams.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
              目前分隊
            </h2>
            <TeamsBoard
              // Remount when the underlying team set changes so the internal
              // assignment state re-initialises after 一鍵分隊 / import.
              // Otherwise it holds stale team_id → registration_id mappings
              // and every card shows empty until a hard refresh.
              //
              // The member count is in the key for the same reason: seating an
              // unassigned player or freeing a seat with 退回候補 changes who
              // belongs to a team without changing which teams exist, and the
              // board would otherwise keep rendering the membership it booted
              // with. A move between teams leaves the count alone, so manual
              // drag state survives the refresh that follows it.
              key={`${teams.map((t) => t.id).join(",")}:${(members ?? []).length}`}
              teams={teams}
              registrations={registrations}
              initialMembers={members ?? []}
              strategy={tournament.grouping_strategy}
              disabled={locked}
            />
          </section>
        )}

        <UnassignedPlayers
          players={unassigned}
          teams={teams}
          members={members ?? []}
          disabled={locked}
        />

        <PendingWaiverList
          pending={pendingWaivers}
          registrations={registrations}
          disabled={locked}
        />

        <RegistrationTabs registrations={registrations} disabled={locked} />
      </SkillStoreProvider>

      {/* Sticks above BottomNav (≈4rem tall) plus the notched-phone safe
          area, so the button never gets hidden behind the nav on iPhones
          with a home indicator. */}
      <section className="flex flex-col gap-2 sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-sm py-2 -mx-4 px-4 border-t border-border/30">
        <GenerateTeamsButton
          tournamentId={tournament.id}
          existingCount={teams.length}
          strategy={tournament.grouping_strategy}
          teamsPublicAt={tournament.teams_public_at}
          disabled={locked}
        />
        {!canGenerate && (
          <p className="text-xs text-amber-400 text-center">
            ⚠ 需 ≥ 8 位已確認球員才能分隊（目前 {activeCount}）
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
    </div>
  );
}
