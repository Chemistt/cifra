"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeOffIcon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { TotpVerificationDialog } from "@/components/totp-verification-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";

const passwordSignInSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .pipe(z.email("Please enter a valid email address")),
  password: z.string().min(1, "Password is required"),
});

const handleTotpError = (error: string) => {
  // TOTP verification failed, but user is still in sign-in flow
  // The user can try again with the TOTP dialog
  console.error("TOTP verification failed:", error);
};

type PasswordSignInFormData = z.infer<typeof passwordSignInSchema>;

type PasswordSignInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PasswordSignInDialog({
  open,
  onOpenChange,
}: PasswordSignInDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTotpDialog, setShowTotpDialog] = useState(false);
  const router = useRouter();

  const form = useForm<PasswordSignInFormData>({
    resolver: zodResolver(passwordSignInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
    return () => {
      if (!open) {
        setShowPassword(false);
      }
    };
  }, [open, form]);

  const onSubmit = async (data: PasswordSignInFormData) => {
    setIsLoading(true);

    try {
      const result = await signIn.email(
        {
          email: data.email,
          password: data.password,
        },
        {
          onSuccess(context) {
            const data = context.data as { twoFactorRedirect?: boolean };
            if (data.twoFactorRedirect) {
              // User has 2FA enabled, show TOTP verification dialog
              setShowTotpDialog(true);
              return;
            }

            // No 2FA required, sign in successful
            toast.success("Signed in successfully");
            onOpenChange(false);
            form.reset();
            router.push("/files");
          },
          onError: (context) => {
            toast.error(context.error.message || "Invalid email or password");
          },
        },
      );

      // If there's an error in the result itself
      if (result.error) {
        toast.error(result.error.message ?? "Invalid email or password");
      }
    } catch {
      toast.error("Server error. Please try again later.");
    }

    setIsLoading(false);
  };

  const handleTotpSuccess = () => {
    toast.success("Signed in successfully");
    setShowTotpDialog(false);
    onOpenChange(false);
    form.reset();
    router.push("/files");
  };

  const handleTotpDialogChange = (open: boolean) => {
    setShowTotpDialog(open);
    // If the user closes the TOTP dialog, they need to sign in again
    if (!open) {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockIcon className="h-5 w-5" />
              Sign in with Password
            </DialogTitle>
            <DialogDescription>
              Enter your email and password to sign in to your account.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={(event) => {
                void form.handleSubmit(onSubmit)(event);
              }}
              className="space-y-6"
            >
              <fieldset disabled={isLoading} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="Enter your email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => {
                              setShowPassword((previous) => !previous);
                            }}
                          >
                            {showPassword ? (
                              <EyeOffIcon className="h-4 w-4" />
                            ) : (
                              <EyeIcon className="h-4 w-4" />
                            )}
                            <span className="sr-only">
                              {showPassword ? "Hide password" : "Show password"}
                            </span>
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </fieldset>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                  }}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <TotpVerificationDialog
        open={showTotpDialog}
        onOpenChange={handleTotpDialogChange}
        onSuccess={handleTotpSuccess}
        onError={handleTotpError}
        title="Complete Sign In"
        description="Please enter your TOTP code to complete the sign-in process."
      />
    </>
  );
}
