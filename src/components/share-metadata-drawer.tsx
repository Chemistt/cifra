"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  CalendarIcon,
  DownloadIcon,
  InfoIcon,
  PlusIcon,
  ShareIcon,
  Trash2Icon,
  UserIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatFileSize, getFileIcon } from "@/lib/utils";
import type { AppRouter } from "@/server/api/root";
import { useTRPC } from "@/trpc/react";

type MyShare = inferRouterOutputs<AppRouter>["sharing"]["getMyShares"][number];

type ShareMetadataDrawerProps = {
  share: MyShare | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function AddFilesDialog({
  isOpen,
  onOpenChange,
  shareId,
  onShareUpdated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  shareId: string;
  onShareUpdated: () => void;
}) {
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: userFiles } = useQuery(
    trpc.files.getFolderContents.queryOptions({
      folderId: undefined, // Root folder
    }),
  );

  const addFilesMutation = useMutation(
    trpc.sharing.addFilesToShare.mutationOptions({
      onSuccess: () => {
        toast.success("Files added to share successfully");
        // Invalidate all sharing-related queries
        void queryClient.invalidateQueries({
          queryKey: trpc.sharing.getMyShares.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.sharing.getSharedWithMe.queryKey(),
        });
        setSelectedFileIds([]);
        onOpenChange(false);
        // Close the main drawer to show fresh data when reopened
        onShareUpdated();
      },
      onError: (error) => {
        toast.error(`Failed to add files: ${error.message}`);
      },
    }),
  );

  const handleAddFiles = () => {
    if (selectedFileIds.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    addFilesMutation.mutate({
      shareGroupId: shareId,
      fileIds: selectedFileIds,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Files to Share</DialogTitle>
          <DialogDescription>
            Select files to add to this share. Only encrypted files can be
            shared.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {userFiles?.files.map((file) => (
            <div
              key={file.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                selectedFileIds.includes(file.id)
                  ? "border-blue-200 bg-blue-50"
                  : "hover:bg-gray-50"
              }`}
              onClick={() => {
                setSelectedFileIds((previous) =>
                  previous.includes(file.id)
                    ? previous.filter((id) => id !== file.id)
                    : [...previous, file.id],
                );
              }}
            >
              <input
                type="checkbox"
                checked={selectedFileIds.includes(file.id)}
                onChange={() => {
                  // Handled by parent onClick
                }}
                className="pointer-events-none"
              />
              <div className="text-lg">{getFileIcon(file.mimeType)}</div>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium">{file.name}</h4>
                <p className="text-muted-foreground text-sm">
                  {formatFileSize(BigInt(file.size))}
                </p>
              </div>
            </div>
          ))}
          {userFiles?.files.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No files available to add
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddFiles}
            disabled={
              addFilesMutation.isPending || selectedFileIds.length === 0
            }
          >
            {addFilesMutation.isPending ? "Adding..." : "Add Files"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRecipientsDialog({
  isOpen,
  onOpenChange,
  shareId,
  onShareUpdated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  shareId: string;
  onShareUpdated: () => void;
}) {
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const addRecipientsMutation = useMutation(
    trpc.sharing.addRecipientsToShare.mutationOptions({
      onSuccess: () => {
        toast.success("Recipients added to share successfully");
        // Invalidate all sharing-related queries
        void queryClient.invalidateQueries({
          queryKey: trpc.sharing.getMyShares.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.sharing.getSharedWithMe.queryKey(),
        });
        setRecipientEmails([]);
        setCurrentEmail("");
        onOpenChange(false);
        // Close the main drawer to show fresh data when reopened
        onShareUpdated();
      },
      onError: (error) => {
        toast.error(`Failed to add recipients: ${error.message}`);
      },
    }),
  );

  const handleAddEmail = () => {
    const email = currentEmail.trim();
    if (!email) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (recipientEmails.includes(email)) {
      toast.error("Email already added");
      return;
    }

    setRecipientEmails([...recipientEmails, email]);
    setCurrentEmail("");
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setRecipientEmails(
      recipientEmails.filter((email) => email !== emailToRemove),
    );
  };

  const handleAddRecipients = () => {
    if (recipientEmails.length === 0) {
      toast.error("Please add at least one recipient email");
      return;
    }

    addRecipientsMutation.mutate({
      shareGroupId: shareId,
      recipientEmails,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Recipients</DialogTitle>
          <DialogDescription>
            Add new recipients to this share. They will gain access to all files
            in the share.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={currentEmail}
              onChange={(event) => {
                setCurrentEmail(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddEmail();
                }
              }}
            />
            <Button onClick={handleAddEmail} variant="outline" size="sm">
              <UserPlusIcon className="h-4 w-4" />
            </Button>
          </div>

          {recipientEmails.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipientEmails.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1">
                  {email}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => {
                      handleRemoveEmail(email);
                    }}
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddRecipients}
            disabled={
              addRecipientsMutation.isPending || recipientEmails.length === 0
            }
          >
            {addRecipientsMutation.isPending ? "Adding..." : "Add Recipients"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareMetadataContent({
  share,
  onClose,
}: {
  share: MyShare;
  onClose: () => void;
}) {
  const [showAddFiles, setShowAddFiles] = useState(false);
  const [showAddRecipients, setShowAddRecipients] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const removeFileMutation = useMutation(
    trpc.sharing.removeFileFromShare.mutationOptions({
      onSuccess: () => {
        toast.success("File removed from share");
        // Invalidate all sharing-related queries
        void queryClient.invalidateQueries({
          queryKey: trpc.sharing.getMyShares.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.sharing.getSharedWithMe.queryKey(),
        });
        // Close drawer to show fresh data when reopened
        onClose();
      },
      onError: (error) => {
        toast.error(`Failed to remove file: ${error.message}`);
      },
    }),
  );

  const removeRecipientMutation = useMutation(
    trpc.sharing.removeRecipientFromShare.mutationOptions({
      onSuccess: () => {
        toast.success("Recipient removed from share");
        // Invalidate all sharing-related queries
        void queryClient.invalidateQueries({
          queryKey: trpc.sharing.getMyShares.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.sharing.getSharedWithMe.queryKey(),
        });
        // Close drawer to show fresh data when reopened
        onClose();
      },
      onError: (error) => {
        toast.error(`Failed to remove recipient: ${error.message}`);
      },
    }),
  );

  const revokeShareMutation = useMutation(
    trpc.sharing.revokeShare.mutationOptions({
      onSuccess: () => {
        toast.success("Share revoked successfully");
        // Invalidate all sharing-related queries
        void queryClient.invalidateQueries({
          queryKey: trpc.sharing.getMyShares.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.sharing.getSharedWithMe.queryKey(),
        });
        // Close the drawer since the share no longer exists
        setShowRevokeDialog(false);
        onClose();
      },
      onError: (error) => {
        toast.error(`Failed to revoke share: ${error.message}`);
        setShowRevokeDialog(false);
      },
    }),
  );

  const handleRemoveFile = (fileId: string) => {
    removeFileMutation.mutate({
      shareGroupId: share.id,
      fileId,
    });
  };

  const handleRemoveRecipient = (recipientUserId: string) => {
    removeRecipientMutation.mutate({
      shareGroupId: share.id,
      recipientUserId,
    });
  };

  const handleRevokeShare = () => {
    revokeShareMutation.mutate({
      shareGroupId: share.id,
    });
  };

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
          <AlertDialog
            open={showRevokeDialog}
            onOpenChange={setShowRevokeDialog}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={revokeShareMutation.isPending}
              >
                <Trash2Icon className="mr-2 h-4 w-4" />
                {revokeShareMutation.isPending ? "Revoking..." : "Revoke"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke Share</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to revoke this share? This will remove
                  access for all recipients and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRevokeShare}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Revoke Share
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

      {/* Files Management */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 font-medium">
            <InfoIcon className="h-4 w-4" />
            Files ({share.sharedFiles.length})
          </h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAddFiles(true);
            }}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Files
          </Button>
        </div>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleRemoveFile(sharedFile.file.id);
                }}
                disabled={removeFileMutation.isPending}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Recipients Management */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 font-medium">
            <UserIcon className="h-4 w-4" />
            Recipients ({share.sharedUsers.length})
          </h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAddRecipients(true);
            }}
          >
            <UserPlusIcon className="mr-2 h-4 w-4" />
            Add Recipients
          </Button>
        </div>
        <div className="space-y-2">
          {share.sharedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <UserIcon className="h-4 w-4 text-gray-500" />
              <div className="flex-1">
                <p className="font-medium">{user.name ?? user.email}</p>
                {user.name && (
                  <p className="text-muted-foreground text-xs">{user.email}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleRemoveRecipient(user.id);
                }}
                disabled={removeRecipientMutation.isPending}
              >
                <XIcon className="h-4 w-4" />
              </Button>
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

      {/* Dialogs */}
      <AddFilesDialog
        isOpen={showAddFiles}
        onOpenChange={setShowAddFiles}
        shareId={share.id}
        onShareUpdated={onClose}
      />
      <AddRecipientsDialog
        isOpen={showAddRecipients}
        onOpenChange={setShowAddRecipients}
        shareId={share.id}
        onShareUpdated={onClose}
      />
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
            <ShareMetadataContent
              share={share}
              onClose={() => {
                onOpenChange(false);
              }}
            />
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
