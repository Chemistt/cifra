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

type DownloadState = "idle" | "waiting-for-password" | "downloading";

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
  const trpc = useTRPC();

  const { data: encryptionDetails } = useQuery(
    trpc.files.getFileEncryptionDetails.queryOptions({
      fileId: file.id,
    }),
  );

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
      toast.loading("Processing file...", {
        id: "processing-file",
      });
      setDownloadState("downloading");

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
    trackDownloadMutation,
    linkToken,
    onDownloadStartAction,
  ]);

  const initiateDownload = useCallback(() => {
    const hasPassword = Boolean(file.passwordHash);

    if (hasPassword) {
      setDownloadState("waiting-for-password");
    } else {
      void performEncryptedDownload();
    }
  }, [file.passwordHash, performEncryptedDownload]);

  const handleManualDownload = useCallback(() => {
    if (downloadState !== "idle") return;
    initiateDownload();
  }, [downloadState, initiateDownload]);

  const handlePasswordVerified = useCallback(() => {
    setDownloadState("idle");
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
      !hasAutoTriggered
    ) {
      setHasAutoTriggered(true);
      initiateDownload();
    }
  }, [
    autoTrigger,
    encryptionDetails,
    downloadState,
    hasAutoTriggered,
    initiateDownload,
  ]);

  return (
    <>
      {!autoTrigger && Boolean(children) && (
        <div onClick={handleManualDownload} className={className}>
          {children}
        </div>
      )}

      <FileDownloadPasswordDialog
        fileId={file.id}
        fileName={file.name}
        open={downloadState === "waiting-for-password"}
        onOpenChange={(open) => {
          if (!open) {
            handlePasswordDialogClose();
          }
        }}
        onPasswordVerified={handlePasswordVerified}
      />
    </>
  );
}
