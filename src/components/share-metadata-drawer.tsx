"use client";

import type { inferRouterOutputs } from "@trpc/server";
import {
  CalendarIcon,
  DownloadIcon,
  InfoIcon,
  ShareIcon,
  UserIcon,
} from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatFileSize, getFileIcon } from "@/lib/utils";
import type { AppRouter } from "@/server/api/root";

type MyShare = inferRouterOutputs<AppRouter>["sharing"]["getMyShares"][number];

type ShareMetadataDrawerProps = {
  share: MyShare | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function ShareMetadataContent({ share }: { share: MyShare }) {
  return (
    <div className="space-y-6 p-6">
      {/* Basic Share Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ShareIcon className="h-8 w-8 text-blue-500" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">
              Share ({share.sharedFiles.length} file
              {share.sharedFiles.length === 1 ? "" : "s"})
            </h3>
            <p className="text-muted-foreground text-sm">
              Created {formatDate(share.createdAt)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Recipients:</span>
            <p className="text-muted-foreground">
              {share.sharedUsers.length} user
              {share.sharedUsers.length === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <span className="font-medium">Downloads:</span>
            <p className="text-muted-foreground">{share.downloadCount}</p>
          </div>
          {share.maxDownloads && (
            <div>
              <span className="font-medium">Max Downloads:</span>
              <p className="text-muted-foreground">{share.maxDownloads}</p>
            </div>
          )}
          {share.expiresAt && (
            <div>
              <span className="font-medium">Expires:</span>
              <p className="text-orange-600">{formatDate(share.expiresAt)}</p>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Files */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 font-medium">
          <InfoIcon className="h-4 w-4" />
          Files ({share.sharedFiles.length})
        </h4>
        <div className="space-y-3">
          {share.sharedFiles.map((sharedFile) => (
            <div
              key={sharedFile.id}
              className="flex items-center gap-4 rounded-lg border p-3"
            >
              <div className="text-xl">
                {getFileIcon(sharedFile.file.mimeType)}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium">{sharedFile.file.name}</h4>
                <p className="text-muted-foreground text-sm">
                  {formatFileSize(sharedFile.file.size)} •{" "}
                  {formatDate(sharedFile.file.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Recipients */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 font-medium">
          <UserIcon className="h-4 w-4" />
          Recipients ({share.sharedUsers.length})
        </h4>
        <div className="space-y-2">
          {share.sharedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <UserIcon className="h-4 w-4 text-gray-500" />
              <div>
                <p className="font-medium">{user.name ?? user.email}</p>
                {user.name && (
                  <p className="text-muted-foreground text-xs">{user.email}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Share Activity */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 font-medium">
          <DownloadIcon className="h-4 w-4" />
          Activity
        </h4>
        <div className="rounded-lg border p-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">Total Downloads:</span>
              <p className="text-muted-foreground">{share.downloadCount}</p>
            </div>
            {share.maxDownloads && (
              <div>
                <span className="font-medium">Remaining:</span>
                <p className="text-muted-foreground">
                  {share.maxDownloads - share.downloadCount}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator />

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
              {formatDate(share.createdAt)}
            </p>
          </div>
          {share.expiresAt && (
            <div>
              <span className="font-medium">Expires:</span>
              <p className="text-orange-600">{formatDate(share.expiresAt)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ShareMetadataDrawer({
  share,
  open,
  onOpenChange,
}: ShareMetadataDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Share Details</DrawerTitle>
          <DrawerDescription>
            Detailed information about this shared collection including
            recipients and activity.
          </DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
          {share ? (
            <ShareMetadataContent share={share} />
          ) : (
            <div className="p-6 text-center">
              <ShareIcon className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">No share selected</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
