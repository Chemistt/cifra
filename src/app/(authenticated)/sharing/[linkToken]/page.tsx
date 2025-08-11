"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarIcon,
  DownloadIcon,
  KeyIcon,
  ShareIcon,
  UserIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EncryptedFileDownload } from "@/components/encrypted-file-download";
import { LoadingView } from "@/components/loading-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatFileSize, getFileIcon } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

export default function SharePage() {
  const parameters = useParams();
  const router = useRouter();
  const trpc = useTRPC();
  const [sharePassword, setSharePassword] = useState<string>();
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordInputValue, setPasswordInputValue] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const linkToken = Array.isArray(parameters.linkToken)
    ? parameters.linkToken[0]
    : parameters.linkToken;

  const {
    data: share,
    isLoading,
    error,
  } = useQuery({
    ...trpc.sharing.getShareByToken.queryOptions({
      linkToken: linkToken ?? "",
      password: sharePassword,
    }),
    enabled: Boolean(linkToken),
    retry: false,
  });

  useEffect(() => {
    if (!error) return;

    const errorCode = error.data?.code;
    const errorMessage = error.message || "";

    // Check for password required/incorrect error
    if (errorCode === "UNAUTHORIZED") {
      if (errorMessage.includes("Password required")) {
        setShowPasswordInput(true);
      } else if (errorMessage.includes("Invalid password")) {
        toast.error("Incorrect password. Please try again.");
        setShowPasswordInput(true);
        setPasswordInputValue(""); // Clear the incorrect password
      } else if (errorMessage.includes("password")) {
        setShowPasswordInput(true);
      }
      return;
    }

    // Handle other error types
    if (errorCode === "NOT_FOUND") {
      toast.error("Share not found or expired");
      router.push("/sharing");
    } else if (errorCode === "FORBIDDEN") {
      toast.error("You don't have access to this share");
      router.push("/sharing");
    } else if (!showPasswordInput) {
      // Only show generic error if we're not in password input mode
      console.error("Share error:", error);
      toast.error("Failed to load share");
      router.push("/sharing");
    }
  }, [error, router, showPasswordInput]);

  const handlePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordInputValue.trim()) {
      toast.error("Please enter a password");
      return;
    }
    setIsSubmittingPassword(true);
    setSharePassword(passwordInputValue);
  };

  // Hide password input when we successfully get share data
  useEffect(() => {
    if (share && showPasswordInput) {
      setShowPasswordInput(false);
      setIsSubmittingPassword(false);
    }
  }, [share, showPasswordInput]);

  // Reset submitting state when error occurs
  useEffect(() => {
    if (error && isSubmittingPassword) {
      setIsSubmittingPassword(false);
    }
  }, [error, isSubmittingPassword]);

  if (isLoading) {
    return <LoadingView />;
  }

  if (!share && showPasswordInput) {
    return (
      <div className="flex h-full w-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6">
          <div>
            <h1 className="text-3xl font-bold">Password Required</h1>
            <p className="text-muted-foreground">
              This share is password protected
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              router.push("/sharing");
            }}
          >
            Back to Sharing
          </Button>
        </div>

        <div className="flex justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyIcon className="h-5 w-5" />
                Enter Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Share Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={passwordInputValue}
                    onChange={(event) => {
                      setPasswordInputValue(event.target.value);
                    }}
                    placeholder="Enter share password"
                    disabled={isSubmittingPassword}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      router.push("/sharing");
                    }}
                    disabled={isSubmittingPassword}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      !passwordInputValue.trim() || isSubmittingPassword
                    }
                  >
                    {isSubmittingPassword ? "Verifying..." : "Access Share"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!share) {
    return; // Error handling is done in useEffect
  }

  return (
    <div className="flex h-full w-full flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shared Files</h1>
          <p className="text-muted-foreground">
            Files shared with you via link
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            router.push("/sharing");
          }}
        >
          Back to Sharing
        </Button>
      </div>

      {/* Share Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserIcon className="h-4 w-4" />
                Shared by {share.owner.name ?? share.owner.email}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {formatDate(share.createdAt)}
                </span>
                {share.expiresAt && (
                  <span className="text-orange-600">
                    Expires {formatDate(share.expiresAt)}
                  </span>
                )}
                {share.passwordHash && (
                  <span className="flex items-center gap-1">
                    <KeyIcon className="h-3 w-3" />
                    Password protected
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShareIcon className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-sm">
                {share.sharedFiles.length} file
                {share.sharedFiles.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {share.sharedFiles.map((sharedFile) => (
              <div
                key={sharedFile.id}
                className="hover:bg-muted flex items-center gap-4 rounded-lg p-3"
              >
                <div className="text-xl">
                  {getFileIcon(sharedFile.file.mimeType)}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium">{sharedFile.file.name}</h4>
                  <p className="text-muted-foreground text-sm">
                    {formatFileSize(BigInt(sharedFile.file.size))} •{" "}
                    {formatDate(sharedFile.file.createdAt)}
                  </p>
                </div>
                <EncryptedFileDownload
                  file={sharedFile.file}
                  className="cursor-pointer"
                  linkToken={linkToken ?? ""}
                >
                  <Button variant="ghost" size="sm">
                    <DownloadIcon className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </EncryptedFileDownload>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
