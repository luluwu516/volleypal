import { Skeleton } from "@/components/ui/skeleton";

export default function SchedulerLoading() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-56 w-full" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
