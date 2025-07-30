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

type FileRenameDialogProps = {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function FileRenameDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
}: FileRenameDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState(fileName);

  // Reset the input when dialog opens or file changes
  // TODO: Use react-hook-form to handle this and reset
  useEffect(() => {
    if (open) {
      setNewName(fileName);
    }
  }, [open, fileName]);

  const { mutate: renameFile, isPending } = useMutation(
    trpc.files.renameFile.mutationOptions({
      onSuccess: () => {
        toast.success("File renamed successfully");
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

  const handleRename = () => {
    if (!newName.trim()) return;

    renameFile({
      fileId,
      newName: newName.trim(),
    });
  };

  const handleCancel = () => {
    setNewName(fileName); // Reset to original name
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename File</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="fileName" className="text-sm font-medium">
              File Name
            </label>
            <input
              id="fileName"
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
              disabled={!newName.trim() || newName === fileName || isPending}
            >
              {isPending ? "Renaming..." : "Rename"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
