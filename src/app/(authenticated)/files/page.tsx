"use client";

import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  DownloadIcon,
  EditIcon,
  FolderIcon,
  HomeIcon,
  InfoIcon,
  LockIcon,
  MoreVerticalIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EncryptedFileDownload } from "@/components/encrypted-file-download";
import { EncryptedFileUploadDialog } from "@/components/encrypted-file-upload-dialog";
import { FileDeleteDialog } from "@/components/file-delete-dialog";
import { FileMetadataDrawer } from "@/components/file-metadata-drawer";
import { FileRenameDialog } from "@/components/file-rename-dialog";
import { FolderCreateDialog } from "@/components/folder-create-dialog";
import { GlobalDropzone } from "@/components/global-dropzone";
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
import { formatDate } from "@/lib/utils";
import type { AppRouter } from "@/server/api/root";
import { useTRPC } from "@/trpc/react";

// Infering types from tRPC router for full type safety
type RouterOutput = inferRouterOutputs<AppRouter>;
type FolderContents = RouterOutput["files"]["getFolderContents"];
type SearchContents = RouterOutput["files"]["searchFiles"];
type BreadcrumbData = { id: string | undefined; name: string };

// Helper function to format path for display
const formatPathDisplay = (path: string[]) => {
  if (path.length === 0) return "Root";
  return path.join(" / ");
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

// TODO: Populate it trpc instead?
const getFileUrl = (storagePath: string): string => {
  return `https://${env.NEXT_PUBLIC_UPLOADTHING_APPID}.ufs.sh/f/${storagePath}`;
};

const handleDownload = (path: string) => {
  if (!path) return;
  const fileUrl = getFileUrl(path);
  globalThis.open(fileUrl, "_blank");
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

type ViewProps = {
  foldersToRender: FolderContents["folders"] | SearchContents["folders"];
  filesToRender: FolderContents["files"] | SearchContents["files"];
  navigateToFolder: (folder: { id: string; name: string }) => void;
  startRenaming: (file: { id: string; name: string }) => void;
  onDeleteFile: (fileId: string) => void;
  onShowMetadata: (fileId: string) => void;
};

type FileActionsDropdownProps = {
  file: FolderContents["files"][number] | SearchContents["files"][number];
  startRenaming: (file: { id: string; name: string }) => void;
  onDeleteFile: (fileId: string) => void;
  onShowMetadata: (fileId: string) => void;
};

function FileActionsDropdown({
  file,
  startRenaming,
  onDeleteFile,
  onShowMetadata,
}: FileActionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVerticalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            startRenaming(file);
          }}
        >
          <EditIcon className="mr-2 h-4 w-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onShowMetadata(file.id);
          }}
        >
          <InfoIcon className="mr-2 h-4 w-4" />
          Info
        </DropdownMenuItem>
        {file.encryptedDeks.length > 0 ? (
          <EncryptedFileDownload file={file}>
            <DropdownMenuItem>
              <DownloadIcon className="mr-2 h-4 w-4" />
              Download (Encrypted)
            </DropdownMenuItem>
          </EncryptedFileDownload>
        ) : (
          <DropdownMenuItem
            onClick={() => {
              handleDownload(file.storagePath);
            }}
          >
            <DownloadIcon className="mr-2 h-4 w-4" />
            Download
          </DropdownMenuItem>
        )}
        <DropdownMenuItem>
          <ShareIcon className="mr-2 h-4 w-4" />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onDeleteFile(file.id);
          }}
        >
          <Trash2Icon className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GridView({
  foldersToRender,
  filesToRender,
  navigateToFolder,
  startRenaming,
  onDeleteFile,
  onShowMetadata,
}: ViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Folders */}
      {foldersToRender.map((folder) => (
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
                {"path" in folder && folder.path.length > 0 && (
                  <p className="text-muted-foreground text-xs italic">
                    📁 {formatPathDisplay(folder.path)}
                  </p>
                )}
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
      {filesToRender.map((files) => (
        <Card key={files.id} className="transition-shadow hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="text-2xl">{getFileIcon(files.mimeType)}</div>
                {files.passwordHash && (
                  <LockIcon className="absolute -top-1 -right-1 h-3 w-3 text-amber-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-medium">{files.name}</h4>
                <p className="text-muted-foreground text-sm">
                  {formatFileSize(files.size)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatDate(files.updatedAt)}
                </p>
                {"path" in files && files.path.length > 0 && (
                  <p className="text-muted-foreground text-xs italic">
                    📁 {formatPathDisplay(files.path)}
                  </p>
                )}
                {files.tags.length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {files.tags.slice(0, 2).map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="text-xs"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                    {files.tags.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{files.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <FileActionsDropdown
                file={files}
                startRenaming={startRenaming}
                onDeleteFile={onDeleteFile}
                onShowMetadata={onShowMetadata}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ListView({
  foldersToRender,
  filesToRender,
  navigateToFolder,
  startRenaming,
  onDeleteFile,
  onShowMetadata,
}: ViewProps) {
  return (
    <div className="space-y-2">
      {/* Folders */}
      {foldersToRender.map((folder) => (
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
            {"path" in folder && folder.path.length > 0 && (
              <p className="text-muted-foreground text-xs italic">
                📁 {formatPathDisplay(folder.path)}
              </p>
            )}
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
      {filesToRender.map((file) => (
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
            {"path" in file && file.path.length > 0 && (
              <p className="text-muted-foreground text-xs italic">
                📁 {formatPathDisplay(file.path)}
              </p>
            )}
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
          <FileActionsDropdown
            file={file}
            startRenaming={startRenaming}
            onDeleteFile={onDeleteFile}
            onShowMetadata={onShowMetadata}
          />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
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
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbData[]>([
    { id: undefined, name: "My Files" },
  ]);

  const [deleteDialogFileId, setDeleteDialogFileId] = useState<
    string | undefined
  >();

  const [renameDialogFile, setRenameDialogFile] = useState<
    { id: string; name: string } | undefined
  >();

  const [metadataDrawerFileId, setMetadataDrawerFileId] = useState<
    string | undefined
  >();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // tRPC Queries
  const { data: folderContents, isLoading: isFolderLoading } = useQuery(
    trpc.files.getFolderContents.queryOptions({
      folderId: currentFolderId ?? undefined,
    }),
  );

  // Search query - only execute if debouncedSearchQuery is not empty
  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    ...trpc.files.searchFiles.queryOptions({
      query: debouncedSearchQuery,
    }),
    enabled: debouncedSearchQuery.trim().length > 0, // Only run if there's a debounced search query
  });

  // Determine which data to use
  const isLoading =
    debouncedSearchQuery.trim().length > 0 ? isSearchLoading : isFolderLoading;

  const { foldersToRender, filesToRender } = useMemo(() => {
    return debouncedSearchQuery.trim().length > 0
      ? {
          // Use search results
          foldersToRender: searchResults?.folders ?? [],
          filesToRender: searchResults?.files ?? [],
        }
      : {
          // Use folder contents
          foldersToRender: folderContents?.folders ?? [],
          filesToRender: folderContents?.files ?? [],
        };
  }, [debouncedSearchQuery, searchResults, folderContents]);

  // Rename file handlers
  const startRenaming = (file: { id: string; name: string }) => {
    setRenameDialogFile(file);
  };

  // Show metadata handlers
  const showMetadata = (fileId: string) => {
    setMetadataDrawerFileId(fileId);
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
    setCurrentFolderId(targetFolder?.id);
  };

  const currentFolderName = breadcrumbs.at(-1)?.name ?? "Files";

  const renderContent = () => {
    if (isLoading) {
      return <LoadingView />;
    }

    if (foldersToRender.length === 0 && filesToRender.length === 0) {
      return <EmptyState searchQuery={debouncedSearchQuery} />;
    }

    if (viewMode === "grid") {
      return (
        <GridView
          foldersToRender={foldersToRender}
          filesToRender={filesToRender}
          navigateToFolder={navigateToFolder}
          startRenaming={startRenaming}
          onDeleteFile={setDeleteDialogFileId}
          onShowMetadata={showMetadata}
        />
      );
    }

    return (
      <ListView
        foldersToRender={foldersToRender}
        filesToRender={filesToRender}
        navigateToFolder={navigateToFolder}
        startRenaming={startRenaming}
        onDeleteFile={setDeleteDialogFileId}
        onShowMetadata={showMetadata}
      />
    );
  };

  return (
    <GlobalDropzone folderId={currentFolderId ?? undefined}>
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
            <EncryptedFileUploadDialog folderId={currentFolderId ?? undefined}>
              <Button variant="outline">
                <UploadIcon className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </EncryptedFileUploadDialog>
            <FolderCreateDialog parentId={currentFolderId ?? undefined}>
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

        {/* File Delete Dialog */}
        {deleteDialogFileId && (
          <FileDeleteDialog
            fileId={deleteDialogFileId}
            fileName={
              filesToRender.find((f) => f.id === deleteDialogFileId)?.name ?? ""
            }
            open={!!deleteDialogFileId}
            onOpenChange={(isOpen) => {
              if (!isOpen) setDeleteDialogFileId(undefined);
            }}
            onFileDeleted={() => {
              setDeleteDialogFileId(undefined);
            }}
          />
        )}

        {/* File Rename Dialog */}
        {renameDialogFile && (
          <FileRenameDialog
            fileId={renameDialogFile.id}
            fileName={renameDialogFile.name}
            open={!!renameDialogFile}
            onOpenChange={(isOpen) => {
              if (!isOpen) setRenameDialogFile(undefined);
            }}
            onFileRenamed={() => {
              setRenameDialogFile(undefined);
            }}
          />
        )}

        {/* File Metadata Drawer */}
        {metadataDrawerFileId && (
          <FileMetadataDrawer
            fileId={metadataDrawerFileId}
            open={!!metadataDrawerFileId}
            onOpenChange={(isOpen) => {
              if (!isOpen) setMetadataDrawerFileId(undefined);
            }}
          />
        )}
      </div>
    </GlobalDropzone>
  );
}
