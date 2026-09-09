import Link from "next/link";
import { Settings } from "lucide-react";
import { getAdminSession } from "@/lib/auth/getSession";
import { getCurrentTournament } from "@/lib/db/repository";
import type { GroupingStrategy } from "@/lib/db/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./_components/LogoutButton";
import { LockButton } from "./_components/LockButton";
import { LockedBanner } from "@/components/LockedBanner";

const STRATEGY_SUBTITLE: Record<GroupingStrategy, string> = {
  zodiac_together: "同星座象",
  zodiac_mixed: "打散星座象",
  mbti_together: "同 MBTI 氣質",
  mbti_mixed: "打散 MBTI 氣質",
};

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const sess = await getAdminSession();
  const tournament = await getCurrentTournament().catch(() => null);
  const locked = Boolean(sess.locked);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          登入身分: {sess.adminName}
        </p>
        <LogoutButton />
      </div>

      {locked && <LockedBanner />}

      {tournament ? (
        <TournamentCardLink disabled={locked}>
          {/* gap-1 + py-3 override the shadcn defaults (gap-6 + py-6) so
              this info card stays compact — it's only two lines of text. */}
          <Card className="gap-1 py-3 transition-colors hover:border-border">
            <CardHeader className="pb-0">
              <CardTitle className="text-base flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground uppercase tracking-wider">
                  <Settings className="size-3.5" aria-hidden />
                  賽事設定
                </span>
                <span className="truncate">{tournament.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {tournament.num_courts} 場地 · 每場 {tournament.match_duration_min} 分
              {tournament.group_stage_time_limit_min
                ? ` · 預賽上限 ${tournament.group_stage_time_limit_min} 分`
                : ""}
            </CardContent>
          </Card>
        </TournamentCardLink>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>沒有賽事</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            請在 Supabase 中先建立一個 tournament。詳見首頁的範例 SQL。
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <AdminTile
          href="/admin/teams"
          title="分隊"
          subtitle={
            tournament
              ? STRATEGY_SUBTITLE[tournament.grouping_strategy]
              : "尚未設定"
          }
          disabled={locked}
        />
        <AdminTile
          href="/admin/scheduler"
          title="賽程"
          subtitle="生成 / 重排"
          disabled={locked}
        />
        <AdminTile href="/admin/score" title="計分" subtitle="挑場比賽" />
        <AdminTile
          href="/admin/announce"
          title="廣播"
          subtitle="緊急公告"
          disabled={locked}
        />
      </div>

      {!locked && (
        <div className="pt-1">
          <LockButton />
          <p className="text-xs text-muted-foreground mt-1.5 text-center">
            鎖定後僅能計分,其他控制需 PIN 解鎖
          </p>
        </div>
      )}
    </div>
  );
}

function TournamentCardLink({
  disabled,
  children,
}: {
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <div aria-disabled className="pointer-events-none opacity-60">
        {children}
      </div>
    );
  }
  return (
    <Link
      href="/admin/settings"
      aria-label="編輯賽事設定"
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </Link>
  );
}

function AdminTile({
  href,
  title,
  subtitle,
  disabled = false,
}: {
  href: string;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  const inner = (
    <Button
      variant="outline"
      className="w-full h-20 flex-col"
      disabled={disabled}
    >
      <span>{title}</span>
      <span className="text-xs text-muted-foreground">{subtitle}</span>
    </Button>
  );
  if (disabled) {
    return (
      <div aria-disabled className="pointer-events-none">
        {inner}
      </div>
    );
  }
  return <Link href={href}>{inner}</Link>;
}
