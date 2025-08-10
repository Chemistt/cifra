"use client";

import { useMutation } from "@tanstack/react-query";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/react";

import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type FileDownloadPasswordDialogProps = {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPasswordVerified: () => void;
};

export function FileDownloadPasswordDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
  onPasswordVerified,
}: FileDownloadPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const trpc = useTRPC();

  const verifyPasswordMutation = useMutation(
    trpc.files.verifyFilePassword.mutationOptions({
      onSuccess: (result) => {
        if (result.valid) {
          toast.success("Password verified successfully");
          onPasswordVerified();
          setPassword("");
          onOpenChange(false);
        } else {
          toast.error("Incorrect password");
        }
      },
      onError: (error) => {
        toast.error(`Failed to verify password: ${error.message}`);
      },
    }),
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim()) {
      toast.error("Please enter a password");
      return;
    }

    verifyPasswordMutation.mutate({
      fileId,
      password,
    });
  };

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
            Please enter the password to download &quot;{fileName}&quot;
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder="Enter file password"
              disabled={verifyPasswordMutation.isPending}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={verifyPasswordMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={verifyPasswordMutation.isPending || !password.trim()}
            >
              {verifyPasswordMutation.isPending ? "Verifying..." : "Verify"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
