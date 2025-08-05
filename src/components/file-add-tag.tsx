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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

type Tag = {
  id: string;
  name: string;
};

type FileAddTagProps = {
  itemId: string;
  itemType: "file" | "folder";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const TAG_SCHEMA = z.object({
  tag: z.string().min(1, "Tag cannot be empty").max(32, "Tag too long"),
});

function FileAddTag({
  itemId,
  itemType,
  open = false,
  onOpenChange,
}: FileAddTagProps) {
  const [tags, setTags] = React.useState<Tag[]>([]);
  const [removingTagIds, setRemovingTagIds] = React.useState<Set<string>>(new Set());
  const [internalOpen, setInternalOpen] = React.useState(open);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  // Sync internal open state with prop
  React.useEffect(() => {
    setInternalOpen(open);
  }, [open]);

  // Fetch existing tags when dialog opens
  const { data: existingTags, isLoading: isLoadingTags } = useQuery({
    ...trpc.files.getItemTags.queryOptions({
      itemId,
      itemType,
    }),
    enabled: open,
  });

  // Set existing tags when they are fetched
  React.useEffect(() => {
    if (existingTags && open) {
      setTags(existingTags.map((tag: { id: string; name: string }) => ({ ...tag })));
    } else if (!open) {
      // Clear tags when dialog closes
      setTags([]);
    }
  }, [existingTags, open]);

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
      onSuccess: (_, variables) => {
        toast.success("Tag added successfully!");
        void queryClient.invalidateQueries({
          queryKey: trpc.files.getFolderContents.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.files.getItemTags.queryKey({
            itemId,
            itemType,
          }),
        });
        reset();
      },
      onError: (error) => {
        toast.error("Failed to add tag", { description: error.message });
      },
    }),
  );

  const removeTagMutation = useMutation(
    trpc.files.removeTagFromItem.mutationOptions({
      onSuccess: (data, variables) => {
        toast.success("Tag removed successfully!");
        void queryClient.invalidateQueries({
          queryKey: trpc.files.getFolderContents.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.files.getItemTags.queryKey({
            itemId,
            itemType,
          }),
        });
        setTags(previous => previous.filter(t => t.id !== variables.tagId));
        setRemovingTagIds(prev => {
          const next = new Set(prev);
          next.delete(variables.tagId);
          return next;
        });
      },
      onError: (error, variables) => {
        toast.error("Failed to remove tag", { description: error.message });
        setRemovingTagIds(prev => {
          const next = new Set(prev);
          next.delete(variables.tagId);
          return next;
        });
      },
    }),
  );

  const handleClose = () => {
    setInternalOpen(false);
    onOpenChange?.(false);
    reset();
    setTags([]);
    setRemovingTagIds(new Set());
  };

  const handleRemoveTag = React.useCallback((tag: Tag) => {
    setRemovingTagIds(prev => new Set(prev).add(tag.id));
    removeTagMutation.mutate({
      itemId,
      itemType,
      tagId: tag.id,
    });
  }, [itemId, itemType, removeTagMutation]);

  const onSubmit = (data: { tag: string }) => {
    const trimmed = data.tag.trim();
    if (
      trimmed &&
      !tags.some((tag) => tag.name.toLowerCase() === trimmed.toLowerCase())
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {isLoadingTags && (
            <div className="text-sm text-muted-foreground">Loading tags...</div>
          )}
          
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => {
              const isRemoving = removingTagIds.has(tag.id);
              return (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className={`select-none ${isRemoving ? "opacity-50" : ""}`}
                >
                  {tag.name}
                  <button
                    type="button"
                    className={`text-muted-foreground hover:text-foreground ml-2 p-0 border-0 bg-transparent cursor-pointer inline-flex items-center justify-center ${
                      isRemoving ? "cursor-not-allowed opacity-50" : ""
                    }`}
                    style={{ width: '12px', height: '12px' }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!isRemoving) {
                        handleRemoveTag(tag);
                      }
                    }}
                    onTouchStart={(event) => {
                      // Safari mobile touch support
                      event.preventDefault();
                    }}
                    disabled={isRemoving}
                    aria-label={`Remove tag ${tag.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              );
            })}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit(onSubmit)();
            }}
            className="flex flex-col gap-2"
            autoComplete="off"
          >
            <Input
              {...register("tag")}
              placeholder="Type a tag name and press Enter"
              disabled={isSubmitting || addTagMutation.isPending}
              autoFocus
            />
            {errors.tag && (
              <span className="text-xs text-red-500">{errors.tag.message}</span>
            )}
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={isSubmitting || addTagMutation.isPending}
              >
                Add Tag
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Done
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { FileAddTag };
export type { FileAddTagProps };
