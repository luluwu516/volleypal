import { Skeleton } from "@/components/ui/skeleton";

// Generic admin skeleton: BackLink slot + header + a stack of card blocks.
// Serves every /admin/* route unless a more specific loading.tsx overrides.
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-56" />
      <div className="flex flex-col gap-3 pt-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
