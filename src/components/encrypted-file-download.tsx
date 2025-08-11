"use client";

// TODO: This component is not working as expected.
// It is not unmounting properly when the file is not password protected.
// It is downloading the file twice.

import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { FileDownloadPasswordDialog } from "@/components/file-download-password-dialog";
import { env } from "@/env";
import { decryptFileComplete, downloadFile } from "@/lib/crypto";
import type { AppRouter } from "@/server/api/root";
import { useTRPC } from "@/trpc/react";

type FileItem =
  | inferRouterOutputs<AppRouter>["files"]["getFolderContents"]["files"][number]
  | inferRouterOutputs<AppRouter>["files"]["searchFiles"]["files"][number];

type MinimalFile = {
  id: string;
  name: string;
  storagePath: string;
  passwordHash?: string | null;
};

type EncryptedFileDownloadProps = {
  file: FileItem | MinimalFile;
  children?: React.ReactNode;
  className?: string;
  linkToken?: string;
  autoTrigger?: boolean;
  onDownloadStartAction?: () => void;
};

type DownloadState =
  | "idle"
  | "waiting-for-sharegroup-password"
  | "waiting-for-file-password"
  | "downloading";

export function EncryptedFileDownload({
  file,
  children,
  className,
  linkToken,
  autoTrigger = false,
  onDownloadStartAction,
}: EncryptedFileDownloadProps) {
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const [shareGroupPasswordVerified, setShareGroupPasswordVerified] =
    useState(false);
  const [filePasswordVerified, setFilePasswordVerified] = useState(false);
  const trpc = useTRPC();

  const { data: encryptionDetails } = useQuery(
    trpc.files.getFileEncryptionDetails.queryOptions({
      fileId: file.id,
    }),
  );

  // Get share group info if linkToken is provided
  const { data: shareGroupInfo } = useQuery({
    ...trpc.sharing.getShareGroupInfo.queryOptions({
      linkToken: linkToken ?? "",
    }),
    enabled: Boolean(linkToken),
  });

  // Decrypt DEK mutation
  const decryptDEKMutation = useMutation(
    trpc.kms.decryptDEK.mutationOptions({
      onError: (error) => {
        console.error("Error decrypting DEK:", error);
        toast.error("Failed to decrypt file key");
        setDownloadState("idle");
      },
    }),
  );

  // Validate download limits for shared files
  const validateDownloadMutation = useMutation(
    trpc.sharing.validateDownload.mutationOptions({
      onError: (error) => {
        if (error.data?.code === "FORBIDDEN") {
          toast.error("Max downloads reached");
        } else {
          console.error("Error validating download:", error);
          toast.error("Failed to validate download permissions");
        }
      },
    }),
  );

  // Track download for sharing analytics
  const trackDownloadMutation = useMutation(
    trpc.sharing.trackDownload.mutationOptions({
      onError: (error) => {
        console.error("Error tracking download:", error);
      },
    }),
  );

  const performEncryptedDownload = useCallback(async () => {
    if (!file.storagePath || !encryptionDetails) {
      toast.error("File path or encryption details not available");
      setDownloadState("idle");
      return;
    }

    try {
      setDownloadState("downloading");

      // Validate download limits for shared files before proceeding
      if (linkToken) {
        try {
          await validateDownloadMutation.mutateAsync({
            linkToken,
            fileId: file.id,
          });
        } catch {
          setDownloadState("idle");
          return;
        }
      }

      toast.loading("Processing file...", {
        id: "processing-file",
      });

      // Signal that download is starting
      onDownloadStartAction?.();

      // Decrypt the DEK using user's KEK
      const decryptedDEKResult = await decryptDEKMutation.mutateAsync({
        encryptedDEKBase64: encryptionDetails.encryptedDEKBase64,
        keyId: encryptionDetails.keyId,
      });

      // Fetch the encrypted file from UploadThing
      const fileUrl = `https://${env.NEXT_PUBLIC_UPLOADTHING_APPID}.ufs.sh/f/${file.storagePath}`;
      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new Error("Failed to fetch encrypted file");
      }

      const encryptedData = await response.arrayBuffer();

      // Decrypt the file client-side
      const decryptedFile = await decryptFileComplete(
        encryptedData,
        decryptedDEKResult.dekBase64,
        encryptionDetails.iv,
        encryptionDetails.fileName,
        encryptionDetails.originalMimeType,
      );

      // Download the decrypted file
      downloadFile(decryptedFile);

      // Track download if this is a shared file
      if (linkToken) {
        try {
          await trackDownloadMutation.mutateAsync({
            linkToken,
            fileId: file.id,
          });
        } catch (error) {
          console.error("Failed to track download:", error);
        }
      }
      toast.dismiss("processing-file");
      toast.success(
        `File "${file.name}" decrypted and downloaded successfully`,
      );
      setDownloadState("idle");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(
        error instanceof Error
          ? `Failed to download: ${error.message}`
          : "Failed to download file",
      );
      setDownloadState("idle");
    }
  }, [
    file.storagePath,
    file.id,
    file.name,
    encryptionDetails,
    decryptDEKMutation,
    validateDownloadMutation,
    trackDownloadMutation,
    linkToken,
    onDownloadStartAction,
  ]);

  const checkPasswordRequirements = useCallback(() => {
    const hasFilePassword = Boolean(file.passwordHash);
    const hasShareGroupPassword = Boolean(shareGroupInfo?.hasPassword);

    return {
      needsShareGroupPassword:
        linkToken && hasShareGroupPassword && !shareGroupPasswordVerified,
      needsFilePassword: hasFilePassword && !filePasswordVerified,
      canProceed:
        (!linkToken || !hasShareGroupPassword || shareGroupPasswordVerified) &&
        (!hasFilePassword || filePasswordVerified),
    };
  }, [
    file.passwordHash,
    shareGroupInfo?.hasPassword,
    linkToken,
    shareGroupPasswordVerified,
    filePasswordVerified,
  ]);

  const initiateDownload = useCallback(() => {
    const { needsShareGroupPassword, needsFilePassword, canProceed } =
      checkPasswordRequirements();

    if (needsShareGroupPassword) {
      setDownloadState("waiting-for-sharegroup-password");
    } else if (needsFilePassword) {
      setDownloadState("waiting-for-file-password");
    } else if (canProceed) {
      void performEncryptedDownload();
    }
  }, [checkPasswordRequirements, performEncryptedDownload]);

  const handleManualDownload = useCallback(() => {
    if (downloadState !== "idle") return;
    initiateDownload();
  }, [downloadState, initiateDownload]);

  const handleShareGroupPasswordVerified = useCallback(() => {
    setShareGroupPasswordVerified(true);
    setDownloadState("idle");
    // After share group password is verified, check if file password is needed
    initiateDownload();
  }, [initiateDownload]);

  const handleFilePasswordVerified = useCallback(() => {
    setFilePasswordVerified(true);
    setDownloadState("idle");
    // After file password is verified, proceed with download
    void performEncryptedDownload();
  }, [performEncryptedDownload]);

  const handlePasswordDialogClose = useCallback(() => {
    setDownloadState("idle");
    // For auto-trigger components, we should call onDownloadStartAction when cancelled
    // This will unmount the component so user can try again
    if (autoTrigger) {
      onDownloadStartAction?.();
    }
  }, [autoTrigger, onDownloadStartAction]);

  // Auto-trigger effect - runs once when conditions are met
  useEffect(() => {
    if (
      autoTrigger &&
      encryptionDetails &&
      downloadState === "idle" &&
      !hasAutoTriggered &&
      // Only auto-trigger when share group info is loaded (if needed)
      (!linkToken || shareGroupInfo !== undefined)
    ) {
      setHasAutoTriggered(true);
      initiateDownload();
    }
  }, [
    autoTrigger,
    encryptionDetails,
    downloadState,
    hasAutoTriggered,
    linkToken,
    shareGroupInfo,
    initiateDownload,
  ]);

  return (
    <>
      {!autoTrigger && Boolean(children) && (
        <div onClick={handleManualDownload} className={className}>
          {children}
        </div>
      )}

      {/* Share Group Password Dialog */}
      {linkToken && (
        <FileDownloadPasswordDialog
          fileId={file.id}
          fileName={file.name}
          open={downloadState === "waiting-for-sharegroup-password"}
          onOpenChange={(open) => {
            if (!open) {
              handlePasswordDialogClose();
            }
          }}
          onPasswordVerified={handleShareGroupPasswordVerified}
          linkToken={linkToken}
          passwordType="shareGroup"
        />
      )}

      {/* File Password Dialog */}
      <FileDownloadPasswordDialog
        fileId={file.id}
        fileName={file.name}
        open={downloadState === "waiting-for-file-password"}
        onOpenChange={(open) => {
          if (!open) {
            handlePasswordDialogClose();
          }
        }}
        onPasswordVerified={handleFilePasswordVerified}
        passwordType="file"
      />
    </>
  );
}
