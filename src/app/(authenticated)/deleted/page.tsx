"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  MoreVerticalIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { formatFileSize, getFileIcon } from "@/lib/utils";
import type { AppRouter } from "@/server/api/root";
import { useTRPC } from "@/trpc/react";

import { LoadingView } from "../files/page";

// Constants
const FILE_RETENTION_DAYS = 30;

// Infering types from tRPC router for full type safety
type RouterOutput = inferRouterOutputs<AppRouter>;
type DeletedFile = RouterOutput["deleted"]["getDeletedFiles"][number];

type ViewProps = {
  filesToRender: DeletedFile[];
  onRestoreFile: (fileId: string) => void;
  onPermanentlyDeleteFile: (fileId: string) => void;
  isDeletingFile: boolean;
};

function ListView({
  filesToRender,
  onRestoreFile,
  onPermanentlyDeleteFile,
  isDeletingFile,
}: ViewProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFileForDeletion, setSelectedFileForDeletion] = useState<
    DeletedFile | undefined
  >();

  return (
    <div className="space-y-2">
      {filesToRender.map((file) => (
        <div
          key={file.id}
          className="hover:bg-muted flex items-center gap-4 rounded-lg p-3"
        >
          <div className="text-xl">{getFileIcon(file.mimeType)}</div>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium">{file.name}</h4>
          </div>
          <div className="text-muted-foreground flex items-center gap-4 text-sm">
            <span>
              Deleted {file.deletedAt ? formatDate(file.deletedAt) : "Unknown"}
            </span>
            <span>{formatFileSize(file.size)}</span>
            {file.deletedAt && (
              <span className="font-medium text-orange-600">
                {file.daysRemaining} days left
              </span>
            )}
          </div>
          {file.tags.length > 0 && (
            <div className="flex gap-1">
              {file.tags.slice(0, 2).map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-xs">
                  {tag.name}
                </Badge>
              ))}
              {file.tags.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{file.tags.length - 2}
                </Badge>
              )}
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
                  onRestoreFile(file.id);
                }}
              >
                <RefreshCwIcon className="mr-2 h-4 w-4" />
                Restore
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedFileForDeletion(file);
                  setDeleteDialogOpen(true);
                }}
                disabled={isDeletingFile}
                className="text-foreground focus:text-foreground"
              >
                <Trash2Icon className="mr-2 h-4 w-4" />
                {isDeletingFile ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete File</DialogTitle>
            <DialogDescription>
              {selectedFileForDeletion && (
                <>
                  This will permanently delete{" "}
                  <span className="font-medium">
                    {selectedFileForDeletion.name}
                  </span>
                  .<br />
                  This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedFileForDeletion) {
                  onPermanentlyDeleteFile(selectedFileForDeletion.id);
                  setDeleteDialogOpen(false);
                  setSelectedFileForDeletion(undefined);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="py-12 text-center">
      <Trash2Icon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      <h3 className="mb-2 text-lg font-medium">No deleted files found</h3>
      <p className="text-muted-foreground">
        {searchQuery
          ? "Try adjusting your search query"
          : "You don't have any deleted files at the moment."}
      </p>
    </div>
  );
}

export default function DeletedPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // tRPC Queries
  const { data: deletedFiles, isLoading } = useQuery(
    trpc.deleted.getDeletedFiles.queryOptions(),
  );

  // Filter files based on search query
  const filesToRender = useMemo(() => {
    if (!deletedFiles) return [];
    if (!searchQuery.trim()) return deletedFiles;

    return deletedFiles.filter((file) =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [deletedFiles, searchQuery]);

  // tRPC Mutations
  const { mutate: restoreFile } = useMutation(
    trpc.deleted.restoreFile.mutationOptions({
      onSuccess: (_, variables) => {
        const fileName =
          filesToRender.find((file) => file.id === variables.id)?.name ??
          "File";
        toast.success(`File "${fileName}" restored successfully.`);
        // Invalidate using predicate for broader matching
        void queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === "deleted" ||
              (Array.isArray(query.queryKey[0]) &&
                (query.queryKey[0][0] === "deleted" ||
                  query.queryKey[0][0] === "files"))
            );
          },
        });
      },
      onError: (error) => {
        toast.error(`Failed to restore file: ${error.message}`);
      },
    }),
  );

  const { mutate: permanentlyDeleteFile, isPending: isDeletingFile } =
    useMutation(
      trpc.deleted.permanentlyDeleteFile.mutationOptions({
        onSuccess: (result) => {
          toast.success(result.message);
          // Invalidate deleted files query to refresh the list
          void queryClient.invalidateQueries({
            predicate: (query) => {
              return (
                query.queryKey[0] === "deleted" ||
                (Array.isArray(query.queryKey[0]) &&
                  query.queryKey[0][0] === "deleted")
              );
            },
          });
        },
        onError: (error) => {
          toast.error(`Failed to permanently delete file: ${error.message}`);
        },
      }),
    );

  const handleRestoreFile = (fileId: string) => {
    restoreFile({ id: fileId });
  };

  const handlePermanentlyDeleteFile = (fileId: string) => {
    permanentlyDeleteFile({ id: fileId });
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingView />;
    }

    if (filesToRender.length === 0) {
      return <EmptyState searchQuery={searchQuery} />;
    }

    return (
      <ListView
        filesToRender={filesToRender}
        onRestoreFile={handleRestoreFile}
        onPermanentlyDeleteFile={handlePermanentlyDeleteFile}
        isDeletingFile={isDeletingFile}
      />
    );
  };

  return (
    <div className="flex h-full w-full flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recently Deleted</h1>
          <p className="text-muted-foreground">
            Restore or manage your deleted files.
            <br />
            Note: Deleted files are kept for {FILE_RETENTION_DAYS} days before
            automatic permanent deletion.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="relative max-w-md flex-1">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search deleted files..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
              }}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>My Deleted Files</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
