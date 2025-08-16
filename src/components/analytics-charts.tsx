"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BarChart3,
  Database,
  FileIcon,
  HardDrive,
  PieChart,
  TrendingUp,
} from "lucide-react";
import { Cell, Pie, PieChart as RechartsPieChart } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useTRPC } from "@/trpc/react";

// Chart color configurations
const chartColors = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
];

const mimeTypeConfig: ChartConfig = {
  count: {
    label: "Files",
    color: "#3b82f6",
  },
  Images: {
    label: "Images",
    color: "#3b82f6",
  },
  Documents: {
    label: "Documents",
    color: "#10b981",
  },
  Videos: {
    label: "Videos",
    color: "#f59e0b",
  },
  Audio: {
    label: "Audio",
    color: "#ef4444",
  },
  Archives: {
    label: "Archives",
    color: "#8b5cf6",
  },
  Other: {
    label: "Other",
    color: "#6b7280",
  },
};

const uploadStatsConfig: ChartConfig = {
  count: {
    label: "Files Uploaded",
    color: "#3b82f6",
  },
};

const sizeDistributionConfig: ChartConfig = {
  count: {
    label: "Number of Files",
    color: "#10b981",
  },
};

type MonthlyUpload = {
  month: string;
  count: number;
};

type MimeTypeStat = {
  category: string;
  count: number;
  totalSize: string;
  types: { mimeType: string; count: number; totalSize: string }[];
};

type StorageStat = {
  label: string;
  count: number;
  totalSize: string;
  totalSizeFormatted: string;
};

type RecentActivity = {
  date: string;
  uploads: number;
  downloads: number;
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsCharts() {
  const trpc = useTRPC();
  const { data: uploadStats } = useSuspenseQuery(
    trpc.files.getFileUploadStats.queryOptions(),
  );
  const { data: mimeTypeStats } = useSuspenseQuery(
    trpc.files.getMimeTypeStats.queryOptions(),
  );
  const { data: storageStats } = useSuspenseQuery(
    trpc.files.getStorageStats.queryOptions(),
  );
  const { data: recentActivity } = useSuspenseQuery(
    trpc.files.getRecentActivity.queryOptions(),
  );

  // Prepare data for charts
  const monthlyData = uploadStats.monthlyUploads.map((item: MonthlyUpload) => ({
    month: format(new Date(item.month + "-01"), "MMM yyyy"),
    count: item.count,
  }));

  const pieData = mimeTypeStats.map((item: MimeTypeStat, index: number) => ({
    category: item.category,
    count: item.count,
    totalSize: item.totalSize,
    fill: chartColors[index % chartColors.length],
  }));

  const sizeDistributionData = storageStats.map((item: StorageStat) => ({
    label: item.label,
    count: item.count,
    totalSize: item.totalSize,
  }));

  const activityData = recentActivity.map((item: RecentActivity) => ({
    date: format(new Date(item.date), "MMM dd"),
    uploads: item.uploads,
  }));

  // Calculate total uploads in the last 30 days using a for loop instead of reduce
  let totalRecentUploads = 0;
  for (const day of recentActivity) {
    totalRecentUploads += day.uploads;
  }

  return (
    <div className="space-y-8">
      {/* Overview Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Files"
          value={uploadStats.totalFiles.toLocaleString()}
          subtitle="Files in storage"
          icon={FileIcon}
        />
        <StatCard
          title="Total Storage"
          value={uploadStats.totalSizeFormatted}
          subtitle="Used storage space"
          icon={HardDrive}
        />
        <StatCard
          title="File Categories"
          value={mimeTypeStats.length}
          subtitle="Different file types"
          icon={Database}
        />
        <StatCard
          title="Recent Activity"
          value={totalRecentUploads.toString()}
          subtitle="Files uploaded (30 days)"
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Upload Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5" />
              Monthly Upload Trend
            </CardTitle>
            <CardDescription>
              Number of files uploaded per month over the last year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={uploadStatsConfig}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* File Types Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="size-5" />
              File Types Distribution
            </CardTitle>
            <CardDescription>Breakdown of files by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={mimeTypeConfig}>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        nameKey="category"
                        formatter={(value, name) => [
                          `${String(value)} files`,
                          name as string,
                        ]}
                      />
                    }
                  />
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="count"
                    nameKey="category"
                  >
                    {pieData.map((entry, index: number) => (
                      <Cell key={`cell-${String(index)}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* File Size Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5" />
              File Size Distribution
            </CardTitle>
            <CardDescription>Number of files by size range</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={sizeDistributionConfig}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sizeDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [
                          `${String(value)} files`,
                          "Count",
                        ]}
                      />
                    }
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5" />
              Recent Upload Activity
            </CardTitle>
            <CardDescription>
              Daily file uploads over the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={uploadStatsConfig}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [
                          `${String(value)} files`,
                          "Uploads",
                        ]}
                      />
                    }
                  />
                  <Bar dataKey="uploads" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
