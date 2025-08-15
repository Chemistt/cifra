"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRoundIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useTotpVerification } from "@/components/totp-verification-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/react";

const RESET_PASSWORD_SCHEMA = z
  .object({
    newPassword: z.string().min(1, "Password is required"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof RESET_PASSWORD_SCHEMA>;

type FileResetPasswordDialogProps = {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FileResetPasswordDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
}: FileResetPasswordDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [pendingPasswordData, setPendingPasswordData] = useState<
    ResetPasswordForm | undefined
  >();

  const { verify: verifyTotp, TotpDialog } = useTotpVerification();

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(RESET_PASSWORD_SCHEMA),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    ...trpc.files.resetFilePassword.mutationOptions({
      onSuccess: async (data) => {
        toast.success(`Password reset successfully for "${data.fileName}"`);
        onOpenChange(false);
        form.reset();
        setPendingPasswordData(undefined);
        await queryClient.invalidateQueries({
          queryKey: trpc.files.getFolderContents.pathKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.files.getFileMetadata.pathKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
        setPendingPasswordData(undefined);
      },
    }),
  });

  const handleSubmit = async (data: ResetPasswordForm) => {
    try {
      // Store the password data and trigger TOTP verification
      setPendingPasswordData(data);

      // Verify TOTP before proceeding
      const totpVerified = await verifyTotp();

      if (totpVerified) {
        // TOTP verification successful, proceed with password reset
        resetPasswordMutation.mutate({
          fileId,
          newPassword: data.newPassword,
        });
      } else {
        // TOTP verification failed or cancelled
        setPendingPasswordData(undefined);
        toast.error("Two-factor authentication verification failed");
      }
    } catch (error) {
      console.error("Error during password reset:", error);
      setPendingPasswordData(undefined);
      toast.error("Failed to reset password");
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    if (!resetPasswordMutation.isPending && !pendingPasswordData) {
      onOpenChange(isOpen);
      if (!isOpen) {
        form.reset();
      }
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRoundIcon className="h-5 w-5" />
              Reset File Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for &quot;{fileName}&quot;. This action
              requires two-factor authentication verification.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit(handleSubmit)(event);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                {...form.register("newPassword")}
                placeholder="Enter new password"
                disabled={
                  resetPasswordMutation.isPending ||
                  Boolean(pendingPasswordData)
                }
              />
              {form.formState.errors.newPassword && (
                <div className="text-destructive text-sm">
                  {form.formState.errors.newPassword.message}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                {...form.register("confirmPassword")}
                placeholder="Confirm new password"
                disabled={
                  resetPasswordMutation.isPending ||
                  Boolean(pendingPasswordData)
                }
              />
              {form.formState.errors.confirmPassword && (
                <div className="text-destructive text-sm">
                  {form.formState.errors.confirmPassword.message}
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheckIcon className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Security Notice</span>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                This action requires two-factor authentication verification. You
                will be prompted to enter your TOTP code after clicking
                &quot;Reset Password&quot;.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  handleDialogClose(false);
                }}
                disabled={
                  resetPasswordMutation.isPending ||
                  Boolean(pendingPasswordData)
                }
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  resetPasswordMutation.isPending ||
                  Boolean(pendingPasswordData) ||
                  !form.formState.isValid
                }
              >
                {(() => {
                  if (resetPasswordMutation.isPending || pendingPasswordData) {
                    return (
                      <>
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        {pendingPasswordData ? "Verifying..." : "Resetting..."}
                      </>
                    );
                  }
                  return (
                    <>
                      <KeyRoundIcon className="mr-2 h-4 w-4" />
                      Reset Password
                    </>
                  );
                })()}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* TOTP Verification Dialog */}
      <TotpDialog
        title="Verify Identity for Password Reset"
        description="Please verify your identity with TOTP before resetting the file password."
        trustDeviceOption={false}
      />
    </>
  );
}
