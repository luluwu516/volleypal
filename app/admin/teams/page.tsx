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
import { BackLink } from "@/components/nav/BackLink";
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
      <div className="flex flex-col gap-4 pt-2">
        <BackLink />
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
  const STRATEGY_LABEL: Record<string, string> = {
    zodiac_together: "同星座象",
    zodiac_mixed: "打散星座象",
    mbti_together: "同 MBTI 氣質",
    mbti_mixed: "打散 MBTI 氣質",
  };
  const strategyLabel =
    STRATEGY_LABEL[tournament.grouping_strategy] ?? tournament.grouping_strategy;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <BackLink />
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

      <RegistrationTabs registrations={registrations} disabled={locked} />

      <PendingWaiverList
        pending={pendingWaivers}
        registrations={registrations}
        disabled={locked}
      />


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
            key={teams.map((t) => t.id).join(",")}
            teams={teams}
            registrations={registrations}
            initialMembers={members ?? []}
            strategy={tournament.grouping_strategy}
            disabled={locked}
          />
        </section>
      )}

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
