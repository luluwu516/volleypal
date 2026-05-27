import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href = "/admin", label = "Admin" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" />
      <span>{label}</span>
    </Link>
  );
}
