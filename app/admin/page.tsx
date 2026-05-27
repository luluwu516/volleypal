import Link from "next/link";
import { Settings } from "lucide-react";
import { getAdminSession } from "@/lib/auth/getSession";
import { getCurrentTournament } from "@/lib/db/repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./_components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const sess = await getAdminSession();
  const tournament = await getCurrentTournament().catch(() => null);

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
          <Link href="/admin/settings" aria-label="賽事設定">
            <Button variant="ghost" size="icon">
              <Settings className="size-5" />
            </Button>
          </Link>
          <LogoutButton />
        </div>
      </header>

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
        <Link href="/admin/teams">
          <Button variant="outline" className="w-full h-20 flex-col">
            <span>分隊</span>
            <span className="text-xs text-muted-foreground">星座分組</span>
          </Button>
        </Link>
        <Link href="/admin/scheduler">
          <Button variant="outline" className="w-full h-20 flex-col">
            <span>賽程</span>
            <span className="text-xs text-muted-foreground">生成 / 重排</span>
          </Button>
        </Link>
        <Link href="/admin/score">
          <Button variant="outline" className="w-full h-20 flex-col">
            <span>計分</span>
            <span className="text-xs text-muted-foreground">挑場比賽</span>
          </Button>
        </Link>
        <Link href="/admin/announce">
          <Button variant="outline" className="w-full h-20 flex-col">
            <span>廣播</span>
            <span className="text-xs text-muted-foreground">緊急公告</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
