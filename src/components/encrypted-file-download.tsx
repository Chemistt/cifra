"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { DownloadIcon, LoaderIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { env } from "@/env";
import { decryptFileComplete, downloadFile } from "@/lib/crypto";
import type { AppRouter } from "@/server/api/root";
import { useTRPC } from "@/trpc/react";

import { Button } from "./ui/button";

type FileItem =
  | inferRouterOutputs<AppRouter>["files"]["getFolderContents"]["files"][number]
  | inferRouterOutputs<AppRouter>["files"]["searchFiles"]["files"][number];

type MinimalFile = {
  id: string;
  name: string;
  storagePath: string;
};

type EncryptedFileDownloadProps = {
  file: FileItem | MinimalFile;
  children?: React.ReactNode;
  className?: string;
  linkToken?: string;
};

export function EncryptedFileDownload({
  file,
  children,
  className,
  linkToken,
}: EncryptedFileDownloadProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const trpc = useTRPC();

  const { data: encryptionDetails } = useQuery(
    trpc.files.getFileEncryptionDetails.queryOptions({
      fileId: file.id,
    }),
  );

  // Decrypt DEK
  const decryptDEKMutation = useMutation(
    trpc.kms.decryptDEK.mutationOptions({
      onError: (error) => {
        console.error("Error decrypting DEK:", error);
        toast.error("Failed to decrypt file key");
        setIsDownloading(false);
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

  const handleEncryptedDownload = async () => {
    if (!file.storagePath || !encryptionDetails) {
      toast.error("File path or encryption details not available");
      return;
    }

    setIsDownloading(true);

    try {
      // Step 2: Decrypt the DEK using user's KEK
      const decryptedDEKResult = await decryptDEKMutation.mutateAsync({
        encryptedDEKBase64: encryptionDetails.encryptedDEKBase64,
        keyId: encryptionDetails.keyId,
      });

      // Step 3: Fetch the encrypted file from UploadThing
      const fileUrl = `https://${env.NEXT_PUBLIC_UPLOADTHING_APPID}.ufs.sh/f/${file.storagePath}`;
      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new Error("Failed to fetch encrypted file");
      }

      const encryptedData = await response.arrayBuffer();

      // Step 4: Decrypt the file client-side
      const decryptedFile = await decryptFileComplete(
        encryptedData,
        decryptedDEKResult.dekBase64,
        encryptionDetails.iv,
        encryptionDetails.fileName,
        encryptionDetails.originalMimeType,
      );

      // Step 5: Download the decrypted file
      downloadFile(decryptedFile);

      // Step 6: Track download if this is a shared file
      if (linkToken) {
        try {
          await trackDownloadMutation.mutateAsync({
            linkToken,
            fileId: file.id,
          });
        } catch (error) {
          // Log but don't interrupt user flow
          console.error("Failed to track download:", error);
        }
      }

      toast.success(
        `File "${file.name}" decrypted and downloaded successfully`,
      );
    } catch (error) {
      console.error("Download error:", error);
      toast.error(
        error instanceof Error
          ? `Failed to download: ${error.message}`
          : "Failed to download file",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      {children ? (
        <div
          onClick={() => {
            void handleEncryptedDownload();
          }}
          className={className}
        >
          {children}
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void handleEncryptedDownload();
          }}
          disabled={isDownloading}
          className={className}
        >
          {isDownloading ? (
            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <DownloadIcon className="mr-2 h-4 w-4" />
          )}
          {isDownloading ? "Decrypting..." : "Download"}
        </Button>
      )}
    </>
  );
}
