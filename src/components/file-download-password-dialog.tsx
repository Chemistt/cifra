"use client";

import { useMutation } from "@tanstack/react-query";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/react";

type FileDownloadPasswordDialogProps = {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPasswordVerified: () => void;
  linkToken?: string;
  passwordType?: "file" | "shareGroup";
};

export function FileDownloadPasswordDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
  onPasswordVerified,
  linkToken,
  passwordType = "file",
}: FileDownloadPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const trpc = useTRPC();

  // File password verification
  const verifyFilePasswordMutation = useMutation(
    trpc.files.verifyFilePassword.mutationOptions({
      onSuccess: (result) => {
        if (result.valid) {
          toast.success("File password verified successfully");
          onPasswordVerified();
          setPassword("");
          onOpenChange(false);
        } else {
          toast.error("Incorrect file password");
        }
      },
      onError: (error) => {
        toast.error(`Failed to verify file password: ${error.message}`);
      },
    }),
  );

  // Share group password verification
  const verifyShareGroupPasswordMutation = useMutation(
    trpc.sharing.verifyShareGroupPassword.mutationOptions({
      onSuccess: (result) => {
        if (result.valid) {
          toast.success("Share group password verified successfully");
          onPasswordVerified();
          setPassword("");
          onOpenChange(false);
        } else {
          toast.error("Incorrect share group password");
        }
      },
      onError: (error) => {
        toast.error(`Failed to verify share group password: ${error.message}`);
      },
    }),
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim()) {
      toast.error("Please enter a password");
      return;
    }

    if (passwordType === "shareGroup" && linkToken) {
      verifyShareGroupPasswordMutation.mutate({
        linkToken,
        password,
      });
    } else {
      verifyFilePasswordMutation.mutate({
        fileId,
        password,
      });
    }
  };

  const isLoading =
    verifyFilePasswordMutation.isPending ||
    verifyShareGroupPasswordMutation.isPending;

  const handleCancel = () => {
    setPassword("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="h-5 w-5" />
            Password Required
          </DialogTitle>
          <DialogDescription>
            {passwordType === "shareGroup"
              ? `Please enter the share group password to access "${fileName}"`
              : `Please enter the file password to download "${fileName}"`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">
              {passwordType === "shareGroup"
                ? "Share Group Password"
                : "File Password"}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder={
                passwordType === "shareGroup"
                  ? "Enter share group password"
                  : "Enter file password"
              }
              disabled={isLoading}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !password.trim()}>
              {isLoading ? "Verifying..." : "Verify"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
