"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, FolderIcon, HomeIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTRPC } from "@/trpc/react";

type FolderData = {
  id: string;
  name: string;
  passwordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: { id: string; name: string }[];
};

type FolderListProps = {
  isLoading: boolean;
  folders?: FolderData[];
  currentFolderId: string;
  selectedFolderId?: string;
  onSelectFolder: (folderId: string) => void;
  onNavigateToFolder: (folder: { id: string; name: string }) => void;
};

function FolderList({
  isLoading,
  folders,
  currentFolderId,
  selectedFolderId,
  onSelectFolder,
  onNavigateToFolder,
}: FolderListProps) {
  const isCurrentFolder = (folderId: string) => folderId === currentFolderId;
  const isSelectedFolder = (folderId: string) => folderId === selectedFolderId;

  if (isLoading) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        Loading folders...
      </div>
    );
  }

  if (!folders || folders.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        No folders in this location
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {folders.map((folder) => {
        const isCurrent = isCurrentFolder(folder.id);
        const isSelected = isSelectedFolder(folder.id);

        return (
          <div
            key={folder.id}
            className={`hover:bg-muted flex items-center justify-between rounded px-3 py-2 ${
              isSelected
                ? "bg-primary/10 ring-primary ring-1"
                : isCurrent
                  ? "bg-muted opacity-50"
                  : ""
            }`}
          >
            <button
              type="button"
              className={`flex items-center space-x-2 ${
                isCurrent ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={() => {
                if (!isCurrent) {
                  onSelectFolder(folder.id);
                }
              }}
              disabled={isCurrent}
            >
              <FolderIcon className="h-4 w-4" />
              <span className="text-sm">{folder.name}</span>
              {isCurrent && (
                <span className="text-muted-foreground text-xs">(current)</span>
              )}
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onNavigateToFolder(folder);
              }}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

type FileMoveDialogProps = {
  fileId: string;
  fileName: string;
  currentFolderId: string;
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function FileMoveDialog({
  fileId,
  fileName,
  currentFolderId,
  open,
  onOpenChange,
}: FileMoveDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedFolderId, setSelectedFolderId] = useState<
    string | undefined
  >();
  const [currentViewingFolderId, setCurrentViewingFolderId] = useState<
    string | undefined
  >();
  const [breadcrumbs, setBreadcrumbs] = useState<
    { id: string | undefined; name: string }[]
  >([{ id: undefined, name: "Root" }]);

  // Get folder contents for the current viewing folder
  const { data: folderContents, isLoading } = useQuery(
    trpc.files.getFolderContents.queryOptions({
      folderId: currentViewingFolderId,
    }),
  );

  const { mutate: moveFile, isPending } = useMutation(
    trpc.files.moveFile.mutationOptions({
      onSuccess: () => {
        toast.success("File moved successfully");
        onOpenChange(false);
        void queryClient.invalidateQueries({
          queryKey: trpc.files.getFolderContents.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleMove = () => {
    if (selectedFolderId === undefined) return;

    moveFile({
      fileId,
      targetFolderId: selectedFolderId,
    });
  };

  const handleCancel = () => {
    setSelectedFolderId(undefined);
    setCurrentViewingFolderId(undefined);
    setBreadcrumbs([{ id: undefined, name: "Root" }]);
    onOpenChange(false);
  };

  const navigateToFolder = (folder: { id: string; name: string }) => {
    setCurrentViewingFolderId(folder.id);
    setBreadcrumbs((previous) => [...previous, folder]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const targetBreadcrumb = breadcrumbs[index];
    if (targetBreadcrumb) {
      setCurrentViewingFolderId(targetBreadcrumb.id);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move &quot;{fileName}&quot;</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Breadcrumbs */}
          <div className="text-muted-foreground flex items-center space-x-1 text-sm">
            {breadcrumbs.map((breadcrumb, index) => (
              <div key={breadcrumb.id ?? "root"} className="flex items-center">
                <button
                  type="button"
                  className="hover:text-foreground"
                  onClick={() => {
                    navigateToBreadcrumb(index);
                  }}
                >
                  {index === 0 ? (
                    <HomeIcon className="h-4 w-4" />
                  ) : (
                    breadcrumb.name
                  )}
                </button>
                {index < breadcrumbs.length - 1 && (
                  <ChevronRightIcon className="mx-1 h-3 w-3" />
                )}
              </div>
            ))}
          </div>

          <Separator />

          {/* Folder List */}
          <ScrollArea className="h-64">
            <FolderList
              isLoading={isLoading}
              folders={folderContents?.folders}
              currentFolderId={currentFolderId}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onNavigateToFolder={navigateToFolder}
            />
          </ScrollArea>

          {/* Action Buttons */}
          <Separator />
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                // If we're viewing the root (currentViewingFolderId is undefined),
                // use the baseFolderId from the API response
                const targetId =
                  currentViewingFolderId ?? folderContents?.baseFolderId;
                setSelectedFolderId(targetId);
              }}
              disabled={
                (currentViewingFolderId ?? folderContents?.baseFolderId) ===
                  currentFolderId ||
                (currentViewingFolderId ?? folderContents?.baseFolderId) ===
                  selectedFolderId
              }
            >
              Select This Folder
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleMove}
                disabled={!selectedFolderId || isPending}
              >
                {isPending ? "Moving..." : "Move"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
