import { getCurrentTournament } from "@/lib/db/repository";
import { TournamentSettingsForm } from "../_components/TournamentSettingsForm";
import { BackLink } from "@/components/nav/BackLink";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tournament = await getCurrentTournament().catch(() => null);
  return (
    <div className="flex flex-col gap-4 pt-2">
      <BackLink />
      <h1 className="text-xl font-bold">賽事設定</h1>
      {tournament ? (
        <TournamentSettingsForm tournament={tournament} />
      ) : (
        <p className="text-sm text-muted-foreground">沒有賽事</p>
      )}
    </div>
  );
}
