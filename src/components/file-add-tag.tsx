"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useTRPC } from "@/trpc/react";

type FileTagDialogProps = {
  itemId: string;
  itemType: "file" | "folder";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const TAG_SCHEMA = z.object({
  tag: z.string().min(1, "Tag cannot be empty").max(32, "Tag too long"),
});

function FileTagDialog({
  itemId,
  itemType,
  open = false,
  onOpenChange,
}: FileTagDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(open);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  // Sync internal open state with prop
  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    setInternalOpen(open);
  }, [open]);

  // Fetch existing tags for the item
  const { data: fileData } = useQuery({
    ...trpc.files.getFileMetadata.queryOptions({ fileId: itemId }),
    enabled: !!itemId && itemType === "file" && open,
  });

  const { data: folderData } = useQuery({
    ...trpc.files.getFolderMetadata.queryOptions({ folderId: itemId }),
    enabled: !!itemId && itemType === "folder" && open,
  });

  const existingTags =
    itemType === "file" ? (fileData?.tags ?? []) : (folderData?.tags ?? []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ tag: string }>({
    resolver: zodResolver(TAG_SCHEMA),
    defaultValues: { tag: "" },
  });

  const addTagMutation = useMutation(
    trpc.files.addTagToItem.mutationOptions({
      onSuccess: () => {
        toast.success("Tag added successfully!");
        void queryClient.invalidateQueries({
          queryKey: trpc.files.getFolderContents.queryKey(),
        });
        if (itemType === "file") {
          void queryClient.invalidateQueries({
            queryKey: trpc.files.getFileMetadata.queryKey({ fileId: itemId }),
          });
        } else {
          void queryClient.invalidateQueries({
            queryKey: trpc.files.getFolderMetadata.queryKey({
              folderId: itemId,
            }),
          });
        }
        reset();
      },
      onError: (error) => {
        toast.error("Failed to add tag", { description: error.message });
      },
    }),
  );

  const removeTagMutation = useMutation(
    trpc.files.removeTagFromItem.mutationOptions({
      onSuccess: () => {
        toast.success("Tag removed successfully!");
        void queryClient.invalidateQueries({
          queryKey: trpc.files.getFolderContents.queryKey(),
        });
        if (itemType === "file") {
          void queryClient.invalidateQueries({
            queryKey: trpc.files.getFileMetadata.queryKey({ fileId: itemId }),
          });
        } else {
          void queryClient.invalidateQueries({
            queryKey: trpc.files.getFolderMetadata.queryKey({
              folderId: itemId,
            }),
          });
        }
      },
      onError: (error) => {
        toast.error("Failed to remove tag", { description: error.message });
      },
    }),
  );

  const handleClose = () => {
    setInternalOpen(false);
    onOpenChange?.(false);
    reset();
  };

  const handleRemoveTag = (tagId: string) => {
    removeTagMutation.mutate({
      itemId,
      itemType,
      tagId,
    });
  };

  const onSubmit = (data: { tag: string }) => {
    const trimmed = data.tag.trim();
    if (
      trimmed &&
      !existingTags.some(
        (tag) => tag.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      addTagMutation.mutate({
        itemId,
        itemType,
        tag: trimmed,
      });
    }
  };

  return (
    <Dialog open={internalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing Tags */}
          {existingTags.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Current Tags</h4>
              <div className="flex flex-wrap gap-2">
                {existingTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    {tag.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0.5 hover:bg-transparent"
                      onClick={() => {
                        handleRemoveTag(tag.id);
                      }}
                      disabled={removeTagMutation.isPending}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {existingTags.length > 0 && <Separator />}

          {/* Add New Tag */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Add New Tag</h4>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit(onSubmit)();
              }}
              className="space-y-3"
              autoComplete="off"
            >
              <Input
                {...register("tag")}
                placeholder="Type a tag name and press Enter"
                disabled={isSubmitting || addTagMutation.isPending}
                autoFocus
              />
              {errors.tag && (
                <span className="text-xs text-red-500">
                  {errors.tag.message}
                </span>
              )}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || addTagMutation.isPending}
                  className="flex-1"
                >
                  Add Tag
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="flex-1">
                    Done
                  </Button>
                </DialogClose>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { FileTagDialog };
export type { FileTagDialogProps };
