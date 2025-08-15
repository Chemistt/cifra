"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  KeyIcon,
  Loader2Icon,
  PlusIcon,
  QrCodeIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/react";

type BackupCodesListProps = {
  backupCodes: string[];
  copiedStates: Record<string, boolean>;
  copyToClipboard: (text: string, key: string) => Promise<void>;
};

function BackupCodesList({
  backupCodes,
  copiedStates,
  copyToClipboard,
}: BackupCodesListProps) {
  if (!Array.isArray(backupCodes) || backupCodes.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="text-muted-foreground col-span-2 py-8 text-center">
          No backup codes available
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {backupCodes.map((code) => (
        <div
          key={code}
          className="flex items-center justify-between rounded border bg-white p-2 font-mono text-sm dark:bg-slate-800"
        >
          <span>{String(code)}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void copyToClipboard(String(code), `backup-${String(code)}`);
            }}
            className="h-6 w-6 p-0"
          >
            {copiedStates[`backup-${String(code)}`] ? (
              <CheckIcon className="h-3 w-3" />
            ) : (
              <CopyIcon className="h-3 w-3" />
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}

const ENABLE_TOTP_SCHEMA = z.object({
  password: z.string().min(1, "Password is required"),
});

const VERIFY_TOTP_SCHEMA = z.object({
  totpCode: z.string().length(6, "TOTP code must be 6 digits"),
});

const DISABLE_TOTP_SCHEMA = z.object({
  currentPassword: z.string().min(1, "Password is required"),
});

const GENERATE_BACKUP_CODES_SCHEMA = z.object({
  currentPassword: z.string().min(1, "Password is required"),
});

const RECOVER_WITH_BACKUP_SCHEMA = z.object({
  backupCode: z.string().min(1, "Backup code is required"),
});

type EnableTotpForm = z.infer<typeof ENABLE_TOTP_SCHEMA>;
type VerifyTotpForm = z.infer<typeof VERIFY_TOTP_SCHEMA>;
type DisableTotpForm = z.infer<typeof DISABLE_TOTP_SCHEMA>;
type GenerateBackupCodesForm = z.infer<typeof GENERATE_BACKUP_CODES_SCHEMA>;
type RecoverWithBackupForm = z.infer<typeof RECOVER_WITH_BACKUP_SCHEMA>;

export function SettingsTotp() {
  const trpc = useTRPC();
  const { data: session, isPending: isSessionLoading } = useSession();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [isBackupCodesDialogOpen, setIsBackupCodesDialogOpen] = useState(false);
  const [isBackupPasswordDialogOpen, setIsBackupPasswordDialogOpen] =
    useState(false);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [setupData, setSetupData] = useState<
    | {
        totpURI: string;
        backupCodes: string[];
      }
    | undefined
  >();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  // Generate QR code when setupData changes
  useEffect(() => {
    if (setupData?.totpURI) {
      QRCode.toDataURL(setupData.totpURI)
        .then((dataUrl) => {
          if (typeof dataUrl === "string") {
            setQrCodeDataUrl(dataUrl);
          } else {
            console.error("Invalid QR code data URL format");
            toast.error("Failed to generate QR code");
          }
        })
        .catch((error: unknown) => {
          console.error("QR code generation error:", error);
          toast.error("Failed to generate QR code");
        });
    }
  }, [setupData?.totpURI]);

  // Enable TOTP Form (for password input to start setup)
  const enableTotpForm = useForm<EnableTotpForm>({
    resolver: zodResolver(ENABLE_TOTP_SCHEMA),
    defaultValues: {
      password: "",
    },
  });

  // Verify TOTP Form (for entering TOTP code)
  const verifyTotpForm = useForm<VerifyTotpForm>({
    resolver: zodResolver(VERIFY_TOTP_SCHEMA),
    defaultValues: {
      totpCode: "",
    },
  });

  // Remove TOTP Form
  const disableTotpForm = useForm<DisableTotpForm>({
    resolver: zodResolver(DISABLE_TOTP_SCHEMA),
    defaultValues: {
      currentPassword: "",
    },
  });

  // Generate Backup Codes Form
  const generateBackupCodesForm = useForm<GenerateBackupCodesForm>({
    resolver: zodResolver(GENERATE_BACKUP_CODES_SCHEMA),
    defaultValues: {
      currentPassword: "",
    },
  });

  // Recover Device with Backup Codes Form
  const recoverWithBackupForm = useForm<RecoverWithBackupForm>({
    resolver: zodResolver(RECOVER_WITH_BACKUP_SCHEMA),
    defaultValues: {
      backupCode: "",
    },
  });

  // Queries
  const passwordStatusQuery = useSuspenseQuery(
    trpc.totp.hasPassword.queryOptions(),
  );

  // Query if TOTP secret exists (setup started but not verified)
  const totpSecretQuery = useSuspenseQuery(
    trpc.totp.hasTotpEnabled.queryOptions(),
  );

  const { hasPassword } = passwordStatusQuery.data;
  const isTwoFactorEnabled = session?.user.twoFactorEnabled ?? false;
  const { hasTotpEnabled: hasTotpSecret } = totpSecretQuery.data;

  // Only query backup codes if 2FA is enabled
  const backupCodesStatusQuery = useSuspenseQuery(
    trpc.totp.getBackupCodesStatus.queryOptions(),
  );

  const { hasBackupCodes, backupCodesCount } = isTwoFactorEnabled
    ? backupCodesStatusQuery.data
    : { hasBackupCodes: false, backupCodesCount: 0 };

  // Mutations
  const generateSetupMutation = useMutation({
    mutationFn: async (data: EnableTotpForm) => {
      const { data: result, error } = await authClient.twoFactor.enable({
        password: data.password,
      });
      if (error) {
        throw new Error(error.message);
      }
      return result;
    },
    onSuccess: (data) => {
      setSetupData(data);
      setIsSetupDialogOpen(true);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const disableTotpMutation = useMutation({
    mutationFn: async (data: DisableTotpForm) => {
      const { data: result, error } = await authClient.twoFactor.disable({
        password: data.currentPassword,
      });
      if (error) {
        throw new Error(error.message);
      }
      return result;
    },
    onSuccess: () => {
      toast.success("TOTP disabled successfully");
      disableTotpForm.reset();
      // Refetch queries since 2FA status changed
      void totpSecretQuery.refetch();
      void backupCodesStatusQuery.refetch();
      // Session should automatically update from better-auth
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const generateBackupCodesMutation = useMutation({
    mutationFn: async (data: GenerateBackupCodesForm) => {
      const { data: result, error } =
        await authClient.twoFactor.generateBackupCodes({
          password: data.currentPassword,
        });
      if (error) {
        throw new Error(error.message);
      }
      return result;
    },
    onSuccess: (data) => {
      try {
        if (Array.isArray(data.backupCodes)) {
          setBackupCodes(data.backupCodes);
          setIsBackupCodesDialogOpen(true);
          setIsBackupPasswordDialogOpen(false);
          generateBackupCodesForm.reset();
          void backupCodesStatusQuery.refetch();
          toast.success("Backup codes generated successfully");
        } else {
          toast.error(
            "Failed to generate backup codes: Invalid response format",
          );
        }
      } catch (error) {
        console.error("Error processing generated backup codes:", error);
        toast.error("Failed to process backup codes");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const recoverWithBackupMutation = useMutation({
    mutationFn: async (data: RecoverWithBackupForm) => {
      const { data: result, error } =
        await authClient.twoFactor.verifyBackupCode({
          code: data.backupCode,
          trustDevice: true,
        });
      if (error) {
        throw new Error(error.message);
      }
      return result;
    },
    onSuccess: () => {
      toast.success("Recovery successful! Device has been trusted.");
      setIsRecoveryDialogOpen(false);
      recoverWithBackupForm.reset();
      // Note: Recovery doesn't change 2FA status, just device trust status
      void backupCodesStatusQuery.refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Handlers
  const handleStartSetup = () => {
    setIsPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = (data: EnableTotpForm) => {
    generateSetupMutation.mutate(data);
    setIsPasswordDialogOpen(false);
  };

  const handleVerifyTotp = async (data: VerifyTotpForm) => {
    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: data.totpCode,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("TOTP enabled successfully");
      setIsSetupDialogOpen(false);
      verifyTotpForm.reset();
      enableTotpForm.reset();

      // Show backup codes from the initial enable response
      if (setupData?.backupCodes && Array.isArray(setupData.backupCodes)) {
        setBackupCodes(setupData.backupCodes);
        setIsBackupCodesDialogOpen(true);
      }

      // Refetch queries since 2FA status changed
      void totpSecretQuery.refetch();
      void backupCodesStatusQuery.refetch();
      // Session should automatically update from better-auth to reflect twoFactorEnabled = true
    } catch (error) {
      console.error("Error verifying TOTP:", error);
      toast.error("Failed to verify TOTP code");
    }
  };

  const handleDisableTotp = (data: DisableTotpForm) => {
    disableTotpMutation.mutate(data);
  };

  const handleGenerateBackupCodes = (data: GenerateBackupCodesForm) => {
    generateBackupCodesMutation.mutate({
      currentPassword: data.currentPassword,
    });
  };

  const handleRecoverWithBackup = (data: RecoverWithBackupForm) => {
    recoverWithBackupMutation.mutate(data);
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      if (!text || typeof text !== "string") {
        toast.error("Invalid text to copy");
        return;
      }

      await navigator.clipboard.writeText(text);
      setCopiedStates((previous) => ({ ...previous, [key]: true }));
      toast.success("Copied to clipboard");
      setTimeout(() => {
        setCopiedStates((previous) => ({ ...previous, [key]: false }));
      }, 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const renderTotpStatus = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-1">
          <div className="font-medium">TOTP Authentication</div>
          <div className="text-muted-foreground text-sm">
            Two-factor authentication is enabled for your account
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Recovery option only available when 2FA is fully enabled */}
          {isTwoFactorEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsRecoveryDialogOpen(true);
              }}
            >
              <RefreshCwIcon className="h-4 w-4" />
              Recover Device
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <TrashIcon className="h-4 w-4" />
                Disable
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disable TOTP Authentication</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to disable TOTP authentication? <br />
                  This will remove two-factor authentication from your account.{" "}
                  <br />
                  Make sure you have other authentication methods set up before
                  proceeding.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="disable-password">
                    Enter your password to confirm
                  </Label>
                  <Input
                    id="disable-password"
                    type="password"
                    {...disableTotpForm.register("currentPassword")}
                    placeholder="Enter your password"
                    className="mt-2"
                  />
                  {disableTotpForm.formState.errors.currentPassword && (
                    <div className="text-destructive mt-1 text-sm">
                      {disableTotpForm.formState.errors.currentPassword.message}
                    </div>
                  )}
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    void disableTotpForm.handleSubmit(handleDisableTotp)();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {disableTotpMutation.isPending ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    "Disable TOTP"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Backup Codes - Only show when 2FA is fully enabled */}
      {isTwoFactorEnabled && (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <div className="font-medium">Backup Recovery Codes</div>
            <div className="text-muted-foreground text-sm">
              {hasBackupCodes
                ? `${Number.isFinite(backupCodesCount) ? String(backupCodesCount) : "Unknown number of"} backup codes available for account recovery`
                : "Generate backup codes to recover your account if you lose your device"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog
              open={isBackupPasswordDialogOpen}
              onOpenChange={setIsBackupPasswordDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <KeyIcon className="h-4 w-4" />
                  {hasBackupCodes ? "Regenerate" : "Generate"} Codes
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {hasBackupCodes ? "Regenerate" : "Generate"} Backup Codes
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {hasBackupCodes
                      ? "This will invalidate your existing backup codes and generate new ones."
                      : "Generate backup codes to recover your account if you lose your authentication device."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="backup-password">
                      Enter your password to confirm
                    </Label>
                    <Input
                      id="backup-password"
                      type="password"
                      {...generateBackupCodesForm.register("currentPassword")}
                      placeholder="Enter your password"
                      className="mt-2"
                    />
                    {generateBackupCodesForm.formState.errors
                      .currentPassword && (
                      <div className="text-destructive mt-1 text-sm">
                        {
                          generateBackupCodesForm.formState.errors
                            .currentPassword.message
                        }
                      </div>
                    )}
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => {
                      generateBackupCodesForm.reset();
                      setIsBackupPasswordDialogOpen(false);
                    }}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault();
                      void generateBackupCodesForm.handleSubmit(
                        handleGenerateBackupCodes,
                      )();
                    }}
                  >
                    {generateBackupCodesMutation.isPending ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      `${hasBackupCodes ? "Regenerate" : "Generate"} Codes`
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );

  const renderEmptyState = () => {
    // Handle intermediate state: TOTP secret exists but not verified
    if (hasTotpSecret && !isTwoFactorEnabled) {
      return (
        <div className="py-8 text-center">
          <ShieldCheckIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground mb-4">
            TOTP setup is incomplete. Please complete the verification process.
          </p>
          <p className="text-muted-foreground text-sm">
            You have started TOTP setup but haven&apos;t verified it yet.
            Complete the setup or start over.
          </p>
        </div>
      );
    }

    return (
      <div className="py-8 text-center">
        <ShieldCheckIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <p className="text-muted-foreground mb-4">
          TOTP authentication is not enabled.
        </p>
        {hasPassword ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Add an extra layer of security to your account with TOTP.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            You must set a password before enabling TOTP authentication.
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5" />
              TOTP Authentication
            </CardTitle>
            <CardDescription>
              Secure your account with time-based one-time passwords (TOTP).
            </CardDescription>
          </div>
          {/* Show Enable button only when no TOTP setup at all and user has password */}
          {!isTwoFactorEnabled && !hasTotpSecret && hasPassword && (
            <Button
              onClick={handleStartSetup}
              size="sm"
              disabled={generateSetupMutation.isPending}
            >
              {isSessionLoading ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <PlusIcon className="h-4 w-4" />
              )}
              Enable TOTP
            </Button>
          )}
          {/* Show Continue Setup button if TOTP secret exists but not verified */}
          {!isTwoFactorEnabled && hasTotpSecret && hasPassword && (
            <Button
              onClick={handleStartSetup}
              size="sm"
              disabled={generateSetupMutation.isPending}
              variant="outline"
            >
              {isSessionLoading ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="h-4 w-4" />
              )}
              Continue Setup
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isTwoFactorEnabled ? renderTotpStatus() : renderEmptyState()}
        </CardContent>
      </Card>

      {/* Password Input Dialog for TOTP Setup */}
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5" />
              Enable TOTP Authentication
            </DialogTitle>
            <DialogDescription>
              Enter your password to begin setting up two-factor authentication.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void enableTotpForm.handleSubmit(handlePasswordSubmit)(event);
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="setup-password">Current Password</Label>
              <Input
                id="setup-password"
                type="password"
                {...enableTotpForm.register("password")}
                placeholder="Enter your password"
                className="mt-2"
                disabled={generateSetupMutation.isPending}
              />
              {enableTotpForm.formState.errors.password && (
                <div className="text-destructive mt-1 text-sm">
                  {enableTotpForm.formState.errors.password.message}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsPasswordDialogOpen(false);
                  enableTotpForm.reset();
                }}
                disabled={generateSetupMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={generateSetupMutation.isPending}>
                {generateSetupMutation.isPending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Setup TOTP Dialog */}
      <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCodeIcon className="h-5 w-5" />
              Set up TOTP Authentication
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the
              verification code.
            </DialogDescription>
          </DialogHeader>

          {setupData && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="rounded-lg border bg-white p-4">
                  {qrCodeDataUrl ? (
                    <Image
                      src={qrCodeDataUrl}
                      alt="TOTP QR Code"
                      width={192}
                      height={192}
                      className="h-48 w-48"
                    />
                  ) : (
                    <div className="flex h-48 w-48 items-center justify-center rounded bg-gray-100">
                      <Loader2Icon className="h-8 w-8 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Manual Entry */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Can&apos;t scan? Enter this URI manually:
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={setupData.totpURI}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void copyToClipboard(setupData.totpURI, "setup-key");
                    }}
                  >
                    {copiedStates["setup-key"] ? (
                      <CheckIcon className="h-4 w-4" />
                    ) : (
                      <CopyIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Verification Form */}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyTotpForm.handleSubmit(handleVerifyTotp)(event);
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="totp-code">Enter verification code</Label>
                  <Input
                    id="totp-code"
                    {...verifyTotpForm.register("totpCode")}
                    placeholder="000000"
                    className="mt-2 text-center font-mono text-lg tracking-widest"
                    maxLength={6}
                    disabled={verifyTotpForm.formState.isSubmitting}
                  />
                  {verifyTotpForm.formState.errors.totpCode && (
                    <div className="text-destructive mt-1 text-sm">
                      {verifyTotpForm.formState.errors.totpCode.message}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsSetupDialogOpen(false);
                      verifyTotpForm.reset();
                    }}
                    disabled={verifyTotpForm.formState.isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={verifyTotpForm.formState.isSubmitting}
                  >
                    {verifyTotpForm.formState.isSubmitting ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      "Enable TOTP"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Backup Codes Display Dialog */}
      <Dialog
        open={isBackupCodesDialogOpen}
        onOpenChange={setIsBackupCodesDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5" />
              Your Backup Recovery Codes
            </DialogTitle>
            <DialogDescription>
              Save these codes in a secure location. Each code can only be used
              once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
              <BackupCodesList
                backupCodes={backupCodes}
                copiedStates={copiedStates}
                copyToClipboard={copyToClipboard}
              />
            </div>

            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (Array.isArray(backupCodes) && backupCodes.length > 0) {
                    const codesText = backupCodes.map(String).join("\n");
                    void copyToClipboard(codesText, "all-codes");
                  } else {
                    toast.error("No backup codes to copy");
                  }
                }}
                disabled={
                  !Array.isArray(backupCodes) || backupCodes.length === 0
                }
              >
                {copiedStates["all-codes"] ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
                Copy All
              </Button>

              <Button
                onClick={() => {
                  try {
                    if (Array.isArray(backupCodes) && backupCodes.length > 0) {
                      const codesText = backupCodes.map(String).join("\n");
                      const blob = new Blob([codesText], {
                        type: "text/plain",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "backup-codes.txt";
                      document.body.append(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    } else {
                      toast.error("No backup codes to download");
                    }
                  } catch (error) {
                    console.error("Error downloading backup codes:", error);
                    toast.error("Failed to download backup codes");
                  }
                }}
                disabled={
                  !Array.isArray(backupCodes) || backupCodes.length === 0
                }
              >
                <DownloadIcon className="h-4 w-4" />
                Download
              </Button>

              <Button
                variant="default"
                onClick={() => {
                  setIsBackupCodesDialogOpen(false);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRecoveryDialogOpen}
        onOpenChange={setIsRecoveryDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCwIcon className="h-5 w-5" />
              Recover TOTP Access
            </DialogTitle>
            <DialogDescription>
              Enter a backup code to recover access to your account and trust
              this device.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void recoverWithBackupForm.handleSubmit(handleRecoverWithBackup)(
                event,
              );
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="recovery-backup-code">Backup Recovery Code</Label>
              <Input
                id="recovery-backup-code"
                {...recoverWithBackupForm.register("backupCode")}
                placeholder="Enter backup code"
                className="mt-2 font-mono"
                disabled={recoverWithBackupMutation.isPending}
              />
              {recoverWithBackupForm.formState.errors.backupCode && (
                <div className="text-destructive mt-1 text-sm">
                  {recoverWithBackupForm.formState.errors.backupCode.message}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRecoveryDialogOpen(false);
                  recoverWithBackupForm.reset();
                }}
                disabled={recoverWithBackupMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={recoverWithBackupMutation.isPending}
              >
                {recoverWithBackupMutation.isPending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  "Recover Access"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
