/* eslint-disable unicorn/no-null */
"use client";

import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  DownloadIcon,
  FolderIcon,
  HomeIcon,
  LockIcon,
  MoreVerticalIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  UploadIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { FileUploadDialog } from "@/components/file-upload-dialog";
import { FolderCreateDialog } from "@/components/folder-create-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/env";
import type { AppRouter } from "@/server/api/root";
import { useTRPC } from "@/trpc/react";

// Infer types from your tRPC router for full type safety
type RouterOutput = inferRouterOutputs<AppRouter>;
type FolderItem = RouterOutput["files"]["getFolderContents"][number];
type BreadcrumbData = { id: string | null; name: string };

// Type guards for discriminated union
const isFolder = (
  item: FolderItem,
): item is FolderItem & { type: "folder" } => {
  return item.type === "folder";
};

const isFile = (item: FolderItem): item is FolderItem & { type: "file" } => {
  return item.type === "file";
};

// Utility functions
const formatFileSize = (bytes: bigint): string => {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === BigInt(0)) return "0 Bytes";
  const k = 1024;
  const index = Math.floor(Math.log(Number(bytes)) / Math.log(k));
  return `${String(Math.round((Number(bytes) / Math.pow(k, index)) * 100) / 100)} ${String(sizes[index])}`;
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.startsWith("video/")) return "🎥";
  if (mimeType.startsWith("audio/")) return "🎵";
  return "📄";
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

// TODO: Populate it trpc instead?
const getFileUrl = (storagePath: string): string => {
  return `https://${env.NEXT_PUBLIC_UPLOADTHING_APPID}.ufs.sh/f/${storagePath}`;
};

const handleDownload = (file: FolderItem & { type: "file" }) => {
  if (!file.storagePath) return;
  const fileUrl = getFileUrl(file.storagePath);
  window.open(fileUrl, "_blank");
};

// Loading component
function LoadingView() {
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

// Grid view component
type GridViewProps = {
  foldersToRender: FolderItem[];
  filesToRender: FolderItem[];
  navigateToFolder: (folder: { id: string; name: string }) => void;
};

function GridView({
  foldersToRender,
  filesToRender,
  navigateToFolder,
}: GridViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Folders */}
      {foldersToRender
        .filter((item) => isFolder(item))
        .map((folder) => (
          <Card
            key={folder.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => {
              navigateToFolder(folder);
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <FolderIcon className="h-8 w-8 text-blue-500" />
                  {folder.passwordHash && (
                    <LockIcon className="absolute -top-1 -right-1 h-3 w-3 text-amber-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-medium">{folder.name}</h4>
                  <p className="text-muted-foreground text-sm">
                    {formatDate(folder.updatedAt)}
                  </p>
                  {folder.tags.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {folder.tags.slice(0, 2).map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag.name}
                        </Badge>
                      ))}
                      {folder.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{folder.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

      {/* Files */}
      {filesToRender.map((item) =>
        isFile(item) ? (
          <Card key={item.id} className="transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="text-2xl">{getFileIcon(item.mimeType)}</div>
                  {item.passwordHash && (
                    <LockIcon className="absolute -top-1 -right-1 h-3 w-3 text-amber-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-medium">{item.name}</h4>
                  <p className="text-muted-foreground text-sm">
                    {formatFileSize(item.size)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(item.updatedAt)}
                  </p>
                  {item.tags.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {item.tags.slice(0, 2).map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag.name}
                        </Badge>
                      ))}
                      {item.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{item.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVerticalIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        handleDownload(item);
                      }}
                    >
                      <DownloadIcon className="mr-2 h-4 w-4" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <ShareIcon className="mr-2 h-4 w-4" />
                      Share
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ) : null,
      )}
    </div>
  );
}

// List view component
type ListViewProps = {
  foldersToRender: FolderItem[];
  filesToRender: FolderItem[];
  navigateToFolder: (folder: { id: string; name: string }) => void;
};

function ListView({
  foldersToRender,
  filesToRender,
  navigateToFolder,
}: ListViewProps) {
  return (
    <div className="space-y-2">
      {/* Folders */}
      {foldersToRender
        .filter((item) => isFolder(item))
        .map((folder) => (
          <div
            key={folder.id}
            className="hover:bg-muted flex cursor-pointer items-center gap-4 rounded-lg p-3"
            onClick={() => {
              navigateToFolder(folder);
            }}
          >
            <div className="relative">
              <FolderIcon className="h-6 w-6 text-blue-500" />
              {folder.passwordHash && (
                <LockIcon className="absolute -top-1 -right-1 h-3 w-3 text-amber-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-medium">{folder.name}</h4>
            </div>
            <div className="text-muted-foreground flex items-center gap-4 text-sm">
              <span>{formatDate(folder.updatedAt)}</span>
              <span>Folder</span>
            </div>
            {folder.tags.length > 0 && (
              <div className="flex gap-1">
                {folder.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="text-xs">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}

      <Separator />

      {/* Files */}
      {filesToRender
        .filter((item) => isFile(item))
        .map((file) => (
          <div
            key={file.id}
            className="hover:bg-muted flex items-center gap-4 rounded-lg p-3"
          >
            <div className="relative">
              <div className="text-xl">{getFileIcon(file.mimeType)}</div>
              {file.passwordHash && (
                <LockIcon className="absolute -top-1 -right-1 h-3 w-3 text-amber-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-medium">{file.name}</h4>
            </div>
            <div className="text-muted-foreground flex items-center gap-4 text-sm">
              <span>{formatDate(file.updatedAt)}</span>
              <span>{formatFileSize(file.size)}</span>
            </div>
            {file.tags.length > 0 && (
              <div className="flex gap-1">
                {file.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="text-xs">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    handleDownload(file);
                  }}
                >
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ShareIcon className="mr-2 h-4 w-4" />
                  Share
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
    </div>
  );
}

// Empty state component
type EmptyStateProps = {
  searchQuery: string;
};

function EmptyState({ searchQuery }: EmptyStateProps) {
  return (
    <div className="py-12 text-center">
      <FolderIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      <h3 className="mb-2 text-lg font-medium">No files found</h3>
      <p className="text-muted-foreground">
        {searchQuery
          ? "Try adjusting your search query"
          : "This folder is empty. Upload some files to get started."}
      </p>
    </div>
  );
}

// Main component
export default function FilesPage() {
  const trpc = useTRPC();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbData[]>([
    { id: null, name: "My Files" },
  ]);

  // tRPC Queries
  const {
    data: folderContents,
    isLoading,
    refetch,
  } = useQuery(
    trpc.files.getFolderContents.queryOptions({
      folderId: currentFolderId ?? undefined,
    }),
  );

  // Refresh function for after upload
  const handleUploadComplete = () => {
    void refetch();
  };

  // Refresh function for after folder creation
  const handleFolderCreated = () => {
    void refetch();
  };

  // Navigation functions
  const navigateToFolder = (folder: { id: string; name: string }) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs((previous) => [...previous, folder]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    const targetFolder = newBreadcrumbs.at(-1);
    setCurrentFolderId(targetFolder?.id ?? null);
  };

  // Filter data based on search
  const filteredItems = useMemo(() => {
    if (!folderContents) return [];
    if (!searchQuery) return folderContents;
    return folderContents.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [folderContents, searchQuery]);

  // Separate filtered items into folders and files for rendering
  const { foldersToRender, filesToRender } = useMemo(() => {
    const folders: FolderItem[] = [];
    const files: FolderItem[] = [];
    for (const item of filteredItems) {
      if (isFolder(item)) {
        folders.push(item);
      } else if (isFile(item)) {
        files.push(item);
      }
    }
    return { foldersToRender: folders, filesToRender: files };
  }, [filteredItems]);

  const currentFolderName = breadcrumbs.at(-1)?.name ?? "Files";

  const renderContent = () => {
    if (isLoading) {
      return <LoadingView />;
    }

    if (foldersToRender.length === 0 && filesToRender.length === 0) {
      return <EmptyState searchQuery={searchQuery} />;
    }

    if (viewMode === "grid") {
      return (
        <GridView
          foldersToRender={foldersToRender}
          filesToRender={filesToRender}
          navigateToFolder={navigateToFolder}
        />
      );
    }

    return (
      <ListView
        foldersToRender={foldersToRender}
        filesToRender={filesToRender}
        navigateToFolder={navigateToFolder}
      />
    );
  };

  return (
    <div className="flex h-full w-full flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Files</h1>
          <p className="text-muted-foreground">
            Manage your files and folders securely
          </p>
        </div>
        <div className="flex gap-2">
          <FileUploadDialog
            onUploadComplete={handleUploadComplete}
            folderId={currentFolderId ?? undefined}
          >
            <Button variant="outline">
              <UploadIcon className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </FileUploadDialog>
          <FolderCreateDialog
            onFolderCreated={handleFolderCreated}
            parentId={currentFolderId ?? undefined}
          >
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              New Folder
            </Button>
          </FolderCreateDialog>
        </div>
      </div>

      {/* Search and Breadcrumbs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="relative max-w-md flex-1">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
              }}
              className="pl-10"
            />
          </div>
        </div>

        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => {
                  navigateToBreadcrumb(0);
                }}
                className="flex cursor-pointer items-center gap-1"
              >
                <HomeIcon className="h-4 w-4" />
                {breadcrumbs[0]?.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs.slice(1).map((folder, index) => (
              <div
                key={folder.id ?? `folder-${String(index)}`}
                className="flex items-center"
              >
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {index === breadcrumbs.length - 2 ? (
                    <BreadcrumbPage>{folder.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={() => {
                        navigateToBreadcrumb(index + 1);
                      }}
                      className="cursor-pointer"
                    >
                      {folder.name}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Main Content */}
      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{currentFolderName}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setViewMode("grid");
                }}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setViewMode("list");
                }}
              >
                List
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
