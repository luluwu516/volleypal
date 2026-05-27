import Link from "next/link";
import {
  getCurrentTournament,
  listMatches,
  listTeams,
} from "@/lib/db/repository";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/nav/BackLink";

export const dynamic = "force-dynamic";

export default async function ScoreListPage() {
  const tournament = await getCurrentTournament().catch(() => null);
  if (!tournament) return <p>沒有賽事</p>;
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
        <p className="text-sm text-muted-foreground text-center py-6">
          沒有比賽
        </p>
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
              {m.scheduled_at &&
                ` · ${new Date(m.scheduled_at).toLocaleString([], {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
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
