import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import {
  getCurrentTournament,
  listTeams,
  listRegistrations,
} from "@/lib/db/repository";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/getSession";
import { EmptyState } from "@/components/EmptyState";

const TZ = process.env.NEXT_PUBLIC_APP_TZ || "America/Los_Angeles";

export const dynamic = "force-dynamic";

// Public roster page. Server-side gates on `teams_public_at`; ?preview=1
// with an admin session bypasses the gate so admin can spot-check the layout
// before it goes live to participants.
export default async function PublicTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const tournament = await getCurrentTournament();
  if (!tournament) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          glyph="🏐"
          title="尚無賽事"
          body="請等待主辦建立比賽。"
          cta={{ href: "/", label: "回首頁" }}
        />
      </div>
    );
  }

  const publishAt = tournament.teams_public_at
    ? new Date(tournament.teams_public_at)
    : null;
  const isLive = publishAt !== null && publishAt <= new Date();

  // Admin preview bypass. Session check is server-side, so viewers can't fake
  // it by adding ?preview=1 without a valid iron-session cookie.
  const isAdminPreview =
    preview === "1" && Boolean((await getAdminSession()).adminId);

  if (!isLive && !isAdminPreview) {
    redirect("/");
  }

  const [teams, registrations] = await Promise.all([
    listTeams(tournament.id),
    listRegistrations(tournament.id),
  ]);

  const teamIds = teams.map((t) => t.id);
  const { data: members } =
    teamIds.length === 0
      ? { data: [] as { team_id: string; registration_id: string }[] }
      : await supabaseAdmin()
          .from("team_members")
          .select("team_id, registration_id")
          .in("team_id", teamIds);

  // Lazy-load the client-safe component; skipping full import at top so this
  // module stays plain server code.
  const { PublicTeamRoster } = await import(
    "./_components/PublicTeamRoster"
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">隊伍名單</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {tournament.name} · {tournament.year}
          {publishAt && (
            <span className="ml-2">
              (公開於 {formatInTimeZone(publishAt, TZ, "MM/dd HH:mm")})
            </span>
          )}
          {isAdminPreview && !isLive && (
            <span className="ml-2 rounded bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-300 uppercase tracking-wider">
              Admin Preview
            </span>
          )}
        </p>
      </header>

      {teams.length === 0 ? (
        <EmptyState
          glyph="🗂"
          title="尚未分隊"
          body="主辦還沒完成分隊,請稍後再回來。"
          cta={{ href: "/", label: "回首頁" }}
        />
      ) : (
        <PublicTeamRoster
          teams={teams}
          members={members ?? []}
          registrations={registrations}
          strategy={tournament.grouping_strategy}
        />
      )}

    </div>
  );
}
