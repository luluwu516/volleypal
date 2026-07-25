import {
  getCurrentTournament,
  listAnnouncements,
} from "@/lib/db/repository";
import { AnnounceForm } from "./_components/AnnounceForm";
import { AnnouncementList } from "./_components/AnnouncementList";
import { BackLink } from "@/components/nav/BackLink";
import { LockedBanner } from "@/components/LockedBanner";
import { EmptyState } from "@/components/EmptyState";
import { getAdminSession } from "@/lib/auth/getSession";

export const dynamic = "force-dynamic";

export default async function AnnouncePage() {
  const tournament = await getCurrentTournament();
  const sess = await getAdminSession();
  if (!tournament) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <BackLink />
        <h1 className="text-xl font-bold">廣播</h1>
        <EmptyState
          glyph="🗂"
          title="尚未建立賽事"
          body="請先到管理首頁完成賽事設定,再回來這裡發廣播。"
          cta={{ href: "/admin", label: "回管理首頁" }}
        />
      </div>
    );
  }
  const locked = Boolean(sess.locked);
  const announcements = await listAnnouncements(tournament.id);
  return (
    <div className="flex flex-col gap-4 pt-2">
      <BackLink />
      {locked && <LockedBanner />}
      <h1 className="text-xl font-bold">廣播</h1>
      <AnnounceForm tournamentId={tournament.id} disabled={locked} />
      <AnnouncementList announcements={announcements} disabled={locked} />
    </div>
  );
}
