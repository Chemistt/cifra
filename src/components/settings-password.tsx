"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  EditIcon,
  Eye,
  EyeOff,
  Loader2Icon,
  LockIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
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
import { useTRPC } from "@/trpc/react";

const SET_PASSWORD_SCHEMA = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const CHANGE_PASSWORD_SCHEMA = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters long"),
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New passwords do not match",
    path: ["confirmNewPassword"],
  });

type SetPasswordForm = z.infer<typeof SET_PASSWORD_SCHEMA>;
type ChangePasswordForm = z.infer<typeof CHANGE_PASSWORD_SCHEMA>;

type PasswordFieldProps = {
  label: string;
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  name: string;
  placeholder: string;
  disabled?: boolean;
  visible: boolean;
  onToggleVisibility: () => void;
};

function PasswordField({
  label,
  id,
  form,
  name,
  placeholder,
  disabled,
  visible,
  onToggleVisibility,
}: PasswordFieldProps) {
  const fieldError = form.formState.errors[name];
  const error = fieldError?.message as string | undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          {...form.register(name)}
          placeholder={placeholder}
          className="mt-2"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={onToggleVisibility}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
      {error && (
        <div className="text-destructive text-sm mt-1">{error}</div>
      )}
    </div>
  );
}

export function SettingsPassword() {
  const trpc = useTRPC();
  const [isSetDialogOpen, setIsSetDialogOpen] = useState(false);
  const [isChangeDialogOpen, setIsChangeDialogOpen] = useState(false);
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  
  const togglePassword = (key: string) => {
    setShowPassword((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  // Set Password Form
  const setPasswordForm = useForm<SetPasswordForm>({
    resolver: zodResolver(SET_PASSWORD_SCHEMA),
    mode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Change Password Form
  const changePasswordForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(CHANGE_PASSWORD_SCHEMA),
    mode: "onChange",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const passwordStatusQuery = useSuspenseQuery(trpc.totp.hasPassword.queryOptions());
  const { hasPassword } = passwordStatusQuery.data;

  const setPasswordMutation = useMutation(
    trpc.totp.setPassword.mutationOptions({
      onSuccess: () => {
        toast.success("Password set successfully");
        setPasswordForm.reset();
        setIsSetDialogOpen(false);
        void passwordStatusQuery.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const changePasswordMutation = useMutation(
    trpc.totp.changePassword.mutationOptions({
      onSuccess: () => {
        toast.success("Password changed successfully");
        changePasswordForm.reset();
        setIsChangeDialogOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const deletePasswordMutation = useMutation(
    trpc.totp.deletePassword.mutationOptions({
      onSuccess: () => {
        toast.success("Password deleted successfully");
        void passwordStatusQuery.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleSetPassword = (data: SetPasswordForm) => {
    setPasswordMutation.mutate({ 
      password: data.password,
      confirmPassword: data.confirmPassword,
    });
  };

  const handleChangePassword = (data: ChangePasswordForm) => {
    changePasswordMutation.mutate({ 
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      confirmNewPassword: data.confirmNewPassword,
    });
  };  
  
  const handleDeletePassword = () => {
    deletePasswordMutation.mutate();
  };

  const renderPasswordStatus = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-1">
          <div className="font-medium">Password Authentication</div>
          <div className="text-muted-foreground text-sm">
            Password-based login is enabled for your account
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsChangeDialogOpen(true);
            }}
          >
            <EditIcon className="h-4 w-4" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <TrashIcon className="h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Password</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete your password? <br/>
                  This will remove password-based login from your account. <br/>
                  Make sure you have other authentication methods set up before proceeding.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeletePassword}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletePasswordMutation.isPending ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    "Delete"
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
      <LockIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      <p className="text-muted-foreground mb-4">
        You haven&apos;t set a password yet.
      </p>
      <p className="text-muted-foreground text-sm">
        Setting a password allows you to sign in with your password and TOTP in
        addition to social providers.
      </p>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LockIcon className="h-5 w-5" />
              Password
            </CardTitle>
            <CardDescription>
              Manage your password for secure authentication.
            </CardDescription>
          </div>
          {!hasPassword && (
            <Button onClick={() => {
              setIsSetDialogOpen(true);
            }} size="sm">
              <PlusIcon className="h-4 w-4" />
              Set Password
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {hasPassword ? renderPasswordStatus() : renderEmptyState()}
        </CardContent>
      </Card>

      {/* Set Password Dialog */}
      <Dialog open={isSetDialogOpen} onOpenChange={setIsSetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>
              Create a password to enable password-based login for your account.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void setPasswordForm.handleSubmit(handleSetPassword)(event);
            }}
            className="space-y-4"
          >
            <PasswordField
              label="Password"
              id="set-password"
              form={setPasswordForm}
              name="password"
              placeholder="Enter your password"
              disabled={setPasswordMutation.isPending}
              visible={showPassword.set_new ?? false}
              onToggleVisibility={() => {
                togglePassword("set_new");
              }}
            />
            <PasswordField
              label="Confirm Password"
              id="confirm-password"
              form={setPasswordForm}
              name="confirmPassword"
              placeholder="Confirm your password"
              disabled={setPasswordMutation.isPending}
              visible={showPassword.set_confirm ?? false}
              onToggleVisibility={() => {
                togglePassword("set_confirm");
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsSetDialogOpen(false);
                  setPasswordForm.reset();
                }}
                disabled={setPasswordMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={setPasswordMutation.isPending}
              >
                {setPasswordMutation.isPending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  "Set Password"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isChangeDialogOpen} onOpenChange={setIsChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update your current password for your account.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void changePasswordForm.handleSubmit(handleChangePassword)(event);
            }}
            className="space-y-4"
          >
            <PasswordField
              label="Current Password"
              id="current-password"
              form={changePasswordForm}
              name="currentPassword"
              placeholder="Enter your current password"
              disabled={changePasswordMutation.isPending}
              visible={showPassword.change_current ?? false}
              onToggleVisibility={() => {
                togglePassword("change_current");
              }}
            />
            <PasswordField
              label="New Password"
              id="new-password"
              form={changePasswordForm}
              name="newPassword"
              placeholder="Enter your new password"
              disabled={changePasswordMutation.isPending}
              visible={showPassword.change_new ?? false}
              onToggleVisibility={() => {
                togglePassword("change_new");
              }}
            />
            <PasswordField
              label="Confirm New Password"
              id="confirm-new-password"
              form={changePasswordForm}
              name="confirmNewPassword"
              placeholder="Confirm your new password"
              disabled={changePasswordMutation.isPending}
              visible={showPassword.change_confirm ?? false}
              onToggleVisibility={() => {
                togglePassword("change_confirm");
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsChangeDialogOpen(false);
                  changePasswordForm.reset();
                }}
                disabled={changePasswordMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  "Change Password"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
