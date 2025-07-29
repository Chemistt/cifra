"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

const REMOVE_PASSWORD_SCHEMA = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
});

type RemovePasswordForm = z.infer<typeof REMOVE_PASSWORD_SCHEMA>;

type RemovePasswordDialogProps = {
  fileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function RemovePasswordDialog({
  fileId,
  open,
  onOpenChange,
}: RemovePasswordDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    ...trpc.files.removeFilePassword.mutationOptions({
      onSuccess: async () => {
        toast.success("Password removed successfully");
        onOpenChange(false);
        reset();
        await queryClient.invalidateQueries({
          queryKey: trpc.files.getFolderContents.pathKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RemovePasswordForm>({
    resolver: zodResolver(REMOVE_PASSWORD_SCHEMA),
    defaultValues: { currentPassword: "" },
  });

  const onSubmit = (data: RemovePasswordForm) => {
    mutate({ fileId, ...data });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove File Password</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit(onSubmit)(event);
          }}
          className="space-y-4"
        >
          <Input
            type="password"
            placeholder="Current password"
            {...register("currentPassword")}
            disabled={isPending}
            autoFocus
          />
          {errors.currentPassword && (
            <div className="text-destructive text-sm">
              {errors.currentPassword.message}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Removing..." : "Remove"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { RemovePasswordDialog };
