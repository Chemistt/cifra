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

const RESET_SHARE_PASSWORD_SCHEMA = z
  .object({
    newPassword: z.string().min(1, "Password is required"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetSharePasswordForm = z.infer<typeof RESET_SHARE_PASSWORD_SCHEMA>;

type ShareResetPasswordDialogProps = {
  shareGroupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPasswordUpdated?: () => void;
};

export function ShareResetPasswordDialog({
  shareGroupId,
  open,
  onOpenChange,
  onPasswordUpdated,
}: ShareResetPasswordDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [pendingPasswordData, setPendingPasswordData] = useState<
    ResetSharePasswordForm | undefined
  >();

  const { verify: verifyTotp, TotpDialog } = useTotpVerification();

  const form = useForm<ResetSharePasswordForm>({
    resolver: zodResolver(RESET_SHARE_PASSWORD_SCHEMA),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    ...trpc.sharing.resetShareGroupPassword.mutationOptions({
      onSuccess: async () => {
        toast.success("Share password reset successfully");
        onOpenChange(false);
        form.reset();
        setPendingPasswordData(undefined);
        onPasswordUpdated?.();
        await queryClient.invalidateQueries({
          queryKey: trpc.sharing.getMyShares.pathKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
        setPendingPasswordData(undefined);
      },
    }),
  });

  const handleSubmit = async (data: ResetSharePasswordForm) => {
    try {
      // Store the password data and trigger TOTP verification
      setPendingPasswordData(data);

      // Verify TOTP before proceeding
      const totpVerified = await verifyTotp();

      if (totpVerified) {
        // TOTP verification successful, proceed with password reset
        resetPasswordMutation.mutate({
          shareGroupId,
          newPassword: data.newPassword,
        });
      } else {
        // TOTP verification failed or cancelled
        setPendingPasswordData(undefined);
        toast.error("Two-factor authentication verification failed");
      }
    } catch (error) {
      console.error("Error during share password reset:", error);
      setPendingPasswordData(undefined);
      toast.error("Failed to reset share password");
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
              Reset Share Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for this share group. This action requires
              two-factor authentication verification.
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
        title="Verify Identity for Share Password Reset"
        description="Please verify your identity with TOTP before resetting the share password."
        trustDeviceOption={false}
      />
    </>
  );
}
