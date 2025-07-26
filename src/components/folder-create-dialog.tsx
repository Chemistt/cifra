"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/react";

type FolderCreateDialogProps = {
  parentId?: string;
  children?: React.ReactNode;
};

const folderNameSchema = z
  .string()
  .min(1, "Folder name is required")
  .max(255, "Folder name must be less than 255 characters")
  .refine((name) => !name.includes("/"), "Folder name cannot contain '/'")
  .refine(
    (name) => name.trim() === name,
    "Folder name cannot start or end with spaces",
  );

export function FolderCreateDialog({
  parentId,
  children,
}: FolderCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createFolderMutation = useMutation(
    trpc.files.createFolder.mutationOptions({
      onSuccess: (folder) => {
        toast.success(`Folder "${folder.name}" created successfully!`);
        setOpen(false);
        setFolderName("");
        void queryClient.invalidateQueries({
          queryKey: trpc.files.getFolderContents.pathKey(),
        });
      },
      onError: (error) => {
        toast.error(`Failed to create folder: ${error.message}`);
      },
      onSettled: () => {
        setIsCreating(false);
      },
    }),
  );

  const handleCreateFolder = () => {
    if (!folderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    const validation = folderNameSchema.safeParse(folderName.trim());
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Invalid folder name");
      return;
    }

    setIsCreating(true);
    createFolderMutation.mutate({
      name: folderName.trim(),
      // eslint-disable-next-line unicorn/no-null -- DB expects null
      parentId: parentId ?? null,
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !isCreating) {
      event.preventDefault();
      handleCreateFolder();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button>
            <FolderPlusIcon className="mr-2 h-4 w-4" />
            New Folder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Enter a name for the new folder. It will be created in the current
            directory.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              placeholder="Enter folder name..."
              value={folderName}
              onChange={(event) => {
                setFolderName(event.target.value);
              }}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Folder"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
