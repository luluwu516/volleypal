import {
  getCurrentTournament,
  listTeams,
  listRegistrations,
} from "@/lib/db/repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateTeamsButton } from "./_components/GenerateTeamsButton";
import { CancelTeamsButton } from "./_components/CancelTeamsButton";
import { RosterList } from "./_components/RosterList";
import { BackLink } from "@/components/nav/BackLink";
import { LockedBanner } from "@/components/LockedBanner";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/getSession";
import { signFromBirthday } from "@/lib/zodiac";

export const dynamic = "force-dynamic";

const ELEMENT_DOT: Record<string, string> = {
  fire: "bg-red-500/80",
  earth: "bg-amber-600/80",
  air: "bg-sky-400/80",
  water: "bg-cyan-500/80",
};

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

  const regById = new Map(registrations.map((r) => [r.id, r]));
  const membersByTeam = new Map<string, typeof registrations>();
  for (const m of members ?? []) {
    const reg = regById.get(m.registration_id);
    if (!reg) continue;
    const list = membersByTeam.get(m.team_id) ?? [];
    list.push(reg);
    membersByTeam.set(m.team_id, list);
  }

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
          <div className="flex flex-col gap-3">
            {teams.map((t) => {
              const teamMembers = membersByTeam.get(t.id) ?? [];
              return (
                <Card key={t.id}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {t.element && (
                          <span
                            className={`size-2.5 rounded-full ${ELEMENT_DOT[t.element]}`}
                          />
                        )}
                        <span>{t.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-normal">
                        {teamMembers.length} 人
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {teamMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        沒有成員
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {teamMembers.map((m) => {
                          const sign = m.birthday
                            ? signFromBirthday(
                                new Date(m.birthday + "T12:00:00"),
                              )
                            : null;
                          return (
                            <li
                              key={m.id}
                              className="flex items-center justify-between text-sm border-t border-border/40 first:border-t-0 py-1.5"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{m.name}</span>
                                {m.gender && (
                                  <span className="text-xs text-muted-foreground">
                                    {m.gender === "female"
                                      ? "♀"
                                      : m.gender === "male"
                                        ? "♂"
                                        : "·"}
                                  </span>
                                )}
                                {m.position === "setter" && (
                                  <span className="text-xs">🙌🏻</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {sign && (
                                  <span className="opacity-60">{sign}</span>
                                )}
                                <span className="tabular-nums">
                                  Lv{m.skill_level ?? "?"}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
