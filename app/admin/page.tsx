import Link from "next/link";
import { Settings } from "lucide-react";
import { getAdminSession } from "@/lib/auth/getSession";
import { getCurrentTournament } from "@/lib/db/repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./_components/LogoutButton";
import { LockButton } from "./_components/LockButton";
import { LockedBanner } from "@/components/LockedBanner";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const sess = await getAdminSession();
  const tournament = await getCurrentTournament().catch(() => null);
  const locked = Boolean(sess.locked);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Admin</h1>
          <p className="text-xs text-muted-foreground">
            登入身分: {sess.adminName}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={locked ? "#" : "/admin/settings"}
            aria-label="賽事設定"
            aria-disabled={locked}
            tabIndex={locked ? -1 : undefined}
            className={locked ? "pointer-events-none" : ""}
          >
            <Button variant="ghost" size="icon" disabled={locked}>
              <Settings className="size-5" />
            </Button>
          </Link>
          <LogoutButton />
        </div>
      </header>

      {locked && <LockedBanner />}

      {tournament ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>
                {tournament.name} · {tournament.year}
              </span>
              <Link
                href="/admin/settings"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                編輯
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {tournament.num_courts} 場地 · 每場 {tournament.match_duration_min} 分
            {tournament.group_stage_time_limit_min
              ? ` · 預賽上限 ${tournament.group_stage_time_limit_min} 分`
              : ""}
          </CardContent>
        </Card>
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
          subtitle="星座分組"
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
