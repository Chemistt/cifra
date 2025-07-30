"use client";

import { X, Plus, TagIcon } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/use-toast";
import { useTRPC } from "@/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Tag = {
  value: string;
  label: string;
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

function FileAddTag({ itemId, itemType, open = false, onOpenChange }: FileAddTagProps) {
  const [selected, setSelected] = React.useState<Tag[]>([]);
  const [internalOpen, setInternalOpen] = React.useState(open);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const trpc = useTRPC();

  // Sync internal open state with prop
  React.useEffect(() => {
    setInternalOpen(open);
  }, [open]);

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
        toast({ title: "Tag added successfully!" });
        queryClient.invalidateQueries({ queryKey: ["files.getFolderContents"] });
        reset();
        handleClose();
      },
      onError: (error) => {
        toast({ title: "Failed to add tag", description: error.message });
      },
    })
  );

  const handleClose = () => {
    setInternalOpen(false);
    onOpenChange?.(false);
    reset();
    setSelected([]);
  };

  const handleUnselect = React.useCallback((tag: Tag) => {
    setSelected((prev) => prev.filter((s) => s.value !== tag.value));
  }, []);

  const onSubmit = (data: { tag: string }) => {
    const trimmed = data.tag.trim();
    if (trimmed && !selected.some((c) => c.label.toLowerCase() === trimmed.toLowerCase())) {
      const newTag = {
        value: trimmed.toLowerCase().replace(/\s+/g, "-"),
        label: trimmed,
      };
      setSelected((prev) => [...prev, newTag]);
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
          <DialogTitle>Add a Tag</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          autoComplete="off"
        >
          <div className="flex flex-wrap gap-1">
            {selected.map((tag) => (
              <Badge key={tag.value} variant="secondary" className="select-none">
                {tag.label}
                <X
                  className="size-3 text-muted-foreground hover:text-foreground ml-2 cursor-pointer"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleUnselect(tag)}
                />
              </Badge>
            ))}
          </div>
          <Input
            {...register("tag")}
            placeholder="Type a tag and press Enter"
            disabled={isSubmitting}
            autoFocus
          />
          {errors.tag && (
            <span className="text-red-500 text-xs">{errors.tag.message}</span>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              Add Tag
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { FileAddTag };
export type { FileAddTagProps };