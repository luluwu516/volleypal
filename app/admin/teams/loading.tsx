import { Skeleton } from "@/components/ui/skeleton";

// Teams page: roster table + several team cards.
export default function TeamsLoading() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div>
        <Skeleton className="h-3 w-16 mb-2" />
        <div className="rounded-lg border">
          <Skeleton className="h-9 w-full rounded-none" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-11 w-full rounded-none border-t border-border/40"
            />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-3 w-16 mb-2" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
