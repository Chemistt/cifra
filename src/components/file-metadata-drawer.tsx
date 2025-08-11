"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarIcon,
  FileIcon,
  FolderIcon,
  HardDriveIcon,
  InfoIcon,
  KeyIcon,
  LockIcon,
  ShareIcon,
  TagIcon,
  UserIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/react";

type FileMetadataDrawerProps = {
  fileId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatBytes(bytes: bigint): string {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === BigInt(0)) return "0 Bytes";
  const k = 1024;
  const index = Math.floor(Math.log(Number(bytes)) / Math.log(k));
  return `${String(Math.round((Number(bytes) / Math.pow(k, index)) * 100) / 100)} ${String(sizes[index])}`;
}

function getFileTypeIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.startsWith("video/")) return "🎥";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.startsWith("text/")) return "📄";
  return "📄";
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FileMetadataContent({ fileId }: { fileId: string }) {
  const trpc = useTRPC();

  const {
    data: fileMetadata,
    isLoading,
    error,
  } = useQuery({
    ...trpc.files.getFileMetadata.queryOptions({
      fileId,
    }),
    enabled: !!fileId,
  });

  // Debug logging
  console.log("FileMetadataContent:", {
    fileId,
    isLoading,
    error,
    fileMetadata,
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    console.error("Error loading file metadata:", error);
    return (
      <div className="p-6 text-center">
        <InfoIcon className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="text-sm text-red-600">Failed to load file metadata</p>
        <p className="text-muted-foreground text-xs">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <details className="mt-2 text-left">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            Debug Info
          </summary>
          <pre className="bg-muted mt-2 overflow-auto rounded p-2 text-xs">
            {JSON.stringify({ fileId, error }, undefined, 2)}
          </pre>
        </details>
      </div>
    );
  }

  if (!fileMetadata) {
    return (
      <div className="p-6 text-center">
        <FileIcon className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
        <p className="text-muted-foreground text-sm">No metadata found</p>
        <details className="mt-2 text-left">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            Debug Info
          </summary>
          <pre className="bg-muted mt-2 overflow-auto rounded p-2 text-xs">
            {JSON.stringify({ fileId, isLoading, error }, undefined, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Basic File Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">
            {getFileTypeIcon(fileMetadata.mimeType)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold">
              {fileMetadata.name}
            </h3>
            <p className="text-muted-foreground text-sm">
              {fileMetadata.mimeType}
            </p>
          </div>
          {fileMetadata.passwordProtected && (
            <LockIcon className="h-5 w-5 text-amber-500" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Size:</span>
            <p className="text-muted-foreground">
              {formatBytes(fileMetadata.size)}
            </p>
          </div>
          <div>
            <span className="font-medium">Version:</span>
            <p className="text-muted-foreground">v{fileMetadata.version}</p>
          </div>
          {fileMetadata.fileExtension && (
            <div>
              <span className="font-medium">Extension:</span>
              <p className="text-muted-foreground">
                .{fileMetadata.fileExtension}
              </p>
            </div>
          )}
          {fileMetadata.md5 && (
            <div className="col-span-2">
              <span className="font-medium">MD5 Hash:</span>
              <p className="text-muted-foreground font-mono text-xs break-all">
                {fileMetadata.md5}
              </p>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Location Information */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 font-medium">
          <FolderIcon className="h-4 w-4" />
          Location
        </h4>
        <div className="space-y-2">
          <div>
            <span className="text-sm font-medium">Folder:</span>
            <p className="text-muted-foreground text-sm">
              {/* TODO: handle root folder, type here is wrong */}
              {fileMetadata.folder.name || "root"}
            </p>
          </div>
          {fileMetadata.folderPath.length > 0 && (
            <div>
              <span className="text-sm font-medium">Path:</span>
              <p className="text-muted-foreground text-sm">
                / {fileMetadata.folderPath.join(" / ")}
              </p>
            </div>
          )}
          <div>
            <span className="text-sm font-medium">Storage Path:</span>
            <p className="text-muted-foreground font-mono text-xs break-all">
              {fileMetadata.storagePath}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Security & Encryption */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 font-medium">
          <KeyIcon className="h-4 w-4" />
          Security & Encryption
        </h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LockIcon className="h-4 w-4" />
            <span className="text-sm">
              Password Protected:{" "}
              {fileMetadata.passwordProtected ? "Yes" : "No"}
            </span>
            {fileMetadata.passwordProtected && (
              <Badge variant="secondary" className="text-xs">
                Protected
              </Badge>
            )}
          </div>

          {fileMetadata.encryptionKeys.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium">Encryption Keys:</span>
              {fileMetadata.encryptionKeys.map((encKey) => (
                <div key={encKey.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <KeyIcon className="h-3 w-3" />
                    <span className="font-medium">Key Alias:</span>
                    <span className="text-muted-foreground">
                      {encKey.kekUsed.alias}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="font-medium">KMS Key ID:</span>
                    <p className="text-muted-foreground font-mono text-xs break-all">
                      {encKey.kekUsed.keyIdentifierInKMS}
                    </p>
                  </div>
                  <div className="mt-1">
                    <span className="font-medium">Created:</span>
                    <span className="text-muted-foreground">
                      {formatDate(encKey.kekUsed.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Ownership */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 font-medium">
          <UserIcon className="h-4 w-4" />
          Ownership
        </h4>
        <div className="space-y-2">
          <div>
            <span className="text-sm font-medium">Owner:</span>
            <p className="text-muted-foreground text-sm">
              {fileMetadata.owner.name ?? fileMetadata.owner.email}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium">Email:</span>
            <p className="text-muted-foreground text-sm">
              {fileMetadata.owner.email}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Tags */}
      {fileMetadata.tags.length > 0 && (
        <>
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 font-medium">
              <TagIcon className="h-4 w-4" />
              Tags
            </h4>
            <div className="flex flex-wrap gap-2">
              {fileMetadata.tags.map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Sharing */}
      {fileMetadata.sharedFiles.length > 0 && (
        <>
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 font-medium">
              <ShareIcon className="h-4 w-4" />
              Sharing
            </h4>
            <div className="space-y-2">
              {fileMetadata.sharedFiles.map((sharedFile) => (
                <div
                  key={sharedFile.id}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">Shared Path:</span>
                    <p className="text-muted-foreground">
                      {sharedFile.sharedBy.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Timestamps */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 font-medium">
          <CalendarIcon className="h-4 w-4" />
          Timestamps
        </h4>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Created:</span>
            <p className="text-muted-foreground">
              {formatDate(fileMetadata.createdAt)}
            </p>
          </div>
          <div>
            <span className="font-medium">Last Modified:</span>
            <p className="text-muted-foreground">
              {formatDate(fileMetadata.updatedAt)}
            </p>
          </div>
          {fileMetadata.deletedAt && (
            <div>
              <span className="font-medium">Deleted:</span>
              <p className="text-muted-foreground">
                {formatDate(fileMetadata.deletedAt)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* System Information */}
      <Separator />
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 font-medium">
          <HardDriveIcon className="h-4 w-4" />
          System Information
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">File ID:</span>
            <p className="text-muted-foreground font-mono text-xs break-all">
              {fileMetadata.id}
            </p>
          </div>
          <div>
            <span className="font-medium">Folder ID:</span>
            <p className="text-muted-foreground font-mono text-xs break-all">
              {fileMetadata.folder.id}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FileMetadataDrawer({
  fileId,
  open,
  onOpenChange,
}: FileMetadataDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>File Metadata</DrawerTitle>
          <DrawerDescription>
            Detailed information about this file including security and
            encryption details.
          </DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
          {fileId ? (
            <FileMetadataContent fileId={fileId} />
          ) : (
            <div className="p-6 text-center">
              <FileIcon className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">No file selected</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
