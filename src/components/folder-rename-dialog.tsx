"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/react";

type FolderRenameDialogProps = {
  folderId: string;
  folderName: string;
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function FolderRenameDialog({
  folderId,
  folderName,
  open,
  onOpenChange,
}: FolderRenameDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState(folderName);

  // Reset the input when dialog opens or folder changes
  useEffect(() => {
    if (open) {
      setNewName(folderName);
    }
  }, [open, folderName]);

  const { mutate: renameFolder, isPending } = useMutation(
    trpc.files.renameFolder.mutationOptions({
      onSuccess: () => {
        toast.success("Folder renamed successfully");
        onOpenChange(false);
        void queryClient.invalidateQueries({
          queryKey: trpc.files.getFolderContents.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.files.searchFiles.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleRename = () => {
    if (!newName.trim()) return;

    renameFolder({
      folderId,
      newName: newName.trim(),
    });
  };

  const handleCancel = () => {
    setNewName(folderName); // Reset to original name
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="folderName" className="text-sm font-medium">
              Folder Name
            </label>
            <input
              id="folderName"
              type="text"
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
              }}
              className="mt-1 w-full rounded border p-2"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleRename();
                } else if (event.key === "Escape") {
                  handleCancel();
                }
              }}
              autoFocus
              disabled={isPending}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!newName.trim() || newName === folderName || isPending}
            >
              {isPending ? "Renaming..." : "Rename"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
