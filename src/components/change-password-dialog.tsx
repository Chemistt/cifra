"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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

const CHANGE_PASSWORD_SCHEMA = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(1, "New password is required"),
});

type ChangePasswordForm = z.infer<typeof CHANGE_PASSWORD_SCHEMA>;

type ChangePasswordDialogProps = {
  fileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function ChangePasswordDialog({
  fileId,
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const trpc = useTRPC();

  const { mutate, isPending } = useMutation({
    ...trpc.files.changeFilePassword.mutationOptions({
      onSuccess: () => {
        toast.success("Password changed successfully");
        onOpenChange(false);
        reset();
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
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(CHANGE_PASSWORD_SCHEMA),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const onSubmit = (data: ChangePasswordForm) => {
    mutate({ fileId, ...data });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change File Password</DialogTitle>
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
          <Input
            type="password"
            placeholder="New password"
            {...register("newPassword")}
            disabled={isPending}
          />
          {errors.newPassword && (
            <div className="text-destructive text-sm">
              {errors.newPassword.message}
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
              {isPending ? "Changing..." : "Change"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ChangePasswordDialog };
