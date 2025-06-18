"use client";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  EditIcon,
  KeyIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/react";

export function SettingsPasskey() {
  const trpc = useTRPC();
  const [isAdding, setIsAdding] = useState(false);
  const [editingPasskey, setEditingPasskey] = useState<
    | {
        id: string;
        name: string;
      }
    | undefined
  >();
  const [editName, setEditName] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const passkeys = useSuspenseQuery(trpc.passkey.getPasskeys.queryOptions());

  const updatePasskeyMutation = useMutation(
    trpc.passkey.updatePasskeyName.mutationOptions({
      onSuccess: () => {
        toast.success("Passkey name updated successfully");
        setEditingPasskey(undefined);
        setEditName("");
        setIsEditDialogOpen(false);
        void passkeys.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const deletePasskeyMutation = useMutation(
    trpc.passkey.deletePasskey.mutationOptions({
      onSuccess: () => {
        toast.success("Passkey deleted successfully");
        void passkeys.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleAddPasskey = async () => {
    setIsAdding(true);
    try {
      const passkeyMutation = await authClient.passkey.addPasskey();

      if (!passkeyMutation) {
        toast.success("Passkey added successfully");
        void passkeys.refetch();
      }
      toast.error(passkeyMutation?.error.message);
      return;
    } catch (error) {
      console.error("Error adding passkey:", error);
      toast.error("Failed to add passkey. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditPasskey = (passkey: { id: string; name: string }) => {
    setEditingPasskey(passkey);
    setEditName(passkey.name || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdateName = () => {
    if (!editingPasskey) return;

    updatePasskeyMutation.mutate({
      id: editingPasskey.id,
      name: editName.trim(),
    });
  };

  const handleDeletePasskey = (passkeyId: string) => {
    deletePasskeyMutation.mutate({ id: passkeyId });
  };

  // TODO: move to utils
  // eslint-disable-next-line unicorn/consistent-function-scoping
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const renderPasskeyList = () => (
    <div className="space-y-4">
      {passkeys.data.map((passkey) => (
        <div
          key={passkey.id}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <div className="space-y-1">
            <div className="font-medium">
              {passkey.name ?? "Unnamed Passkey"}
            </div>
            <div className="text-muted-foreground text-sm">
              Created {formatDate(passkey.createdAt)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleEditPasskey({
                  id: passkey.id,
                  name: passkey.name ?? "",
                });
              }}
            >
              <EditIcon className="h-4 w-4" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Passkey</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;
                    {passkey.name ?? "Unnamed Passkey"}&quot;? This action
                    cannot be undone and you will no longer be able to use this
                    passkey to sign in.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      handleDeletePasskey(passkey.id);
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletePasskeyMutation.isPending ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      "Delete"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <div className="py-8 text-center">
      <KeyIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      <p className="text-muted-foreground mb-4">
        You haven&apos;t added any passkeys yet.
      </p>
      <p className="text-muted-foreground mb-6 text-sm">
        Passkeys provide secure, passwordless authentication using your
        device&apos;s biometric authentication or security key.
      </p>
      <Button onClick={() => void handleAddPasskey()} disabled={isAdding}>
        {isAdding ? (
          <Loader2Icon className="h-4 w-4 animate-spin" />
        ) : (
          <PlusIcon className="h-4 w-4" />
        )}
        Add Your First Passkey
      </Button>
    </div>
  );

  const hasPasskeys = passkeys.data.length > 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5" />
              Passkeys
            </CardTitle>
            <CardDescription>
              Manage your passkeys for secure passwordless authentication.
            </CardDescription>
          </div>
          <Button
            onClick={() => void handleAddPasskey()}
            disabled={isAdding}
            size="sm"
          >
            {isAdding ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <PlusIcon className="h-4 w-4" />
            )}
            Add Passkey
          </Button>
        </CardHeader>
        <CardContent>
          {hasPasskeys ? renderPasskeyList() : renderEmptyState()}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Passkey Name</DialogTitle>
            <DialogDescription>
              Give your passkey a memorable name to help you identify it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="passkey-name"
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Passkey Name
              </label>
              <Input
                id="passkey-name"
                value={editName}
                onChange={(event) => {
                  setEditName(event.target.value);
                }}
                placeholder="Enter passkey name"
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingPasskey(undefined);
                  setEditName("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateName}
                disabled={updatePasskeyMutation.isPending || !editName.trim()}
              >
                {updatePasskeyMutation.isPending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
