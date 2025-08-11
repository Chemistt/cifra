"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  EditIcon,
  KeyIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCcwIcon,
  ShieldIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

const createKeySchema = z.object({
  alias: z.string().min(1, "Alias is required").max(256, "Alias too long"),
  description: z.string().max(8192, "Description too long").optional(),
  isPrimary: z.boolean(),
  expiryOption: z.enum(["30", "60", "90", "120", "never"]).default("never"),
});

const updateKeySchema = z.object({
  alias: z.string().min(1, "Alias is required").max(256, "Alias too long"),
  description: z.string().max(8192, "Description too long").optional(),
  isPrimary: z.boolean(),
});

type CreateKeyFormData = z.infer<typeof createKeySchema>;
type UpdateKeyFormData = z.infer<typeof updateKeySchema>;

export function SettingsKeyManagement() {
  const trpc = useTRPC();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<
    | {
        id: string;
        alias: string;
        description?: string;
        isPrimary: boolean;
      }
    | undefined
  >();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const keys = useSuspenseQuery(trpc.kms.getKeys.queryOptions());

  const createForm = useForm<CreateKeyFormData>({
    resolver: zodResolver(
      createKeySchema,
    ) as unknown as Resolver<CreateKeyFormData>,
    defaultValues: {
      alias: "",
      description: "",
      isPrimary: false,
      expiryOption: "never",
    },
  });

  const editForm = useForm<UpdateKeyFormData>({
    resolver: zodResolver(
      updateKeySchema,
    ) as unknown as Resolver<UpdateKeyFormData>,
    defaultValues: {
      alias: "",
      description: "",
      isPrimary: false,
    },
  });

  const createKeyMutation = useMutation(
    trpc.kms.createKey.mutationOptions({
      onSuccess: () => {
        toast.success("Key created successfully");
        setIsCreateDialogOpen(false);
        createForm.reset();
        void keys.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const updateKeyMutation = useMutation(
    trpc.kms.updateKey.mutationOptions({
      onSuccess: () => {
        toast.success("Key updated successfully");
        setIsEditDialogOpen(false);
        setEditingKey(undefined);
        editForm.reset();
        void keys.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const deleteKeyMutation = useMutation(
    trpc.kms.deleteKey.mutationOptions({
      onSuccess: () => {
        toast.success("Key deleted successfully");
        void keys.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const rotateKeyMutation = useMutation(
    trpc.kms.rotateDEKsToKey.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          `Key rotation completed: ${String(data.rewrapped)}/${String(data.totalToRewrap)} rewrapped${
            data.failed ? `, ${String(data.failed)} failed` : ""
          }`,
        );
        void keys.refetch();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleCreateKey = (data: CreateKeyFormData) => {
    createKeyMutation.mutate(data);
  };

  const handleEditKey = (key: {
    id: string;
    alias: string;
    description?: string;
    isPrimary: boolean;
  }) => {
    setEditingKey(key);
    editForm.reset({
      alias: key.alias,
      description: key.description ?? "",
      isPrimary: key.isPrimary,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateKey = (data: UpdateKeyFormData) => {
    if (!editingKey) return;

    updateKeyMutation.mutate({
      id: editingKey.id,
      ...data,
    });
  };

  const handleDeleteKey = (id: string) => {
    deleteKeyMutation.mutate({ id });
  };

  const hasKeys = keys.data.length > 0;
  const primaryKey = keys.data.find((k) => k.isPrimary);

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="bg-muted mb-4 rounded-full p-4">
        <KeyIcon className="text-muted-foreground h-8 w-8" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">No encryption keys</h3>
      <p className="text-muted-foreground mb-6 max-w-md text-center">
        Create your first symmetric key to start encrypting and decrypting files
        securely.
      </p>
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Key
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Key</DialogTitle>
            <DialogDescription>
              Create a new symmetric key for encrypting and decrypting files.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void createForm.handleSubmit(handleCreateKey)(event);
              }}
              className="space-y-4"
            >
              <FormField
                control={createForm.control}
                name="alias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alias</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="my-encryption-key"
                        {...field}
                        disabled={createKeyMutation.isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      A friendly name for your key (alphanumeric and hyphens
                      only)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description of what this key will be used for..."
                        {...field}
                        disabled={createKeyMutation.isPending}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Primary Key</FormLabel>
                      <FormDescription>
                        Use this key as the default for new file encryptions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={createKeyMutation.isPending}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="expiryOption"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={createKeyMutation.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Never Expires" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Never Expires</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="120">120 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      Automatically expire this key after a period.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                  }}
                  disabled={createKeyMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createKeyMutation.isPending}>
                  {createKeyMutation.isPending ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <PlusIcon className="mr-2 h-4 w-4" />
                      Create Key
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderKeyList = () => (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Alias</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.data.map((key) => (
            <TableRow key={key.id}>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{key.alias}</span>
                      {key.isPrimary && (
                        <Badge variant="outline" className="text-xs">
                          <ShieldIcon className="mr-1 h-3 w-3" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    {key.description && (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {key.description}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="default">Active</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {key.expiresAt ? (
                  <div className="flex items-center">
                    <span>
                      {formatDate(new Date(key.expiresAt as unknown as Date))}
                    </span>
                    {new Date(key.expiresAt as unknown as Date).getTime() <
                    Date.now() ? (
                      <span className="text-destructive ml-2 text-xs">
                        Expired
                      </span>
                    ) : undefined}
                  </div>
                ) : (
                  <span>Never</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(key.createdAt)}
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  {!key.isPrimary && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={rotateKeyMutation.isPending}
                        >
                          {rotateKeyMutation.isPending ? (
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcwIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Rotate DEKs to this key
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will rewrap all file keys currently encrypted
                            with your primary key to use &quot;{key.alias}&quot;
                            and set it as primary. Continue?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              if (!primaryKey) {
                                toast.error(
                                  "No primary key found to rotate from",
                                );
                                return;
                              }
                              rotateKeyMutation.mutate({
                                fromKeyId: primaryKey.id,
                                toKeyId: key.id,
                                makePrimary: true,
                              });
                            }}
                          >
                            Rotate here
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      handleEditKey({
                        id: key.id,
                        alias: key.alias,
                        description: key.description ?? "",
                        isPrimary: key.isPrimary,
                      });
                    }}
                    disabled={updateKeyMutation.isPending}
                  >
                    <EditIcon className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleteKeyMutation.isPending}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Key</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the key{" "}
                          {`"${key.alias}"`}? This action cannot be undone and
                          the key will be scheduled for deletion in AWS KMS.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            handleDeleteKey(key.id);
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Key
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyIcon className="h-5 w-5" />
            Encryption Keys
          </CardTitle>
          <CardDescription>
            Manage your symmetric encryption keys for secure file storage.
          </CardDescription>
        </div>
        {hasKeys && (
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create Key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Key</DialogTitle>
                <DialogDescription>
                  Create a new symmetric key for encrypting and decrypting
                  files.
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createForm.handleSubmit(handleCreateKey)(event);
                  }}
                  className="space-y-4"
                >
                  <FormField
                    control={createForm.control}
                    name="alias"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alias</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="my-encryption-key"
                            {...field}
                            disabled={createKeyMutation.isPending}
                          />
                        </FormControl>
                        <FormDescription>
                          A friendly name for your key (alphanumeric and hyphens
                          only)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Description of what this key will be used for..."
                            {...field}
                            disabled={createKeyMutation.isPending}
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="isPrimary"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Primary Key
                          </FormLabel>
                          <FormDescription>
                            Use this key as the default for new file encryptions
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={createKeyMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="expiryOption"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={createKeyMutation.isPending}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Never Expires" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="never">
                                Never Expires
                              </SelectItem>
                              <SelectItem value="30">30 days</SelectItem>
                              <SelectItem value="60">60 days</SelectItem>
                              <SelectItem value="90">90 days</SelectItem>
                              <SelectItem value="120">120 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormDescription>
                          Automatically expire this key after a period.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                      }}
                      disabled={createKeyMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createKeyMutation.isPending}
                    >
                      {createKeyMutation.isPending ? (
                        <>
                          <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <PlusIcon className="mr-2 h-4 w-4" />
                          Create Key
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {hasKeys ? renderKeyList() : renderEmptyState()}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Key</DialogTitle>
            <DialogDescription>Update the key information.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void editForm.handleSubmit(handleUpdateKey)(event);
              }}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="alias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alias</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="my-encryption-key"
                        {...field}
                        disabled={updateKeyMutation.isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      A friendly name for your key (alphanumeric and hyphens
                      only)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description of what this key will be used for..."
                        {...field}
                        disabled={updateKeyMutation.isPending}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Primary Key</FormLabel>
                      <FormDescription>
                        Use this key as the default for new file encryptions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateKeyMutation.isPending}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                  }}
                  disabled={updateKeyMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateKeyMutation.isPending}>
                  {updateKeyMutation.isPending ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <EditIcon className="mr-2 h-4 w-4" />
                      Update Key
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
