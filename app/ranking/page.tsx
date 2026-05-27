import {
  getCurrentTournament,
  listMatches,
  listMatchSets,
  listTeams,
} from "@/lib/db/repository";
import { standingsForGroup } from "@/lib/ranking-helpers";
import { GroupStandings } from "@/components/ranking/GroupStandings";
import { Bracket } from "@/components/ranking/Bracket";
import { RoundRobinMatrix } from "@/components/ranking/RoundRobinMatrix";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const revalidate = 15;

export default async function RankingPage() {
  const tournament = await getCurrentTournament().catch(() => null);
  if (!tournament) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        尚未建立賽事
      </div>
    );
  }
  const [teams, matches] = await Promise.all([
    listTeams(tournament.id),
    listMatches(tournament.id),
  ]);
  const sets = await listMatchSets(matches.map((m) => m.id));

  // Group teams by group_label inferred from group-stage matches
  const groupTeamIds: Record<"A" | "B", Set<string>> = {
    A: new Set(),
    B: new Set(),
  };
  matches
    .filter((m) => m.phase === "group" && m.group_label)
    .forEach((m) => {
      if (m.team_a_id) groupTeamIds[m.group_label!].add(m.team_a_id);
      if (m.team_b_id) groupTeamIds[m.group_label!].add(m.team_b_id);
    });

  const standingsA = standingsForGroup(
    matches,
    sets,
    "A",
    [...groupTeamIds.A],
  );
  const standingsB = standingsForGroup(
    matches,
    sets,
    "B",
    [...groupTeamIds.B],
  );

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-xl font-bold">戰績 & 賽程</h1>
      <Tabs defaultValue="a">
        <TabsList className="w-full">
          <TabsTrigger value="a" className="flex-1">
            A 組
          </TabsTrigger>
          <TabsTrigger value="b" className="flex-1">
            B 組
          </TabsTrigger>
          <TabsTrigger value="ko" className="flex-1">
            淘汰賽
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a" className="mt-4 flex flex-col gap-4">
          <GroupStandings standings={standingsA} teams={teams} />
          <section>
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              對戰矩陣
            </h2>
            <RoundRobinMatrix
              matches={matches.filter(
                (m) => m.phase === "group" && m.group_label === "A",
              )}
              matchSets={sets}
              teams={teams}
              groupTeamIds={standingsA.map((s) => s.teamId)}
            />
          </section>
        </TabsContent>
        <TabsContent value="b" className="mt-4 flex flex-col gap-4">
          <GroupStandings standings={standingsB} teams={teams} />
          <section>
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              對戰矩陣
            </h2>
            <RoundRobinMatrix
              matches={matches.filter(
                (m) => m.phase === "group" && m.group_label === "B",
              )}
              matchSets={sets}
              teams={teams}
              groupTeamIds={standingsB.map((s) => s.teamId)}
            />
          </section>
        </TabsContent>
        <TabsContent value="ko" className="mt-4">
          <Bracket matches={matches} teams={teams} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
