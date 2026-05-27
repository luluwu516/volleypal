"use client";

import { MapPin } from "lucide-react";

/**
 * One-tap navigation. We give the user both options because:
 *  - iPhone users may prefer Apple Maps
 *  - Android / desktop / iPhone-with-Google-Maps-installed users prefer Google Maps
 * Both URLs work universally; the OS routes to the right app.
 */
export function NavigateButton({ address }: { address: string }) {
  const encoded = encodeURIComponent(address);
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  const appleUrl = `https://maps.apple.com/?daddr=${encoded}`;
  return (
    <div className="flex flex-col gap-2">
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-semibold text-slate-950 bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform"
      >
        <MapPin className="size-5" />
        一鍵導航至場館
      </a>
      <div className="flex items-center justify-center gap-4 text-xs">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Google Maps
        </a>
        <span className="text-muted-foreground/40">·</span>
        <a
          href={appleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Apple Maps
        </a>
      </div>
      <p className="text-[11px] text-muted-foreground text-center truncate">
        {address}
      </p>
    </div>
  );
}
