import { getCurrentTournament } from "@/lib/db/repository";
import { TournamentSettingsForm } from "../_components/TournamentSettingsForm";
import { BackLink } from "@/components/nav/BackLink";
import { LockedBanner } from "@/components/LockedBanner";
import { getAdminSession } from "@/lib/auth/getSession";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tournament = await getCurrentTournament().catch(() => null);
  const sess = await getAdminSession();
  const locked = Boolean(sess.locked);
  return (
    <div className="flex flex-col gap-4 pt-2">
      <BackLink />
      {locked && <LockedBanner />}
      <h1 className="text-xl font-bold">賽事設定</h1>
      {tournament ? (
        <TournamentSettingsForm tournament={tournament} disabled={locked} />
      ) : (
        <p className="text-sm text-muted-foreground">沒有賽事</p>
      )}
    </div>
  );
}
