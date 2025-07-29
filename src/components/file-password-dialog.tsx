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

const PASSWORD_SCHEMA = z.object({
  password: z.string().min(1, "Password is required"),
});

type PasswordForm = z.infer<typeof PASSWORD_SCHEMA>;

type FilePasswordDialogProps = {
  fileId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function FilePasswordDialog({
  fileId,
  open,
  onOpenChange,
}: FilePasswordDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    ...trpc.files.setFilePassword.mutationOptions({
      onSuccess: () => {
        toast.success("Password set successfully");
        onOpenChange(false);
        reset();
        void queryClient.invalidateQueries({
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
  } = useForm<PasswordForm>({
    resolver: zodResolver(PASSWORD_SCHEMA),
    defaultValues: { password: "" },
  });

  const onSubmit = (data: PasswordForm) => {
    if (!fileId) return;
    mutate({ fileId, password: data.password });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set File Password</DialogTitle>
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
            placeholder="Enter password"
            {...register("password")}
            disabled={isPending}
            autoFocus
          />
          {errors.password && (
            <div className="text-destructive text-sm">
              {errors.password.message}
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
              {isPending ? "Setting..." : "Set"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { FilePasswordDialog };
