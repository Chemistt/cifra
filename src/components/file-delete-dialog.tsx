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

type FileDeleteDialogProps = {
  fileId: string;
  fileName: string;
  onFileDeleted: () => void;
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation(
    trpc.files.deleteFile.mutationOptions({
      onSuccess: () => {
        toast.success(`File "${fileName}" deleted successfully.`);
        onFileDeleted();
        onOpenChange(false);
        void queryClient.invalidateQueries({
          queryKey: trpc.files.getFolderContents.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(`Failed to delete file: ${error.message}`);
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete File</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{fileName}</span>?<br />
            This action will move the file to &quot;Recently Deleted&quot;
            folder and can be undone later.
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
              mutate({ id: fileId });
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
