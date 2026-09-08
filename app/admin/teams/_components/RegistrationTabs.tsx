"use client";

import { useMemo, useState } from "react";
import type { Registration } from "@/lib/db/types";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RosterList } from "./RosterList";
import { WaitlistTable } from "./WaitlistTable";

/**
 * Splits registrations into two admin views:
 *   - active  → the current roster (RosterList, existing behaviour)
 *   - waitlist → both forms in but admin hasn't confirmed payment yet
 *     (WaitlistTable with checkbox + confirm per row)
 *
 * Registrations that lack a waiver (waiver_signed_at IS NULL) are hidden
 * entirely — they need to complete the paperwork before admin can act. The
 * pending waivers section (rendered separately outside the tabs) handles the
 * inverse case (waiver-in-hand but no registration).
 */
export function RegistrationTabs({
  registrations,
  disabled = false,
}: {
  registrations: Registration[];
  disabled?: boolean;
}) {
  const { active, waitlist } = useMemo(() => {
    const active: Registration[] = [];
    const waitlist: Registration[] = [];
    for (const r of registrations) {
      if (r.is_active) active.push(r);
      else if (r.waiver_signed_at) waitlist.push(r);
      // else: incomplete (missing waiver) — hidden from tabs by design.
    }
    // Waitlist ordered FIFO by whichever timestamp is EARLIER (registration
    // created_at vs waiver signed_at). Rewards whoever finished the whole
    // signup ceremony first.
    waitlist.sort((a, b) => {
      const aKey = Math.min(
        new Date(a.created_at).getTime(),
        a.waiver_signed_at ? new Date(a.waiver_signed_at).getTime() : Infinity,
      );
      const bKey = Math.min(
        new Date(b.created_at).getTime(),
        b.waiver_signed_at ? new Date(b.waiver_signed_at).getTime() : Infinity,
      );
      return aKey - bKey;
    });
    return { active, waitlist };
  }, [registrations]);

  const [tab, setTab] = useState<"active" | "waitlist">(
    // Bias initial tab toward the one that needs attention: if any waitlist
    // rows exist, open there. Otherwise show the roster.
    waitlist.length > 0 && active.length === 0 ? "waitlist" : "active",
  );

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "waitlist")}>
      <TabsList className="w-full">
        <TabsTrigger value="active" className="flex-1">
          球員列表 ({active.length})
        </TabsTrigger>
        <TabsTrigger value="waitlist" className="flex-1">
          候補 ({waitlist.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="active">
        <RosterList registrations={active} disabled={disabled} />
      </TabsContent>
      <TabsContent value="waitlist">
        <WaitlistTable waitlist={waitlist} disabled={disabled} />
      </TabsContent>
    </Tabs>
  );
}
