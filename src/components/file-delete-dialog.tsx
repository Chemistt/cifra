"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
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

type FileDeleteDialogProps = {
  fileId: string;
  fileName: string;
  onFileDeleted?: () => void;
  open: boolean; // Controlled open state
  onOpenChange: (isOpen: boolean) => void; // Callback to update open state
};

export function FileDeleteDialog({
  fileId,
  fileName,
  onFileDeleted,
  open,
  onOpenChange,
}: FileDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const trpc = useTRPC();

  const deleteFileMutation = useMutation(
    trpc.files.deleteFile.mutationOptions({
      onSuccess: () => {
        toast.success(`File "${fileName}" deleted successfully.`);
        onFileDeleted?.();
        onOpenChange(false); // Close the dialog
      },
      onError: (error) => {
        toast.error(`Failed to delete file: ${error.message}`);
      },
    }),
  );

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteFileMutation.mutateAsync({ id: fileId });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`Failed to delete file: ${error.message}`);
      } else {
        toast.error("Failed to delete file: Unknown error");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete File</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{fileName}</span>?<br />
            This action will move the file to trash and can be undone later.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
