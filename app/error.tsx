"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Page-level error boundary — catches render / effect throws inside a route
// segment. Renders inside the root layout, so BottomNav and safe-area padding
// still apply. For layout-level failures, see app/global-error.tsx.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route error", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 pt-16 text-center">
      <p className="text-4xl">🏐</p>
      <h1 className="text-xl font-bold">哎呀,出了點問題</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        這個頁面暫時無法載入。若是計分中,請直接改用紙本記錄,稍後可從 Admin 補登。
      </p>
      {error.digest && (
        <p className="text-[11px] text-muted-foreground font-mono">
          參考編號:{error.digest}
        </p>
      )}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button onClick={reset}>再試一次</Button>
        <Link href="/" className="w-full">
          <Button variant="outline" className="w-full">
            回首頁
          </Button>
        </Link>
      </div>
    </div>
  );
}
