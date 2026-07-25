import Link from "next/link";
import {
  getCurrentTournament,
  listMatches,
  listTeams,
} from "@/lib/db/repository";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/nav/BackLink";
import { EmptyState } from "@/components/EmptyState";
import { fmtDateTime } from "@/lib/formatTime";

export const dynamic = "force-dynamic";

export default async function ScoreListPage() {
  const tournament = await getCurrentTournament();
  if (!tournament) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <BackLink />
        <h1 className="text-xl font-bold">挑場比賽</h1>
        <EmptyState
          glyph="🗂"
          title="尚未建立賽事"
          body="請先到管理首頁完成賽事設定，再回來這裡挑比賽計分。"
          cta={{ href: "/admin", label: "回管理首頁" }}
        />
      </div>
    );
  }
  const [matches, teams] = await Promise.all([
    listMatches(tournament.id),
    listTeams(tournament.id),
  ]);
  const name = (id: string | null, src: string | null) =>
    id ? teams.find((t) => t.id === id)?.name ?? id.slice(0, 6) : src ?? "TBD";
  return (
    <div className="flex flex-col gap-3 pt-2">
      <BackLink />
      <h1 className="text-xl font-bold">挑場比賽</h1>
      {matches.length === 0 && (
        <EmptyState
          glyph="🏐"
          title="還沒有比賽"
          body="先到賽程頁生成賽程，計分頁才會出現可挑選的場次。"
          cta={{ href: "/admin/scheduler", label: "去建立賽程" }}
        />
      )}
      {matches.map((m) => (
        <Link
          key={m.id}
          href={`/admin/score/${m.id}`}
          className="rounded-lg border p-3 flex items-center justify-between hover:bg-muted/50"
        >
          <div>
            <p className="text-sm font-medium">
              {name(m.team_a_id, m.team_a_source)} vs{" "}
              {name(m.team_b_id, m.team_b_source)}
            </p>
            <p className="text-xs text-muted-foreground">
              {m.phase}
              {m.group_label ? ` ${m.group_label}` : ""} · Court {m.court ?? "?"}
              {m.scheduled_at && ` · ${fmtDateTime(m.scheduled_at)}`}
            </p>
          </div>
          <Badge
            variant={
              m.status === "live"
                ? "destructive"
                : m.status === "finished"
                  ? "secondary"
                  : "outline"
            }
          >
            {m.status}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
