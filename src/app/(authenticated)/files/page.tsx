"use client";

import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  DownloadIcon,
  EditIcon,
  FolderIcon,
  HomeIcon,
  InfoIcon,
  KeyRoundIcon,
  LockIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  TagIcon,
  Trash2Icon,
  UnlockIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { EncryptedFileDownload } from "@/components/encrypted-file-download";
import { EncryptedFileUploadDialog } from "@/components/encrypted-file-upload-dialog";
import { FileAddTag } from "@/components/file-add-tag";
import { FileDeleteDialog } from "@/components/file-delete-dialog";
import { FileMetadataDrawer } from "@/components/file-metadata-drawer";
import { FilePasswordDialog } from "@/components/file-password-dialog";
import { FileRenameDialog } from "@/components/file-rename-dialog";
import {
  FileSharingDialog,
  type ShareableFile,
} from "@/components/file-sharing-dialog";
import { FolderCreateDialog } from "@/components/folder-create-dialog";
import { FolderDeleteDialog } from "@/components/folder-delete-dialog";
import { FolderRenameDialog } from "@/components/folder-rename-dialog";
import { GlobalDropzone } from "@/components/global-dropzone";
import { LoadingView } from "@/components/loading-view";
import { RemovePasswordDialog } from "@/components/remove-password-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatFileSize, getFileIcon } from "@/lib/utils";
import type { AppRouter } from "@/server/api/root";
import { useTRPC } from "@/trpc/react";

type RouterOutput = inferRouterOutputs<AppRouter>;
type FolderContents = RouterOutput["files"]["getFolderContents"];
type SearchContents = RouterOutput["files"]["searchFiles"];
type BreadcrumbData = { id: string | undefined; name: string };

const formatPathDisplay = (path: string[]) => {
  if (path.length === 0) return "Root";
  return path.join(" / ");
};

type FileAction =
  | { type: "rename"; file: { id: string; name: string } }
  | { type: "delete"; fileId: string }
  | { type: "metadata"; fileId: string }
  | { type: "changePassword"; fileId: string }
  | { type: "removePassword"; fileId: string }
  | { type: "setPassword"; fileId: string }
  | { type: "share"; fileId: string }
  | { type: "download"; fileId: string };

type FolderAction =
  | { type: "rename"; folder: { id: string; name: string } }
  | { type: "delete"; folderId: string };

type ViewProps = {
  foldersToRender: FolderContents["folders"] | SearchContents["folders"];
  filesToRender: FolderContents["files"] | SearchContents["files"];
  navigateToFolder: (folder: { id: string; name: string }) => void;
  onShowTag: (itemId: string, itemType: "file" | "folder") => void;
  onFileAction: (action: FileAction) => void;
  onFolderAction: (action: FolderAction) => void;
};

type FileActionsContextMenuProps = {
  file: FolderContents["files"][number] | SearchContents["files"][number];
  onShowTag: (itemId: string, itemType: "file" | "folder") => void;
  onFileAction: (action: FileAction) => void;
  children: React.ReactNode;
};

function FileActionsContextMenu({
  file,
  onShowTag,
  onFileAction,
  children,
}: FileActionsContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            onFileAction({ type: "metadata", fileId: file.id });
          }}
        >
          <InfoIcon className="mr-2 h-4 w-4" />
          File Info
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            onFileAction({
              type: "rename",
              file: { id: file.id, name: file.name },
            });
          }}
        >
          <EditIcon className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            onFileAction({ type: "download", fileId: file.id });
          }}
        >
          <DownloadIcon className="mr-2 h-4 w-4" />
          Download
        </ContextMenuItem>
        {file.passwordHash ? (
          <>
            <ContextMenuItem
              onClick={() => {
                onFileAction({ type: "changePassword", fileId: file.id });
              }}
            >
              <KeyRoundIcon className="mr-2 h-4 w-4" />
              Change Password
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => {
                onFileAction({ type: "removePassword", fileId: file.id });
              }}
            >
              <UnlockIcon className="mr-2 h-4 w-4" />
              Remove Password
            </ContextMenuItem>
          </>
        ) : (
          <ContextMenuItem
            onClick={() => {
              onFileAction({ type: "setPassword", fileId: file.id });
            }}
          >
            <LockIcon className="mr-2 h-4 w-4" />
            Set Password
          </ContextMenuItem>
        )}
        {file.encryptedDeks.length > 0 && (
          <ContextMenuItem
            onClick={() => {
              onFileAction({ type: "share", fileId: file.id });
            }}
          >
            <ShareIcon className="mr-2 h-4 w-4" />
            Share
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={() => {
            onShowTag(file.id, "file");
          }}
        >
          <TagIcon className="mr-2 h-4 w-4" />
          Add Tag
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            onFileAction({ type: "delete", fileId: file.id });
          }}
        >
          <Trash2Icon className="mr-2 h-4 w-4" />
          Delete File
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

type FolderActionsContextMenuProps = {
  folder: FolderContents["folders"][number] | SearchContents["folders"][number];
  onShowTag: (itemId: string, itemType: "file" | "folder") => void;
  onFolderAction: (action: FolderAction) => void;
  children: React.ReactNode;
};

function FolderActionsContextMenu({
  folder,
  onShowTag,
  onFolderAction,
  children,
}: FolderActionsContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            onFolderAction({
              type: "rename",
              folder: { id: folder.id, name: folder.name },
            });
          }}
        >
          <EditIcon className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            onShowTag(folder.id, "folder");
          }}
        >
          <TagIcon className="mr-2 h-4 w-4" />
          Add Tag
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            onFolderAction({ type: "delete", folderId: folder.id });
          }}
        >
          <Trash2Icon className="mr-2 h-4 w-4" />
          Delete Folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function GridView({
  foldersToRender,
  filesToRender,
  navigateToFolder,
  onShowTag,
  onFileAction,
  onFolderAction,
}: ViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Folders */}
      {foldersToRender.map((folder) => (
        <FolderActionsContextMenu
          key={folder.id}
          folder={folder}
          onFolderAction={onFolderAction}
          onShowTag={onShowTag}
        >
          <Card
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
        </FolderActionsContextMenu>
      ))}

      {/* Files */}
      {filesToRender.map((files) => (
        <FileActionsContextMenu
          key={files.id}
          file={files}
          onFileAction={onFileAction}
          onShowTag={onShowTag}
        >
          <Card className="transition-shadow hover:shadow-md">
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
              </div>
            </CardContent>
          </Card>
        </FileActionsContextMenu>
      ))}
    </div>
  );
}

function ListView({
  foldersToRender,
  filesToRender,
  navigateToFolder,
  onShowTag,
  onFileAction,
  onFolderAction,
}: ViewProps) {
  return (
    <div className="space-y-2">
      {/* Folders */}
      {foldersToRender.map((folder) => (
        <FolderActionsContextMenu
          key={folder.id}
          folder={folder}
          onFolderAction={onFolderAction}
          onShowTag={onShowTag}
        >
          <div
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
        </FolderActionsContextMenu>
      ))}

      <Separator />

      {/* Files */}
      {filesToRender.map((file) => (
        <FileActionsContextMenu
          key={file.id}
          file={file}
          onFileAction={onFileAction}
          onShowTag={onShowTag}
        >
          <div className="hover:bg-muted flex items-center gap-4 rounded-lg p-3">
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
          </div>
        </FileActionsContextMenu>
      ))}
    </div>
  );
}

function EmptyState({
  searchQuery,
  hasTagFilters,
}: {
  searchQuery: string;
  hasTagFilters: boolean;
}) {
  const hasFilters = searchQuery || hasTagFilters;

  return (
    <div className="py-12 text-center">
      <FolderIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      <h3 className="mb-2 text-lg font-medium">No files found</h3>
      <p className="text-muted-foreground">
        {hasFilters
          ? "Try adjusting your search query or tag filters"
          : "This folder is empty. Upload some files to get started."}
      </p>
    </div>
  );
}

// Main component
export default function FilesPage() {
  const trpc = useTRPC();

  // query params from url
  const searchParameters = useSearchParams();
  const autoFillSearchQuery = searchParameters.get("query");

  // states
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState(autoFillSearchQuery ?? "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [changePasswordDialogFileId, setChangePasswordDialogFileId] = useState<
    string | undefined
  >();
  const [removePasswordDialogFileId, setRemovePasswordDialogFileId] = useState<
    string | undefined
  >();
  const [passwordDialogFileId, setPasswordDialogFileId] = useState<
    string | undefined
  >();
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
  const [shareDialogFiles, setShareDialogFiles] = useState<
    ShareableFile[] | undefined
  >();
  const [showTagDialog, setShowTagDialog] = useState<
    { id: string; type: "file" | "folder" } | undefined
  >();
  const [downloadFileId, setDownloadFileId] = useState<string | undefined>();

  // Folder dialog states
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<
    { id: string; name: string } | undefined
  >();
  const [renameFolderDialog, setRenameFolderDialog] = useState<
    { id: string; name: string } | undefined
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

  // Get user tags for filtering
  const { data: userTags } = useQuery(trpc.files.getUserTags.queryOptions());

  // Search query - execute if debouncedSearchQuery is not empty OR tags are selected
  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    ...trpc.files.searchFiles.queryOptions({
      query: debouncedSearchQuery,
      tagIds: selectedTagIds,
      tagMatchMode,
    }),
    enabled:
      debouncedSearchQuery.trim().length > 0 || selectedTagIds.length > 0,
  });

  // Determine which data to use
  const isLoading =
    debouncedSearchQuery.trim().length > 0 || selectedTagIds.length > 0
      ? isSearchLoading
      : isFolderLoading;

  const { foldersToRender, filesToRender } = useMemo(() => {
    const hasSearchQuery = debouncedSearchQuery.trim().length > 0;
    const hasTagFilters = selectedTagIds.length > 0;

    if (hasSearchQuery || hasTagFilters) {
      return {
        // Use search results
        foldersToRender: searchResults?.folders ?? [],
        filesToRender: searchResults?.files ?? [],
      };
    }

    return {
      // Use folder contents
      foldersToRender: folderContents?.folders ?? [],
      filesToRender: folderContents?.files ?? [],
    };
  }, [debouncedSearchQuery, selectedTagIds, searchResults, folderContents]);

  // File action handler
  const handleFileAction = (action: FileAction) => {
    switch (action.type) {
      case "rename": {
        setRenameDialogFile(action.file);
        break;
      }
      case "delete": {
        setDeleteDialogFileId(action.fileId);
        break;
      }
      case "metadata": {
        setMetadataDrawerFileId(action.fileId);
        break;
      }
      case "changePassword": {
        setChangePasswordDialogFileId(action.fileId);
        break;
      }
      case "removePassword": {
        setRemovePasswordDialogFileId(action.fileId);
        break;
      }
      case "setPassword": {
        setPasswordDialogFileId(action.fileId);
        break;
      }
      case "share": {
        // Find the file details from current folder or search results
        const fileToShare = filesToRender.find((f) => f.id === action.fileId);
        if (fileToShare) {
          setShareDialogFiles([
            {
              id: fileToShare.id,
              name: fileToShare.name,
              mimeType: fileToShare.mimeType,
            },
          ]);
        }
        break;
      }
      case "download": {
        setDownloadFileId(action.fileId);
        break;
      }
      default: {
        break;
      }
    }
  };

  // Folder action handler
  const handleFolderAction = (action: FolderAction) => {
    switch (action.type) {
      case "rename": {
        setRenameFolderDialog(action.folder);
        break;
      }
      case "delete": {
        // Find the folder details from current folder or search results
        const folderToDelete = foldersToRender.find(
          (f) => f.id === action.folderId,
        );
        if (folderToDelete) {
          setDeleteFolderDialog({
            id: folderToDelete.id,
            name: folderToDelete.name,
          });
        }
        break;
      }
      default: {
        break;
      }
    }
  };

  // Tag filtering handlers
  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((previous) =>
      previous.includes(tagId)
        ? previous.filter((id) => id !== tagId)
        : [...previous, tagId],
    );
  };

  const handleRemoveTag = (tagId: string) => {
    setSelectedTagIds((previous) => previous.filter((id) => id !== tagId));
  };

  const handleClearAllTags = () => {
    setSelectedTagIds([]);
  };

  const handleShowTag = (itemId: string, itemType: "file" | "folder") => {
    setShowTagDialog({ id: itemId, type: itemType });
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
      return (
        <EmptyState
          searchQuery={debouncedSearchQuery}
          hasTagFilters={selectedTagIds.length > 0}
        />
      );
    }

    if (viewMode === "grid") {
      return (
        <GridView
          foldersToRender={foldersToRender}
          filesToRender={filesToRender}
          navigateToFolder={navigateToFolder}
          onShowTag={handleShowTag}
          onFileAction={handleFileAction}
          onFolderAction={handleFolderAction}
        />
      );
    }

    return (
      <ListView
        foldersToRender={foldersToRender}
        filesToRender={filesToRender}
        navigateToFolder={navigateToFolder}
        onShowTag={handleShowTag}
        onFileAction={handleFileAction}
        onFolderAction={handleFolderAction}
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

            {/* Tag Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <TagIcon className="h-4 w-4" />
                  Tags
                  {selectedTagIds.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedTagIds.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Filter by tags
                    </Label>
                    <Select
                      value={tagMatchMode}
                      onValueChange={(value: "any" | "all") => {
                        setTagMatchMode(value);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Match any tag</SelectItem>
                        <SelectItem value="all">Match all tags</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {userTags?.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={tag.id}
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={() => {
                            handleTagToggle(tag.id);
                          }}
                        />
                        <Label
                          htmlFor={tag.id}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          {tag.name}
                        </Label>
                        <span className="text-muted-foreground text-xs">
                          {tag.totalCount}
                        </span>
                      </div>
                    ))}
                  </div>

                  {selectedTagIds.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearAllTags}
                      className="w-full"
                    >
                      Clear all filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Active Tag Filters */}
          {selectedTagIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-muted-foreground text-sm">
                Active filters:
              </span>
              {selectedTagIds.map((tagId) => {
                const tag = userTags?.find((t) => t.id === tagId);
                return tag ? (
                  <Badge key={tagId} variant="secondary" className="gap-1">
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => {
                        handleRemoveTag(tagId);
                      }}
                      className="hover:bg-secondary-foreground/20 rounded-full p-0.5"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : undefined;
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllTags}
                className="h-auto p-1 text-xs"
              >
                Clear all
              </Button>
            </div>
          )}

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

        {passwordDialogFileId && (
          <FilePasswordDialog
            fileId={passwordDialogFileId}
            open={!!passwordDialogFileId}
            onOpenChange={(open) => {
              if (!open) setPasswordDialogFileId(undefined);
            }}
          />
        )}

        {changePasswordDialogFileId && (
          <ChangePasswordDialog
            fileId={changePasswordDialogFileId}
            open={!!changePasswordDialogFileId}
            onOpenChange={(open) => {
              if (!open) setChangePasswordDialogFileId(undefined);
            }}
          />
        )}

        {removePasswordDialogFileId && (
          <RemovePasswordDialog
            fileId={removePasswordDialogFileId}
            open={!!removePasswordDialogFileId}
            onOpenChange={(open) => {
              if (!open) setRemovePasswordDialogFileId(undefined);
            }}
          />
        )}

        {showTagDialog && (
          <FileAddTag
            itemId={showTagDialog.id}
            itemType={showTagDialog.type}
            open={!!showTagDialog}
            onOpenChange={(isOpen) => {
              if (!isOpen) setShowTagDialog(undefined);
            }}
          />
        )}

        {/* File Sharing Dialog */}
        <FileSharingDialog
          files={shareDialogFiles ?? []}
          onCloseAction={() => {
            setShareDialogFiles(undefined);
          }}
        />

        {/* File Download Component */}
        {downloadFileId &&
          (() => {
            const fileToDownload = filesToRender.find(
              (f) => f.id === downloadFileId,
            );
            return fileToDownload ? (
              <EncryptedFileDownload
                file={fileToDownload}
                autoTrigger
                onDownloadStartAction={() => {
                  setDownloadFileId(undefined);
                }}
                key={downloadFileId} // Force re-mount on file change
              />
            ) : undefined;
          })()}

        {/* Folder Rename Dialog */}
        {renameFolderDialog && (
          <FolderRenameDialog
            folderId={renameFolderDialog.id}
            folderName={renameFolderDialog.name}
            open={!!renameFolderDialog}
            onOpenChange={(isOpen) => {
              if (!isOpen) setRenameFolderDialog(undefined);
            }}
          />
        )}

        {/* Folder Delete Dialog */}
        {deleteFolderDialog && (
          <FolderDeleteDialog
            folderId={deleteFolderDialog.id}
            folderName={deleteFolderDialog.name}
            open={!!deleteFolderDialog}
            onOpenChange={(isOpen) => {
              if (!isOpen) setDeleteFolderDialog(undefined);
            }}
          />
        )}
      </div>
    </GlobalDropzone>
  );
}
