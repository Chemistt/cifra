/* eslint-disable unicorn/no-null */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const FolderFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  passwordHash: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
});

const FolderFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  passwordHash: z.string().nullable(),
  mimeType: z.string(),
  size: z.bigint(),
  storagePath: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
  encryptedDeks: z.array(
    z.object({
      id: z.string(),
    }),
  ),
});

const FolderContentSchema = z.object({
  baseFolderId: z.string(),
  files: z.array(FolderFileSchema),
  folders: z.array(FolderFolderSchema),
});

const FolderSearchContentSchema = z.object({
  files: z.array(
    z.object({
      ...FolderFileSchema.shape,
      path: z.array(z.string()),
    }),
  ),
  folders: z.array(
    z.object({
      ...FolderFolderSchema.shape,
      path: z.array(z.string()),
    }),
  ),
});

async function getRootFolder({
  db,
  ownerId,
}: {
  db: PrismaClient;
  ownerId: string;
}) {
  const rootFolder = await db.folder.findFirst({
    where: {
      ownerId,
      parentId: null,
    },
    select: {
      id: true,
    },
  });
  if (rootFolder) {
    return rootFolder.id;
  }
  const newRootFolder = await db.folder.create({
    data: {
      name: "",
      ownerId,
      parentId: null,
    },
    select: {
      id: true,
    },
  });
  return newRootFolder.id;
}

// Helper function to flatten tags structure
function flattenTags<
  T extends { tags: { tag: { id: string; name: string } }[] },
>(items: T[]): (Omit<T, "tags"> & { tags: { id: string; name: string }[] })[] {
  return items.map((item) => ({
    ...item,
    tags: item.tags.map((tagRelation) => ({
      id: tagRelation.tag.id,
      name: tagRelation.tag.name,
    })),
  }));
}

export const filesRouter = createTRPCRouter({
  getFolderContents: protectedProcedure
    .input(z.object({ folderId: z.string().optional() }))
    .output(FolderContentSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;

      const folderId =
        input.folderId ??
        (await getRootFolder({
          db: ctx.db,
          ownerId: userId,
        }));

      const [folders, files] = await Promise.all([
        ctx.db.folder.findMany({
          where: {
            ownerId: userId,
            parentId: folderId,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            passwordHash: true,
            tags: {
              select: {
                tag: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        ctx.db.file.findMany({
          where: {
            ownerId: userId,
            folderId: folderId,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            mimeType: true,
            size: true,
            storagePath: true,
            createdAt: true,
            updatedAt: true,
            passwordHash: true,
            tags: {
              select: {
                tag: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            encryptedDeks: {
              select: {
                id: true,
              },
            },
          },
        }),
      ]);

      return FolderContentSchema.parse({
        baseFolderId: folderId,
        files: flattenTags(files),
        folders: flattenTags(folders),
      });
    }),
  createFolder: protectedProcedure
    .input(z.object({ name: z.string(), parentId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;

      const { name, parentId } = input;
      let parentIdToUse = parentId;

      if (!parentIdToUse) {
        const rootFolder = await ctx.db.folder.findFirst({
          where: {
            ownerId: userId,
            parentId: null,
          },
          select: {
            id: true,
          },
        });
        if (rootFolder) {
          parentIdToUse = rootFolder.id;
        } else {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Root folder not found",
          });
        }
      }

      const newFolder = await ctx.db.folder.create({
        data: {
          name,
          ownerId: userId,
          parentId: parentIdToUse,
        },
      });

      return newFolder;
    }),
  createFileMetadata: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        storagePath: z.string(),
        mimeType: z.string(),
        size: z.number(),
        md5: z.string().optional(),
        folderId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;

      const { name, storagePath, mimeType, size, md5, folderId } = input;

      let folderIdToUse = folderId;

      if (!folderIdToUse) {
        const rootFolder = await ctx.db.folder.findFirst({
          where: {
            ownerId: userId,
            parentId: null,
          },
          select: {
            id: true,
          },
        });
        if (rootFolder) {
          folderIdToUse = rootFolder.id;
        } else {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Root folder not found",
          });
        }
      }

      const newFile = await ctx.db.file.create({
        data: {
          name,
          storagePath,
          mimeType,
          size,
          md5,
          folderId: folderIdToUse,
          ownerId: userId,
        },
      });

      return newFile;
    }),
  createEncryptedFileMetadata: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        storagePath: z.string(),
        mimeType: z.string(), // Original MIME type before encryption
        size: z.number(), // Original size before encryption
        encryptedSize: z.number(), // Actual encrypted file size
        md5: z.string().optional(),
        folderId: z.string().optional(),
        encryptedDEK: z.string(), // Base64 encoded encrypted DEK from KMS
        keyId: z.string(), // ID of the UserKey used to encrypt the DEK
        iv: z.string(), // Base64 encoded IV used for file encryption
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;

      const {
        name,
        storagePath,
        mimeType,
        size,
        encryptedSize,
        md5,
        folderId,
        encryptedDEK,
        keyId,
        iv,
      } = input;

      let folderIdToUse = folderId;

      if (!folderIdToUse) {
        const rootFolder = await ctx.db.folder.findFirst({
          where: {
            ownerId: userId,
            parentId: null,
          },
          select: {
            id: true,
          },
        });
        if (rootFolder) {
          folderIdToUse = rootFolder.id;
        } else {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Root folder not found",
          });
        }
      }

      // Verify the key belongs to the user
      const userKey = await ctx.db.userKey.findFirst({
        where: {
          id: keyId,
          userId: userId,
        },
      });

      if (!userKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Encryption key not found",
        });
      }

      // Create file and encrypted DEK in a transaction
      const result = await ctx.db.$transaction(async (tx) => {
        // Create the file record
        const newFile = await tx.file.create({
          data: {
            name,
            storagePath,
            mimeType,
            size: BigInt(size), // Store original size
            md5,
            folderId: folderIdToUse,
            ownerId: userId,
          },
        });

        // Create the encrypted DEK record
        // Convert base64 string back to Buffer for database storage
        const encryptedDEKBuffer = Buffer.from(encryptedDEK, "base64");
        const encryptedDEKRecord = await tx.encryptedDEK.create({
          data: {
            dekCiphertext: encryptedDEKBuffer,
            iv: iv, // Store the IV for decryption
            kekIdUsed: keyId,
            fileId: newFile.id,
          },
        });

        return {
          file: newFile,
          encryptedDEK: encryptedDEKRecord,
          metadata: {
            iv,
            encryptedSize,
            originalSize: size,
            originalMimeType: mimeType,
          },
        };
      });

      return result;
    }),
  searchFiles: protectedProcedure
    .input(
      z.object({
        query: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { query } = input;

      // If no query is provided, return empty results
      if (!query.trim()) {
        return FolderSearchContentSchema.parse({
          files: [],
          folders: [],
        });
      }

      // Search directly across all user's folders and files
      const [matchingFolders, matchingFiles] = await Promise.all([
        ctx.db.folder.findMany({
          where: {
            ownerId: userId,
            deletedAt: null,
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            passwordHash: true,
            parentId: true,
            tags: {
              select: {
                tag: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          take: 50, // Limit results for performance
        }),
        ctx.db.file.findMany({
          where: {
            ownerId: userId,
            deletedAt: null,
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
            name: true,
            mimeType: true,
            size: true,
            storagePath: true,
            createdAt: true,
            updatedAt: true,
            passwordHash: true,
            folderId: true,
            tags: {
              select: {
                tag: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            encryptedDeks: {
              select: {
                id: true,
              },
            },
          },
          take: 50, // Limit results for performance
        }),
      ]);

      // Get folder paths for context
      const getFolderPath = async (folderId: string): Promise<string[]> => {
        const folder = await ctx.db.folder.findUnique({
          where: { id: folderId },
          select: { name: true, parentId: true },
        });

        if (!folder?.parentId) {
          return folder?.name ? [folder.name] : [];
        }

        const parentPath = await getFolderPath(folder.parentId);
        return [...parentPath, folder.name];
      };

      // Map folders with path information and flatten tags
      const mappedFolders = await Promise.all(
        matchingFolders.map(async (folder) => {
          const path = folder.parentId
            ? await getFolderPath(folder.parentId)
            : [];
          return {
            ...folder,
            path: path,
            tags: folder.tags.map((tagRelation) => ({
              id: tagRelation.tag.id,
              name: tagRelation.tag.name,
            })),
          };
        }),
      );

      // Map files with path information and flatten tags
      const mappedFiles = await Promise.all(
        matchingFiles.map(async (file) => {
          const path = await getFolderPath(file.folderId);
          return {
            ...file,
            path: path,
            tags: file.tags.map((tagRelation) => ({
              id: tagRelation.tag.id,
              name: tagRelation.tag.name,
            })),
          };
        }),
      );

      return FolderSearchContentSchema.parse({
        files: mappedFiles,
        folders: mappedFolders,
      });
    }),
  renameFile: protectedProcedure
    .input(
      z.object({
        fileId: z.string(),
        newName: z.string().min(1, "File name cannot be empty"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { fileId, newName } = input;

      // First, verify the file belongs to the user
      const existingFile = await ctx.db.file.findFirst({
        where: {
          id: fileId,
          ownerId: userId,
          deletedAt: null,
        },
      });

      if (!existingFile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found or you don't have permission to edit it",
        });
      }

      // Update the file name
      const updatedFile = await ctx.db.file.update({
        where: {
          id: fileId,
        },
        data: {
          name: newName,
          updatedAt: new Date(),
        },
      });

      return updatedFile;
    }),
  getFileEncryptionDetails: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { fileId } = input;

      // Get file and verify ownership
      const file = await ctx.db.file.findFirst({
        where: {
          id: fileId,
          ownerId: user.id,
          deletedAt: null,
        },
        include: {
          encryptedDeks: true,
        },
      });

      if (!file) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found",
        });
      }

      // Check if file is encrypted (has encrypted DEKs)
      if (file.encryptedDeks.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File is not encrypted",
        });
      }

      // Get the most recent encrypted DEK (in case of key rotation)
      const latestEncryptedDEK = file.encryptedDeks.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0];

      if (!latestEncryptedDEK) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No encrypted DEK found for file",
        });
      }

      // Convert encrypted DEK to base64 for transport
      const encryptedDEKBase64 = latestEncryptedDEK.dekCiphertext.toString();

      return {
        fileId: file.id,
        fileName: file.name,
        originalMimeType: file.mimeType,
        originalSize: file.size.toString(),
        storagePath: file.storagePath,
        encryptedDEKBase64,
        keyId: latestEncryptedDEK.kekIdUsed ?? "",
        iv: latestEncryptedDEK.iv ?? "",
      };
    }),
  deleteFile: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { id } = input;

      try {
        // Soft delete by updating 'deletedAt' values
        const deletedFile = await ctx.db.file.update({
          where: {
            id,
            ownerId: userId,
            deletedAt: undefined,
          },
          data: { deletedAt: new Date() },
        });

        return deletedFile;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found or already deleted.",
        });
      }
    }),
});
