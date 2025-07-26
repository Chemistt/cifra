"use client";

import { useMutation } from "@tanstack/react-query";
import { UploadIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { encryptFileComplete, uint8ArrayToBase64 } from "@/lib/crypto";
import { useUploadThing } from "@/lib/uploadthing";
import { useTRPC } from "@/trpc/react";

type EncryptedFileUploadDialogProps = {
  children: React.ReactNode;
  onUploadComplete?: () => void;
  folderId?: string;
};

type UploadState = {
  file: File;
  progress: number;
  status: "encrypting" | "uploading" | "processing" | "completed" | "error";
  error?: string;
};

export function EncryptedFileUploadDialog({
  children,
  onUploadComplete,
  folderId,
}: EncryptedFileUploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const trpc = useTRPC();

  // UploadThing hook for file uploads
  const { startUpload } = useUploadThing("mainFileUploader", {
    onClientUploadComplete: (response) => {
      console.log("UploadThing upload completed:", response);
    },
    onUploadError: (error: Error) => {
      console.error("UploadThing upload error:", error);
      toast.error("Upload failed");
    },
  });

  // Mutation to encrypt DEK with user's KEK
  const encryptDEKMutation = useMutation(
    trpc.kms.encryptDEK.mutationOptions({
      onError: (error) => {
        console.error("Error encrypting DEK:", error);
        toast.error("Failed to encrypt file key");
      },
    }),
  );

  // Mutation to create encrypted file metadata
  const createEncryptedFileMetadataMutation = useMutation(
    trpc.files.createEncryptedFileMetadata.mutationOptions({
      onError: (error) => {
        console.error("Error creating file metadata:", error);
        toast.error("Failed to save file metadata");
      },
    }),
  );

  const updateUploadProgress = (
    fileIndex: number,
    updates: Partial<UploadState>,
  ) => {
    console.log("Updating upload progress", fileIndex, updates);
    setUploads((previous) =>
      previous.map((upload, index) =>
        index === fileIndex ? { ...upload, ...updates } : upload,
      ),
    );
  };

  const uploadEncryptedFile = async (
    encryptedBlob: Blob,
    originalFileName: string,
  ): Promise<{ key: string; url: string }> => {
    // Create a File object from the encrypted blob
    const encryptedFile = new File(
      [encryptedBlob],
      `${originalFileName}.encrypted`,
      {
        type: "application/octet-stream",
      },
    );

    // Use UploadThing's startUpload function
    const result = await startUpload([encryptedFile], { folderId });

    if (!result?.[0]) {
      throw new Error("Failed to upload file");
    }

    return {
      key: result[0].key,
      url: result[0].ufsUrl,
    };
  };

  const handleFileUpload = async (files: File[]) => {
    const newUploads: UploadState[] = files.map((file) => ({
      file,
      progress: 0,
      status: "encrypting",
    }));

    setUploads(newUploads);

    for (const [index, file] of files.entries()) {
      try {
        // Step 1: Encrypt the file
        updateUploadProgress(index, { status: "encrypting", progress: 10 });

        const encryptedData = await encryptFileComplete(file);
        updateUploadProgress(index, { progress: 30 });

        // Step 2: Encrypt the DEK with user's KEK
        const encryptedDEKResult = await encryptDEKMutation.mutateAsync(
          encryptedData.dekBase64,
        );
        updateUploadProgress(index, { progress: 50 });

        // Step 3: Upload encrypted file to UploadThing
        updateUploadProgress(index, { status: "uploading", progress: 60 });

        const uploadResult = await uploadEncryptedFile(
          encryptedData.encryptedFile,
          encryptedData.originalFileName,
        );
        updateUploadProgress(index, { progress: 80 });

        // Step 4: Save encrypted file metadata
        updateUploadProgress(index, { status: "processing", progress: 90 });

        await createEncryptedFileMetadataMutation.mutateAsync({
          name: encryptedData.originalFileName,
          storagePath: uploadResult.key,
          mimeType: encryptedData.mimeType,
          size: encryptedData.originalSize,
          encryptedSize: encryptedData.encryptedFile.size,
          folderId,
          encryptedDEK: encryptedDEKResult.encryptedDEK,
          keyId: encryptedDEKResult.keyId,
          iv: uint8ArrayToBase64(encryptedData.iv),
        });

        updateUploadProgress(index, {
          status: "completed",
          progress: 100,
        });

        toast.success(
          `File "${file.name}" uploaded and encrypted successfully`,
        );
      } catch (error) {
        console.error("Upload error:", error);
        updateUploadProgress(index, {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        toast.error(`Failed to upload "${file.name}"`);
      }
    }

    // Check if all uploads completed successfully
    const completedUploads = uploads.filter(
      (upload) => upload.status === "completed",
    );
    if (completedUploads.length === files.length) {
      setTimeout(() => {
        setIsOpen(false);
        setUploads([]);
        onUploadComplete?.();
      }, 1000);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    if (files.length > 0) {
      void handleFileUpload(files);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = [...event.dataTransfer.files];
    if (files.length > 0) {
      void handleFileUpload(files);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const removeUpload = (index: number) => {
    setUploads((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const getStatusColor = (status: UploadState["status"]) => {
    switch (status) {
      case "encrypting": {
        return "bg-blue-500";
      }
      case "uploading": {
        return "bg-yellow-500";
      }
      case "processing": {
        return "bg-purple-500";
      }
      case "completed": {
        return "bg-green-500";
      }
      case "error": {
        return "bg-red-500";
      }
      default: {
        return "bg-gray-500";
      }
    }
  };

  const getStatusText = (status: UploadState["status"]) => {
    switch (status) {
      case "encrypting": {
        return "Encrypting...";
      }
      case "uploading": {
        return "Uploading...";
      }
      case "processing": {
        return "Processing...";
      }
      case "completed": {
        return "Completed";
      }
      case "error": {
        return "Error";
      }
      default: {
        return "Waiting...";
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <UploadIcon className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="mb-2 text-lg font-medium">
              Drop files here or click to browse
            </p>
            <p className="mb-4 text-sm text-gray-500">
              Files will be encrypted on your device before upload
            </p>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button type="button" asChild>
                <span>Choose Files</span>
              </Button>
            </label>
          </div>

          {/* Upload Progress */}
          {uploads.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Upload Progress</h3>
              {uploads.map((upload, index) => (
                <div key={index} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="mr-2 flex-1 truncate font-medium">
                      {upload.file.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {getStatusText(upload.status)}
                      </span>
                      {upload.status === "error" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            removeUpload(index);
                          }}
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      ) : undefined}
                    </div>
                  </div>
                  <Progress
                    value={upload.progress}
                    className={`h-2 ${getStatusColor(upload.status)}`}
                  />
                  {upload.error && (
                    <p className="text-sm text-red-600">{upload.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
