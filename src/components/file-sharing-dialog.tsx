"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarIcon,
  CopyIcon,
  LockIcon,
  ShareIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useTRPC } from "@/trpc/react";

export type ShareableFile = {
  id: string;
  name: string;
  mimeType: string;
};

type FileSharingDialogProps = {
  files: ShareableFile[];
  children?: React.ReactNode;
  onCloseAction?: () => void;
};

export function FileSharingDialog({
  files,
  children,
  onCloseAction,
}: FileSharingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [shareLink, setShareLink] = useState<string | undefined>();

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Auto-open dialog when files are provided
  useEffect(() => {
    if (files.length > 0) {
      setIsOpen(true);
    }
  }, [files]);

  const createShareMutation = useMutation(
    trpc.sharing.createShareGroup.mutationOptions({
      onSuccess: (data) => {
        const link = `${globalThis.location.origin}/sharing/${data.linkToken}`;
        setShareLink(link);

        toast.success(
          `Files shared successfully! ${String(data.successfulShares)} out of ${String(
            files.length * recipientEmails.length,
          )} shares created.`,
        );

        // Reset form for next use
        setRecipientEmails([]);
        setCurrentEmail("");
        setPassword("");
        setUsePassword(false);
        setExpiresAt("");
        setMaxDownloads("");

        // Invalidate relevant queries
        void queryClient.invalidateQueries({
          queryKey: trpc.sharing.getMyShares.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(`Failed to share files: ${error.message}`);
      },
    }),
  );

  const handleAddEmail = () => {
    const email = currentEmail.trim();
    if (!email) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (recipientEmails.includes(email)) {
      toast.error("Email already added");
      return;
    }

    setRecipientEmails([...recipientEmails, email]);
    setCurrentEmail("");
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setRecipientEmails(
      recipientEmails.filter((email) => email !== emailToRemove),
    );
  };

  const handleCreateShare = () => {
    if (recipientEmails.length === 0) {
      toast.error("Please add at least one recipient email");
      return;
    }

    const shareData = {
      fileIds: files.map((f) => f.id),
      recipientEmails,
      ...(usePassword && password && { password }),
      ...(expiresAt && { expiresAt: new Date(expiresAt) }),
      ...(maxDownloads && { maxDownloads: Number.parseInt(maxDownloads) }),
    };

    createShareMutation.mutate(shareData);
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success("Share link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      onCloseAction?.();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShareIcon className="h-5 w-5" />
            Share Files
          </DialogTitle>
          <DialogDescription>
            Share {files.length} file{files.length > 1 ? "s" : ""} securely with
            others. Files will be encrypted for each recipient.
          </DialogDescription>
        </DialogHeader>

        {shareLink ? (
          /* Share Link Created */
          <div className="space-y-4">
            <div className="text-center">
              <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                <ShareIcon className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-medium">Share Link Created!</h3>
              <p className="text-muted-foreground text-sm">
                Your files have been shared securely. Copy the link below to
                send to recipients.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Share Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  onClick={() => void handleCopyLink()}
                  variant="outline"
                  size="sm"
                >
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Files being shared */}
            <div>
              <Label className="text-sm font-medium">Files to share</Label>
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-md border p-3">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="truncate">{file.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {file.mimeType}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Recipients */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Recipients</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={currentEmail}
                  onChange={(event) => {
                    setCurrentEmail(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddEmail();
                    }
                  }}
                />
                <Button onClick={handleAddEmail} variant="outline" size="sm">
                  <UserPlusIcon className="h-4 w-4" />
                </Button>
              </div>
              {recipientEmails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {recipientEmails.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1">
                      {email}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => {
                          handleRemoveEmail(email);
                        }}
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Advanced Options */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Advanced Options</h4>

              {/* Password Protection */}
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="use-password"
                  checked={usePassword}
                  onChange={(event) => {
                    setUsePassword(event.target.checked);
                  }}
                  className="mt-1"
                />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="use-password" className="text-sm">
                    <div className="flex items-center gap-2">
                      <LockIcon className="h-4 w-4" />
                      Password Protection
                    </div>
                  </Label>
                  {usePassword && (
                    <Input
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Expiration Date */}
              <div className="space-y-2">
                <Label className="text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Expiration Date (Optional)
                  </div>
                </Label>
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => {
                    setExpiresAt(event.target.value);
                  }}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              {/* Download Limit */}
              <div className="space-y-2">
                <Label className="text-sm">Download Limit (Optional)</Label>
                <Input
                  type="number"
                  placeholder="Maximum number of downloads"
                  value={maxDownloads}
                  onChange={(event) => {
                    setMaxDownloads(event.target.value);
                  }}
                  min="1"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {shareLink ? (
            <Button
              onClick={() => {
                setIsOpen(false);
                setShareLink(undefined);
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateShare}
                disabled={
                  createShareMutation.isPending || recipientEmails.length === 0
                }
              >
                {createShareMutation.isPending ? "Creating..." : "Share Files"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
