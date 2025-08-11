"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/react";

type FolderDeleteDialogProps = {
  folderId: string;
  folderName: string;
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function FolderDeleteDialog({
  folderId,
  folderName,
  open,
  onOpenChange,
}: FolderDeleteDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation(
    trpc.files.deleteFolder.mutationOptions({
      onSuccess: () => {
        toast.success(`Folder "${folderName}" deleted successfully.`);
        // Invalidate folder contents and search queries
        void queryClient.invalidateQueries({
          queryKey: trpc.files.getFolderContents.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.files.searchFiles.queryKey(),
        });
        onOpenChange(false); // Close the dialog
      },
      onError: (error) => {
        toast.error(`Failed to delete folder: ${error.message}`);
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{folderName}</span>?<br />
            The folder must be empty (no files or subfolders) to be deleted.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              mutate({ id: folderId });
            }}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
