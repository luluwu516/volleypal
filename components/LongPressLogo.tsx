"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

const HOLD_MS = 1200;

export function LongPressLogo({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      router.push("/admin/login");
    }, HOLD_MS);
  };
  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return (
    <div
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className="select-none"
    >
      {children}
    </div>
  );
}
