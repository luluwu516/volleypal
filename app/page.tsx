import {
  getCurrentTournament,
  listAnnouncements,
} from "@/lib/db/repository";
import { Hero } from "@/components/Hero";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  FileText,
  ClipboardList,
  Bus,
  ShoppingBag,
  UtensilsCrossed,
  CupSoda,
  Utensils,
} from "lucide-react";
import { NavigateButton } from "@/components/NavigateButton";
import { VenueOptionList } from "@/components/VenueOptionList";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const revalidate = 30;

export default async function HomePage() {
  const tournament = await safe(getCurrentTournament, null);
  const announcements = tournament
    ? await safe(() => listAnnouncements(tournament.id), [])
    : [];

  return (
    <div className="flex flex-col gap-4">
      <Hero
        title={tournament?.name ?? "Setup pending"}
        subtitle={tournament?.year ? String(tournament.year) : undefined}
      />

      {announcements.length > 0 && (
        <section className="flex flex-col gap-2">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg p-3 text-sm border ${
                a.level === "urgent"
                  ? "bg-red-500/10 text-red-200 border-red-500/40"
                  : a.level === "warn"
                    ? "bg-amber-500/10 text-amber-200 border-amber-500/40"
                    : "bg-purple-500/10 text-purple-200 border-purple-500/40"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Badge
                  variant="secondary"
                  className="uppercase text-[10px] tracking-wider"
                >
                  {a.level}
                </Badge>
                <span className="text-xs opacity-60">
                  {new Date(a.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p>{a.body}</p>
            </div>
          ))}
        </section>
      )}

      {!tournament && (
        <Card>
          <CardHeader>
            <CardTitle>初次設定</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>還沒有賽事資料。請先連到 Supabase 並建立一個 tournament row：</p>
            <pre className="bg-muted/50 p-2 rounded text-xs overflow-x-auto">
{`insert into tournaments (name, year, mode, num_courts, match_duration_min)
values ('星座盃 2026', 2026, 'zodiac', 3, 30);`}
            </pre>
          </CardContent>
        </Card>
      )}

      {tournament && (
        <>
          <section>
            <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
              比賽詳情
            </h2>
            <Accordion type="single" collapsible className="rounded-lg border">
              <AccordionItem value="rules">
                <AccordionTrigger className="px-4">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-purple-400" />
                    競賽規章
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  {tournament.rules_doc_url ? (
                    <a
                      href={tournament.rules_doc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200 underline"
                    >
                      開啟 Google 文件
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    "尚未提供"
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="registration">
                <AccordionTrigger className="px-4">
                  <span className="flex items-center gap-2">
                    <ClipboardList className="size-4 text-purple-400" />
                    報名連結
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  {tournament.registration_form_url ? (
                    <a
                      href={tournament.registration_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200 underline"
                    >
                      前往報名表單
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    "尚未開放報名"
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>

          <section>
            <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
              場館資訊
            </h2>
            <Accordion type="single" collapsible className="rounded-lg border">
              <AccordionItem value="transport">
                <AccordionTrigger className="px-4">
                  <span className="flex items-center gap-2">
                    <Bus className="size-4 text-purple-400" />
                    交通
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 flex flex-col gap-3">
                  {tournament.venue_address ? (
                    <NavigateButton address={tournament.venue_address} />
                  ) : null}
                  {tournament.venue_transport ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {tournament.venue_transport}
                    </p>
                  ) : !tournament.venue_address ? (
                    <p className="text-sm text-muted-foreground">尚未提供</p>
                  ) : null}
                </AccordionContent>
              </AccordionItem>
              {tournament.venue_nearby && (
                <AccordionItem value="nearby">
                  <AccordionTrigger className="px-4">
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="size-4 text-purple-400" />
                      其他補給
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 text-sm text-muted-foreground whitespace-pre-line">
                    {tournament.venue_nearby}
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </section>

          <section>
            <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
              食物選擇
            </h2>
            <Accordion
              type="single"
              collapsible
              defaultValue={
                tournament.dinner_venue_name ? "dinner" : undefined
              }
              className="rounded-lg border"
            >
              <AccordionItem value="dinner">
                <AccordionTrigger className="px-4">
                  <span className="flex items-center gap-2">
                    <Utensils className="size-4 text-amber-400" />
                    晚餐餐廳
                    {tournament.dinner_venue_name && (
                      <span className="text-xs text-muted-foreground">
                        · {tournament.dinner_venue_name}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 flex flex-col gap-3">
                  {tournament.dinner_venue_name ? (
                    <>
                      <p className="text-sm">
                        賽後集合：
                        <span className="font-semibold">
                          {tournament.dinner_venue_name}
                        </span>
                      </p>
                      {tournament.dinner_venue_address && (
                        <NavigateButton
                          address={tournament.dinner_venue_address}
                        />
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">尚未公布</p>
                  )}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="lunch">
                <AccordionTrigger className="px-4">
                  <span className="flex items-center gap-2">
                    <UtensilsCrossed className="size-4 text-purple-400" />
                    午餐選擇
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4">
                  <VenueOptionList raw={tournament.venue_lunch_options} />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="drink">
                <AccordionTrigger className="px-4">
                  <span className="flex items-center gap-2">
                    <CupSoda className="size-4 text-purple-400" />
                    飲料選擇
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4">
                  <VenueOptionList raw={tournament.venue_drink_options} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        </>
      )}
    </div>
  );
}
