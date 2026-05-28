import Image from "next/image";
import { LongPressLogo } from "./LongPressLogo";

interface Props {
  title: string;
  subtitle?: string;
}

/**
 * Cosmic-gradient hero banner. Compact height so announcements below remain
 * visible without scrolling on typical phones. Uses a layered background:
 * 1. Indigo→purple→slate-950 radial gradient
 * 2. Two sizes of star dots via repeated radial-gradient backgrounds
 */
export function Hero({ title, subtitle }: Props) {
  return (
    <LongPressLogo>
      <section className="relative overflow-hidden rounded-2xl border border-purple-500/20 px-4 py-6">
        {/* base cosmic gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(168,85,247,0.35), transparent 60%), radial-gradient(ellipse 100% 80% at 50% 100%, rgba(79,70,229,0.25), transparent 60%), #020617",
          }}
        />
        {/* star field */}
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 10% 20%, #fff 100%, transparent), radial-gradient(1px 1px at 80% 15%, #fff 100%, transparent), radial-gradient(1.5px 1.5px at 30% 70%, #fff 100%, transparent), radial-gradient(1px 1px at 65% 55%, #fff 100%, transparent), radial-gradient(1px 1px at 90% 80%, #fff 100%, transparent), radial-gradient(1.5px 1.5px at 15% 90%, #fbbf24 100%, transparent), radial-gradient(1px 1px at 50% 30%, #a855f7 100%, transparent), radial-gradient(1px 1px at 25% 40%, #fff 100%, transparent), radial-gradient(1px 1px at 70% 85%, #fff 100%, transparent), radial-gradient(1px 1px at 45% 10%, #fff 100%, transparent)",
          }}
        />
        {/* content */}
        <div className="relative flex flex-col items-center gap-2">
          <Image
            src="/logo-transparent-192.png"
            alt="VolleyPal"
            width={48}
            height={48}
            priority
            className="size-12"
          />

          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-br from-orange-400 to-amber-300 bg-clip-text text-transparent">
            VolleyPal
          </h1>
          {(title || subtitle) && (
            <p className="text-sm text-purple-200/80 text-center">
              {title}
              {subtitle ? ` · ${subtitle}` : ""}
            </p>
          )}
        </div>
      </section>
    </LongPressLogo>
  );
}
