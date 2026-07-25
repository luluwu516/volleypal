import { Skeleton } from "@/components/ui/skeleton";

// Scoreboard: tab strip + big score panel + serve toggle + totals + status.
export default function ScoreEditLoading() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
