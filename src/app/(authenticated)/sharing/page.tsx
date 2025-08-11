"use client";

import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  CalendarIcon,
  DownloadIcon,
  InfoIcon,
  KeyIcon,
  ShareIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EncryptedFileDownload } from "@/components/encrypted-file-download";
import { LoadingView } from "@/components/loading-view";
import { ShareMetadataDrawer } from "@/components/share-metadata-drawer";
import { SharePasswordManagementDialog } from "@/components/share-password-management-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatFileSize, getFileIcon } from "@/lib/utils";
import type { AppRouter } from "@/server/api/root";
import { useTRPC } from "@/trpc/react";

type SharedGroup =
  inferRouterOutputs<AppRouter>["sharing"]["getSharedWithMe"][number];
type MyShare = inferRouterOutputs<AppRouter>["sharing"]["getMyShares"][number];

function SharedWithMeView() {
  const trpc = useTRPC();

  const { data: sharedGroups, isLoading } = useQuery(
    trpc.sharing.getSharedWithMe.queryOptions(),
  );

  if (isLoading) {
    return <LoadingView />;
  }

  if (!sharedGroups?.length) {
    return (
      <div className="py-12 text-center">
        <ShareIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <h3 className="mb-2 text-lg font-medium">No shared files</h3>
        <p className="text-muted-foreground">
          {`No files have been shared with you yet.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shared Groups */}
      <div className="space-y-4">
        {sharedGroups.map((group) => (
          <SharedGroupCard key={group.id} group={group} />
        ))}
      </div>
    </div>
  );
}

function SharedGroupCard({ group }: { group: SharedGroup }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="h-4 w-4" />
              Shared by {group.owner.name ?? group.owner.email}
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {formatDate(group.createdAt)}
              </span>
              {group.expiresAt && (
                <span className="text-orange-600">
                  Expires {formatDate(group.expiresAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {group.sharedFiles.map((sharedFile) => (
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
                linkToken={group.linkToken}
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
  );
}

function MySharesView() {
  const trpc = useTRPC();
  const [selectedShare, setSelectedShare] = useState<MyShare | undefined>();
  const [passwordManagementShare, setPasswordManagementShare] = useState<
    MyShare | undefined
  >();

  const {
    data: myShares,
    isLoading,
    refetch,
  } = useQuery(trpc.sharing.getMyShares.queryOptions());

  if (isLoading) {
    return <LoadingView />;
  }

  if (!myShares?.length) {
    return (
      <div className="py-12 text-center">
        <ShareIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <h3 className="mb-2 text-lg font-medium">No shares created</h3>
        <p className="text-muted-foreground">
          {`You haven't shared any files yet.`}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-4">
          {myShares.map((share) => (
            <MyShareCard
              key={share.id}
              share={share}
              onViewDetails={() => {
                setSelectedShare(share);
              }}
              onManagePassword={() => {
                setPasswordManagementShare(share);
              }}
            />
          ))}
        </div>
      </div>

      <ShareMetadataDrawer
        share={selectedShare}
        open={!!selectedShare}
        onOpenChange={(open) => {
          if (!open) setSelectedShare(undefined);
        }}
      />

      <SharePasswordManagementDialog
        shareGroupId={passwordManagementShare?.id ?? ""}
        hasPassword={Boolean(passwordManagementShare?.passwordHash)}
        open={!!passwordManagementShare}
        onOpenChange={(open) => {
          if (!open) setPasswordManagementShare(undefined);
        }}
        onPasswordUpdated={() => {
          void refetch();
        }}
      />
    </>
  );
}

function MyShareCard({
  share,
  onViewDetails,
  onManagePassword,
}: {
  share: MyShare;
  onViewDetails: () => void;
  onManagePassword: () => void;
}) {
  const shareUrl = `${globalThis.location.origin}/sharing/${share.linkToken}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShareIcon className="h-4 w-4" />
              Share ({share.sharedFiles.length} file
              {share.sharedFiles.length === 1 ? "" : "s"})
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                Created {formatDate(share.createdAt)}
              </span>
              <span>
                {share.sharedUsers.length} recipient
                {share.sharedUsers.length === 1 ? "" : "s"}
              </span>
              {share.downloadCount > 0 && (
                <span>{share.downloadCount} downloads</span>
              )}
              {share.expiresAt && (
                <span className="text-orange-600">
                  Expires {formatDate(share.expiresAt)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onViewDetails}>
              <InfoIcon className="mr-2 h-4 w-4" />
              Details
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onManagePassword}
              title={share.passwordHash ? "Manage password" : "Set password"}
            >
              <KeyIcon className="mr-2 h-4 w-4" />
              {share.passwordHash ? "Password" : "Set Password"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCopyLink()}
            >
              Copy Link
            </Button>
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SharedPage() {
  return (
    <div className="flex h-full w-full flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shared Files</h1>
          <p className="text-muted-foreground">
            Manage files shared with you and files you&apos;ve shared with
            others.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="shared-with-me" className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="shared-with-me">Shared with Me</TabsTrigger>
          <TabsTrigger value="my-shares">My Shares</TabsTrigger>
        </TabsList>
        <TabsContent value="shared-with-me" className="mt-6">
          <SharedWithMeView />
        </TabsContent>
        <TabsContent value="my-shares" className="mt-6">
          <MySharesView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
