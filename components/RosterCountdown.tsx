"use client";

import { useEffect, useState } from "react";

// Live HH:MM:SS countdown, only rendered inside the <24h window per product
// UX ("stop-slop"-ish: no need to show a 3-week 720h ticker). Server hydrates
// with the initial diff; client updates every second.
function fmtDiff(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function RosterCountdown({ publishIso }: { publishIso: string }) {
  const target = new Date(publishIso).getTime();
  // `null` on the server render — Date.now() would differ between the SSR
  // pass and hydration and every refresh would log a hydration warning.
  // First client tick populates the real diff.
  const [diff, setDiff] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setDiff(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (diff === null) {
    // Reserve the space so the surrounding layout doesn't jump when the
    // real countdown swaps in. 8 tabular chars ≈ same width as HH:MM:SS.
    return (
      <span
        className="tabular-nums font-mono text-amber-300 text-lg opacity-0"
        aria-hidden
      >
        00:00:00
      </span>
    );
  }
  if (diff <= 0) {
    return (
      <span className="text-emerald-400 font-medium">
        名單已公開,重新整理頁面即可查看
      </span>
    );
  }
  return (
    <span className="tabular-nums font-mono text-amber-300 text-lg">
      {fmtDiff(diff)}
    </span>
  );
}
