import {
  getCurrentTournament,
  listAnnouncements,
} from "@/lib/db/repository";
import { AnnounceForm } from "./_components/AnnounceForm";
import { AnnouncementList } from "./_components/AnnouncementList";
import { BackLink } from "@/components/nav/BackLink";
import { LockedBanner } from "@/components/LockedBanner";
import { getAdminSession } from "@/lib/auth/getSession";

export const dynamic = "force-dynamic";

export default async function AnnouncePage() {
  const tournament = await getCurrentTournament().catch(() => null);
  if (!tournament) return <p>沒有賽事</p>;
  const sess = await getAdminSession();
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
