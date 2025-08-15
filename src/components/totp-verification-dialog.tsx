"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { authClient } from "@/lib/auth-client";

const TOTP_VERIFICATION_SCHEMA = z.object({
  code: z
    .string()
    .length(6, "TOTP code must be 6 digits")
    .regex(/^\d+$/, "TOTP code must contain only digits"),
  trustDevice: z.boolean(),
});

type TotpVerificationForm = z.infer<typeof TOTP_VERIFICATION_SCHEMA>;

type TotpVerificationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  title?: string;
  description?: string;
  trustDeviceOption?: boolean;
};

export function TotpVerificationDialog({
  open,
  onOpenChange,
  onSuccess,
  onError,
  title = "Two-Factor Authentication",
  description = "Please enter your TOTP code to verify your identity.",
  trustDeviceOption = true,
}: TotpVerificationDialogProps) {
  const [isVerifying, setIsVerifying] = useState(false);

  const form = useForm<TotpVerificationForm>({
    resolver: zodResolver(TOTP_VERIFICATION_SCHEMA),
    defaultValues: {
      code: "",
      trustDevice: false,
    },
  });

  const handleVerification = (data: TotpVerificationForm) => {
    setIsVerifying(true);

    // Handle async operation outside the form submit handler
    void (async () => {
      try {
        const { error } = await authClient.twoFactor.verifyTotp({
          code: data.code,
          trustDevice: data.trustDevice,
        });

        if (error) {
          const errorMessage = error.message ?? "TOTP verification failed";
          toast.error(errorMessage);
          onError?.(errorMessage);
          return;
        }

        toast.success("TOTP verification successful");
        onSuccess?.();
        onOpenChange(false);
        form.reset();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        toast.error(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsVerifying(false);
      }
    })();
  };

  const handleDialogClose = (open: boolean) => {
    if (!isVerifying) {
      onOpenChange(open);
      if (!open) {
        form.reset();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit(handleVerification)(event);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="totp-code">Authentication Code</Label>
            <Input
              id="totp-code"
              {...form.register("code")}
              placeholder="000000"
              className="text-center font-mono text-lg tracking-widest"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              disabled={isVerifying}
              onChange={(event) => {
                // Only allow digits
                const value = event.target.value.replaceAll(/\D/g, "");
                event.target.value = value;
                form.setValue("code", value);
              }}
            />
            {form.formState.errors.code && (
              <div className="text-destructive text-sm">
                {form.formState.errors.code.message}
              </div>
            )}
          </div>

          {trustDeviceOption && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="trust-device"
                {...form.register("trustDevice")}
                disabled={isVerifying}
                className="text-primary focus:ring-primary h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="trust-device" className="text-sm">
                Trust this device for 30 days
              </Label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleDialogClose(false);
              }}
              disabled={isVerifying}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isVerifying || form.watch("code").length === 0}
            >
              {isVerifying ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckIcon className="mr-2 h-4 w-4" />
                  Verify
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Hook for easier usage in high-risk scenarios
export function useTotpVerification() {
  const [isOpen, setIsOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveCallback, setResolveCallback] = useState<
    ((success: boolean) => void) | undefined
  >();

  const verify = (): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolveCallback(() => resolve);
      setIsResolving(true);
      setIsOpen(true);
    });
  };

  const handleSuccess = () => {
    setIsResolving(false);
    setIsOpen(false);
    resolveCallback?.(true);
    setResolveCallback(undefined);
  };

  const handleError = () => {
    setIsResolving(false);
    resolveCallback?.(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && isResolving) {
      setIsResolving(false);
      resolveCallback?.(false);
      setResolveCallback(undefined);
    }
    setIsOpen(open);
  };

  return {
    verify,
    TotpDialog: (
      props: Omit<
        TotpVerificationDialogProps,
        "open" | "onOpenChange" | "onSuccess" | "onError"
      >,
    ) => (
      <TotpVerificationDialog
        {...props}
        open={isOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    ),
    isOpen,
    isResolving,
  };
}
