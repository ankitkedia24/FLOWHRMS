import { LoadingRegion, Skeleton } from "@/components/ui/Loading";

/** Employee screens: skeletons mirror the card layout; nav renders instantly. */
export default function EmployeeLoading() {
  return (
    <LoadingRegion label="Loading" className="flex flex-col gap-4 pt-2">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-44 w-full rounded-surface-card" />
      <Skeleton className="h-28 w-full rounded-surface-card" />
      <Skeleton className="h-28 w-full rounded-surface-card" />
    </LoadingRegion>
  );
}
