import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  glyph?: string; // fallback emoji when no lucide icon fits
  title: string;
  body?: string;
  cta?: { href: string; label: string };
}

// Shared empty-state card used across admin + live surfaces so 「沒有…」
// screens stop looking like broken pages. Subtle dashed border, muted icon
// bubble, optional CTA that turns the dead-end into a next step.
export function EmptyState({ icon: Icon, glyph, title, body, cta }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 flex flex-col items-center justify-center gap-3 text-center">
      <div className="size-14 rounded-full bg-muted/40 grid place-items-center text-2xl text-muted-foreground">
        {Icon ? <Icon className="size-6" /> : (glyph ?? "•")}
      </div>
      <p className="text-sm font-medium">{title}</p>
      {body && (
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          {body}
        </p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="mt-1 text-xs font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}
