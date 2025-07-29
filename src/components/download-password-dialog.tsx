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
import { env } from "@/env";
import { useTRPC } from "@/trpc/react";

const DOWNLOAD_PASSWORD_SCHEMA = z.object({
  password: z.string().min(1, "Password is required"),
});

type DownloadPasswordForm = z.infer<typeof DOWNLOAD_PASSWORD_SCHEMA>;

type DownloadPasswordDialogProps = {
  fileId: string;
  fileName: string;
  storagePath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function DownloadPasswordDialog({
  fileId,
  fileName,
  storagePath,
  open,
  onOpenChange,
}: DownloadPasswordDialogProps) {
  const trpc = useTRPC();

  const { mutate, isPending } = useMutation({
    ...trpc.files.verifyFilePassword.mutationOptions({
      onSuccess: (data) => {
        if (data.valid) {
          window.open(getFileUrl(storagePath), "_blank");
          onOpenChange(false);
        } else {
          toast.error("Incorrect password");
        }
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
  } = useForm<DownloadPasswordForm>({
    resolver: zodResolver(DOWNLOAD_PASSWORD_SCHEMA),
    defaultValues: { password: "" },
  });

  const onSubmit = (data: DownloadPasswordForm) => {
    mutate({ fileId, password: data.password });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Password Required for {fileName}</DialogTitle>
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
              {isPending ? "Verifying..." : "Download"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Helper to get file URL (reuse your existing one)
function getFileUrl(storagePath: string) {
  return `https://${env.NEXT_PUBLIC_UPLOADTHING_APPID}.ufs.sh/f/${storagePath}`;
}

export { DownloadPasswordDialog };
