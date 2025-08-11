"use client";

import { useMutation } from "@tanstack/react-query";
import { EyeIcon, EyeOffIcon, KeyIcon, LockIcon } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTRPC } from "@/trpc/react";

type SharePasswordManagementDialogProps = {
  shareGroupId: string;
  hasPassword: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPasswordUpdated?: () => void;
};

export function SharePasswordManagementDialog({
  shareGroupId,
  hasPassword,
  open,
  onOpenChange,
  onPasswordUpdated,
}: SharePasswordManagementDialogProps) {
  const [passwords, setPasswords] = useState({
    new: "",
    current: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    current: false,
    confirm: false,
  });

  const trpc = useTRPC();

  // Set password mutation
  const setPasswordMutation = useMutation(
    trpc.sharing.setShareGroupPassword.mutationOptions({
      onSuccess: () => {
        toast.success("Password set successfully");
        resetForm();
        onOpenChange(false);
        onPasswordUpdated?.();
      },
      onError: (error) => {
        toast.error(`Failed to set password: ${error.message}`);
      },
    }),
  );

  // Change password mutation
  const changePasswordMutation = useMutation(
    trpc.sharing.changeShareGroupPassword.mutationOptions({
      onSuccess: () => {
        toast.success("Password changed successfully");
        resetForm();
        onOpenChange(false);
        onPasswordUpdated?.();
      },
      onError: (error) => {
        toast.error(`Failed to change password: ${error.message}`);
      },
    }),
  );

  // Remove password mutation
  const removePasswordMutation = useMutation(
    trpc.sharing.removeShareGroupPassword.mutationOptions({
      onSuccess: () => {
        toast.success("Password removed successfully");
        resetForm();
        onOpenChange(false);
        onPasswordUpdated?.();
      },
      onError: (error) => {
        toast.error(`Failed to remove password: ${error.message}`);
      },
    }),
  );

  const resetForm = () => {
    setPasswords({
      new: "",
      current: "",
      confirm: "",
    });
    setShowPasswords({
      new: false,
      current: false,
      confirm: false,
    });
  };

  const handleSetPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwords.new.trim()) {
      toast.error("Please enter a password");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setPasswordMutation.mutate({
      shareGroupId,
      password: passwords.new,
    });
  };

  const handleChangePassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwords.current.trim()) {
      toast.error("Please enter your current password");
      return;
    }
    if (!passwords.new.trim()) {
      toast.error("Please enter a new password");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error("New passwords do not match");
      return;
    }

    changePasswordMutation.mutate({
      shareGroupId,
      currentPassword: passwords.current,
      newPassword: passwords.new,
    });
  };

  const handleRemovePassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwords.current.trim()) {
      toast.error("Please enter your current password");
      return;
    }

    removePasswordMutation.mutate({
      shareGroupId,
      currentPassword: passwords.current,
    });
  };

  const isLoading =
    setPasswordMutation.isPending ||
    changePasswordMutation.isPending ||
    removePasswordMutation.isPending;

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyIcon className="h-5 w-5" />
            Manage Share Password
          </DialogTitle>
          <DialogDescription>
            {hasPassword
              ? "Change or remove the password for this share group."
              : "Set a password to add extra security to this share group."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={hasPassword ? "change" : "set"} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="set" disabled={hasPassword}>
              Set Password
            </TabsTrigger>
            <TabsTrigger value="change" disabled={!hasPassword}>
              Change Password
            </TabsTrigger>
            <TabsTrigger value="remove" disabled={!hasPassword}>
              Remove Password
            </TabsTrigger>
          </TabsList>

          <TabsContent value="set" className="space-y-4">
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPasswords.new ? "text" : "password"}
                    value={passwords.new}
                    onChange={(event) => {
                      setPasswords((previous) => ({
                        ...previous,
                        new: event.target.value,
                      }));
                    }}
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-3"
                    onClick={() => {
                      togglePasswordVisibility("new");
                    }}
                  >
                    {showPasswords.new ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showPasswords.confirm ? "text" : "password"}
                    value={passwords.confirm}
                    onChange={(event) => {
                      setPasswords((previous) => ({
                        ...previous,
                        confirm: event.target.value,
                      }));
                    }}
                    placeholder="Confirm new password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-3"
                    onClick={() => {
                      togglePasswordVisibility("confirm");
                    }}
                  >
                    {showPasswords.confirm ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
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
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Setting..." : "Set Password"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="change" className="space-y-4">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showPasswords.current ? "text" : "password"}
                    value={passwords.current}
                    onChange={(event) => {
                      setPasswords((previous) => ({
                        ...previous,
                        current: event.target.value,
                      }));
                    }}
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-3"
                    onClick={() => {
                      togglePasswordVisibility("current");
                    }}
                  >
                    {showPasswords.current ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password-change">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password-change"
                    type={showPasswords.new ? "text" : "password"}
                    value={passwords.new}
                    onChange={(event) => {
                      setPasswords((previous) => ({
                        ...previous,
                        new: event.target.value,
                      }));
                    }}
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-3"
                    onClick={() => {
                      togglePasswordVisibility("new");
                    }}
                  >
                    {showPasswords.new ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password-change">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password-change"
                    type={showPasswords.confirm ? "text" : "password"}
                    value={passwords.confirm}
                    onChange={(event) => {
                      setPasswords((previous) => ({
                        ...previous,
                        confirm: event.target.value,
                      }));
                    }}
                    placeholder="Confirm new password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-3"
                    onClick={() => {
                      togglePasswordVisibility("confirm");
                    }}
                  >
                    {showPasswords.confirm ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
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
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Changing..." : "Change Password"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="remove" className="space-y-4">
            <form onSubmit={handleRemovePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password-remove">
                  Current Password
                </Label>
                <div className="relative">
                  <Input
                    id="current-password-remove"
                    type={showPasswords.current ? "text" : "password"}
                    value={passwords.current}
                    onChange={(event) => {
                      setPasswords((previous) => ({
                        ...previous,
                        current: event.target.value,
                      }));
                    }}
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-3"
                    onClick={() => {
                      togglePasswordVisibility("current");
                    }}
                  >
                    {showPasswords.current ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="border-destructive/20 bg-destructive/10 rounded-lg border p-3">
                <div className="text-destructive flex items-center gap-2 text-sm">
                  <LockIcon className="h-4 w-4" />
                  <span className="font-medium">Warning</span>
                </div>
                <p className="text-destructive/80 mt-1 text-sm">
                  Removing the password will make this share accessible without
                  password verification.
                </p>
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
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isLoading}
                >
                  {isLoading ? "Removing..." : "Remove Password"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
