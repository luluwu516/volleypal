import { getCurrentTournament } from "@/lib/db/repository";
import { TournamentSettingsForm } from "../_components/TournamentSettingsForm";
import { BackLink } from "@/components/nav/BackLink";
import { LockedBanner } from "@/components/LockedBanner";
import { getAdminSession } from "@/lib/auth/getSession";
import { ExportButton } from "./_components/ExportButton";

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
        <>
          <TournamentSettingsForm tournament={tournament} disabled={locked} />
          <section className="mt-2">
            <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
              資料備份
            </h2>
            <ExportButton />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              匯出整份賽事資料為 JSON,可作為賽事結束後的存檔或分析用。
            </p>
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">沒有賽事</p>
      )}
    </div>
  );
}
