import { Skeleton } from "@/components/ui/skeleton";

export function LoadingView() {
  return (
    <div className="space-y-4">
      {/* Grid view skeletons */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 12 }).map((_, index) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <div key={index} className="rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
