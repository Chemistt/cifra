import { ChartBarIncreasing } from "lucide-react";
import { Suspense } from "react";

import { AnalyticsCharts } from "@/components/analytics-charts";
import { LoadingView } from "@/components/loading-view";
import { api, HydrateClient, prefetch } from "@/trpc/server";

export default function VisualsPage() {
  prefetch(api.files.getFileUploadStats.queryOptions());
  prefetch(api.files.getMimeTypeStats.queryOptions());
  prefetch(api.files.getStorageStats.queryOptions());
  prefetch(api.files.getRecentActivity.queryOptions());

  return (
    <div className="container mx-auto space-y-8 py-8">
      <div className="flex items-center gap-3">
        <ChartBarIncreasing className="text-primary size-8" />
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Visualize your file storage patterns and usage statistics
          </p>
        </div>
      </div>

      <HydrateClient>
        <Suspense fallback={<LoadingView />}>
          <AnalyticsCharts />
        </Suspense>
      </HydrateClient>
    </div>
  );
}
