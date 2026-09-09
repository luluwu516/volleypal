import { getCurrentTournament } from "@/lib/db/repository";
import { TournamentSettingsForm } from "../_components/TournamentSettingsForm";
import { LockedBanner } from "@/components/LockedBanner";
import { EmptyState } from "@/components/EmptyState";
import { getAdminSession } from "@/lib/auth/getSession";
import { ExportButton } from "./_components/ExportButton";
import { CsvExportButtons } from "./_components/CsvExportButtons";
import { ImportButton } from "./_components/ImportButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tournament = await getCurrentTournament();
  const sess = await getAdminSession();
  const locked = Boolean(sess.locked);
  return (
    <div className="flex flex-col gap-4">
      {locked && <LockedBanner />}
      <h1 className="text-xl font-bold">賽事設定</h1>
      {tournament ? (
        <>
          <TournamentSettingsForm tournament={tournament} disabled={locked} />
          <section className="mt-2">
            <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
              資料備份
            </h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <ExportButton />
                {!locked && <ImportButton />}
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider">
                  CSV 分項匯出（紙本備案）
                </p>
                <CsvExportButtons />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              JSON 是完整備份,可以配合「匯入」還原,含 Google 表單原始欄位
              (email、電話、緊急聯絡人等),請放在安全的地方。CSV 是各表獨立
              檔案,適合列印或用 Excel 開。匯入會覆蓋目前賽事,需再次輸入
              PIN 確認。
            </p>
          </section>
        </>
      ) : (
        <EmptyState
          glyph="🗂"
          title="尚未建立賽事"
          body="請到 Supabase Table Editor 建立一筆 tournaments 資料，或從備份 JSON 匯入。"
        />
      )}
    </div>
  );
}
