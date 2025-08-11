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
import { useState } from "react";
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
import { useTRPC } from "@/trpc/react";

const ENABLE_TOTP_SCHEMA = z.object({
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
  totpCode: z.string().length(6, "TOTP code must be 6 digits"),
});

type EnableTotpForm = z.infer<typeof ENABLE_TOTP_SCHEMA>;
type DisableTotpForm = z.infer<typeof DISABLE_TOTP_SCHEMA>;
type GenerateBackupCodesForm = z.infer<typeof GENERATE_BACKUP_CODES_SCHEMA>;
type RecoverWithBackupForm = z.infer<typeof RECOVER_WITH_BACKUP_SCHEMA>;

export function SettingsTotp() {
  const trpc = useTRPC();
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [isBackupCodesDialogOpen, setIsBackupCodesDialogOpen] = useState(false);
  const [isBackupPasswordDialogOpen, setIsBackupPasswordDialogOpen] = useState(false);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeDataUrl: string;
    manualEntryKey: string;
    accountName: string;
    issuer: string;
  } | undefined>();
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  // Enable TOTP Form
  const enableTotpForm = useForm<EnableTotpForm>({
    resolver: zodResolver(ENABLE_TOTP_SCHEMA),
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
      totpCode: "",
    },
  });

  // Queries
  const passwordStatusQuery = useSuspenseQuery(trpc.totp.hasPassword.queryOptions());
  const totpStatusQuery = useSuspenseQuery(trpc.totp.hasTotpEnabled.queryOptions());
  const backupCodesStatusQuery = useSuspenseQuery(trpc.totp.getBackupCodesStatus.queryOptions());
  
  const { hasPassword } = passwordStatusQuery.data;
  const { hasTotpEnabled } = totpStatusQuery.data;
  const { hasBackupCodes, backupCodesCount } = backupCodesStatusQuery.data;

  // Mutations
  const generateSetupMutation = useMutation(
    trpc.totp.generateTotpSetup.mutationOptions({
      onSuccess: (data) => {
        setSetupData(data);
        setIsSetupDialogOpen(true);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const generateReplaceDeviceSetupMutation = useMutation(
    trpc.totp.generateReplaceDeviceSetup.mutationOptions({
      onSuccess: (data) => {
        setSetupData(data);
        setIsRecoveryDialogOpen(true);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const enableTotpMutation = useMutation(
    trpc.totp.enableTotp.mutationOptions({
      onSuccess: () => {
        toast.success("TOTP enabled successfully");
        setIsSetupDialogOpen(false);
        enableTotpForm.reset();
        void totpStatusQuery.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const disableTotpMutation = useMutation(
    trpc.totp.disableTotp.mutationOptions({
      onSuccess: () => {
        toast.success("TOTP disabled successfully");
        disableTotpForm.reset();
        void totpStatusQuery.refetch();
        void backupCodesStatusQuery.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const generateBackupCodesMutation = useMutation(
    trpc.totp.generateBackupCodes.mutationOptions({
      onSuccess: (data) => {
        setBackupCodes(data.backupCodes);
        setIsBackupCodesDialogOpen(true);
        setIsBackupPasswordDialogOpen(false); 
        generateBackupCodesForm.reset();
        void backupCodesStatusQuery.refetch();
        toast.success("Backup codes generated successfully");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const recoverWithBackupMutation = useMutation(
    trpc.totp.recoverWithBackupCode.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Recovery successful! ${String(data.remainingBackupCodes)} backup codes remaining.`);
        setIsRecoveryDialogOpen(false);
        recoverWithBackupForm.reset();
        void totpStatusQuery.refetch();
        void backupCodesStatusQuery.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  // Handlers
  const handleStartSetup = () => {
    generateSetupMutation.mutate();
  };

  const handleEnableTotp = (data: EnableTotpForm) => {
    if (!setupData) return;
    
    enableTotpMutation.mutate({
      secret: setupData.secret,
      totpCode: data.totpCode,
    });
  };

  const handleDisableTotp = (data: DisableTotpForm) => {
    disableTotpMutation.mutate({
      currentPassword: data.currentPassword,
    });
  };

  const handleGenerateBackupCodes = (data: GenerateBackupCodesForm) => {
    generateBackupCodesMutation.mutate({
      currentPassword: data.currentPassword,
    });
  };

  const handleRecoverWithBackup = (data: RecoverWithBackupForm) => {
    if (!setupData) return;
    
    recoverWithBackupMutation.mutate({
      backupCode: data.backupCode,
      newSecret: setupData.secret,
      totpCode: data.totpCode,
    });
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates((previous) => ({ ...previous, [key]: true }));
      toast.success("Copied to clipboard");
      setTimeout(() => {
        setCopiedStates((previous) => ({ ...previous, [key]: false }));
      }, 2000);
    } catch {
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              generateReplaceDeviceSetupMutation.mutate();
            }}
          >
            <RefreshCwIcon className="h-4 w-4" />
            Recover Device
          </Button>
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
                  This will remove two-factor authentication from your account. <br />
                  Make sure you have other authentication methods set up before proceeding.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="disable-password">Enter your password to confirm</Label>
                  <Input
                    id="disable-password"
                    type="password"
                    {...disableTotpForm.register("currentPassword")}
                    placeholder="Enter your password"
                    className="mt-2"
                  />
                  {disableTotpForm.formState.errors.currentPassword && (
                    <div className="text-destructive text-sm mt-1">
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

      {/* Backup Codes */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-1">
          <div className="font-medium">Backup Recovery Codes</div>
          <div className="text-muted-foreground text-sm">
            {hasBackupCodes 
              ? `${String(backupCodesCount)} backup codes available for account recovery`
              : "Generate backup codes to recover your account if you lose your device"
            }
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog open={isBackupPasswordDialogOpen} onOpenChange={setIsBackupPasswordDialogOpen}>
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
                    : "Generate backup codes to recover your account if you lose your authentication device."
                  }
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="backup-password">Enter your password to confirm</Label>
                  <Input
                    id="backup-password"
                    type="password"
                    {...generateBackupCodesForm.register("currentPassword")}
                    placeholder="Enter your password"
                    className="mt-2"
                  />
                  {generateBackupCodesForm.formState.errors.currentPassword && (
                    <div className="text-destructive text-sm mt-1">
                      {generateBackupCodesForm.formState.errors.currentPassword.message}
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
                    void generateBackupCodesForm.handleSubmit(handleGenerateBackupCodes)();
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
    </div>
  );

  const renderEmptyState = () => (
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
          {!hasTotpEnabled && hasPassword && (
            <Button
              onClick={handleStartSetup}
              size="sm"
              disabled={generateSetupMutation.isPending}
            >
              <PlusIcon className="h-4 w-4" />
              Enable TOTP
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {hasTotpEnabled ? renderTotpStatus() : renderEmptyState()}
        </CardContent>
      </Card>

      {/* Setup TOTP Dialog */}
      <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCodeIcon className="h-5 w-5" />
              Set up TOTP Authentication
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the verification code.
            </DialogDescription>
          </DialogHeader>

          {setupData && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="rounded-lg border p-4 bg-white">
                  <Image
                    src={setupData.qrCodeDataUrl}
                    alt="TOTP QR Code"
                    width={192}
                    height={192}
                    className="h-48 w-48"
                  />
                </div>
              </div>

              {/* Manual Entry */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Can&apos;t scan? Enter this code manually:
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={setupData.manualEntryKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void copyToClipboard(setupData.manualEntryKey, "setup-key");
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
                  void enableTotpForm.handleSubmit(handleEnableTotp)(event);
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="totp-code">Enter verification code</Label>
                  <Input
                    id="totp-code"
                    {...enableTotpForm.register("totpCode")}
                    placeholder="000000"
                    className="mt-2 text-center font-mono text-lg tracking-widest"
                    maxLength={6}
                    disabled={enableTotpMutation.isPending}
                  />
                  {enableTotpForm.formState.errors.totpCode && (
                    <div className="text-destructive text-sm mt-1">
                      {enableTotpForm.formState.errors.totpCode.message}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsSetupDialogOpen(false);
                      enableTotpForm.reset();
                    }}
                    disabled={enableTotpMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={enableTotpMutation.isPending}
                  >
                    {enableTotpMutation.isPending ? (
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
      <Dialog open={isBackupCodesDialogOpen} onOpenChange={setIsBackupCodesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5" />
              Your Backup Recovery Codes
            </DialogTitle>
            <DialogDescription>
              Save these codes in a secure location. Each code can only be used once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code) => (
                  <div
                    key={code}
                    className="flex items-center justify-between rounded border bg-white p-2 font-mono text-sm dark:bg-slate-800"
                  >
                    <span>{code}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void copyToClipboard(code, `backup-${code}`);
                      }}
                      className="h-6 w-6 p-0"
                    >
                      {copiedStates[`backup-${code}`] ? (
                        <CheckIcon className="h-3 w-3" />
                      ) : (
                        <CopyIcon className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const codesText = backupCodes.join('\n');
                  void copyToClipboard(codesText, 'all-codes');
                }}
              >
                {copiedStates['all-codes'] ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
                Copy All
              </Button>
              
              <Button
                onClick={() => {
                  const codesText = backupCodes.join('\n');
                  const blob = new Blob([codesText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'backup-codes.txt';
                  document.body.append(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
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

      {/* Recover Device with Backup Codes Dialog */}
      <Dialog open={isRecoveryDialogOpen} onOpenChange={setIsRecoveryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCwIcon className="h-5 w-5" />
              Recover TOTP Access
            </DialogTitle>
            <DialogDescription>
              Enter a backup code and set up your new authenticator device.
            </DialogDescription>
          </DialogHeader>

          {setupData && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void recoverWithBackupForm.handleSubmit(handleRecoverWithBackup)(event);
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
                  <div className="text-destructive text-sm mt-1">
                    {recoverWithBackupForm.formState.errors.backupCode.message}
                  </div>
                )}
              </div>

              {/* QR Code for new device */}
              <div className="flex justify-center">
                <div className="rounded-lg border p-4 bg-white">
                  <Image
                    src={setupData.qrCodeDataUrl}
                    alt="New TOTP QR Code"
                    width={192}
                    height={192}
                    className="h-48 w-48"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="recovery-totp-code">Verification Code from New Device</Label>
                <Input
                  id="recovery-totp-code"
                  {...recoverWithBackupForm.register("totpCode")}
                  placeholder="000000"
                  className="mt-2 text-center font-mono text-lg tracking-widest"
                  maxLength={6}
                  disabled={recoverWithBackupMutation.isPending}
                />
                {recoverWithBackupForm.formState.errors.totpCode && (
                  <div className="text-destructive text-sm mt-1">
                    {recoverWithBackupForm.formState.errors.totpCode.message}
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
