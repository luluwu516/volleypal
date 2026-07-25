import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
