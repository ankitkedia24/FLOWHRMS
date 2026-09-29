import { LoadingRegion, Skeleton, SkeletonRows } from "@/components/ui/Loading";

/** Admin screens: header first, then fixed-count row skeletons. */
export default function AdminLoading() {
  return (
    <LoadingRegion label="Loading" className="flex flex-col gap-5">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-surface-card" />
        ))}
      </div>
      <SkeletonRows />
    </LoadingRegion>
  );
}
