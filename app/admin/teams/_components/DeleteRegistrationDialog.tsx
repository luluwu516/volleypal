"use client";

import { toast } from "sonner";
import type { Registration } from "@/lib/db/types";
import { displayName } from "@/lib/format/name";
import { PinConfirmDialog } from "@/components/admin/PinConfirmDialog";

/**
 * PIN-gated destructive confirmation for hard-deleting a registration. Same
 * dialog is reused from the 球員列表 popover (RosterList) and 候補 popover
 * (WaitlistTable) — controlled by a `target` prop so the dialog can outlive
 * either popover being dismissed after "刪除報名" click.
 */
export function DeleteRegistrationDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: Registration | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  return (
    <PinConfirmDialog
      open={Boolean(target)}
      title={`刪除 ${target ? displayName(target) : ""}?`}
      description="此操作無法還原。若只是暫時移出球員列表,用「退回候補」。輸入你登入的 PIN 以確認刪除。"
      onClose={onClose}
      onConfirm={async (pin) => {
        if (!target) return;
        const res = await fetch(`/api/admin/registration/${target.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "刪除失敗");
        }
        toast.success("已刪除");
        onDeleted();
      }}
    />
  );
}
