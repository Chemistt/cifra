/* eslint-disable unicorn/no-null */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const PASSWORD_SCHEMA = z.object({
  fileId: z.string(),
  password: z.string().min(1, "Password is required"),
});

const VERIFY_PASSWORD_SCHEMA = z.object({
  fileId: z.string(),
  password: z.string().min(1, "Password is required"),
});

const CHANGE_PASSWORD_SCHEMA = z.object({
  fileId: z.string(),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

const REMOVE_PASSWORD_SCHEMA = z.object({
  fileId: z.string(),
  currentPassword: z.string().min(1),
});

const RESET_PASSWORD_SCHEMA = z.object({
  fileId: z.string(),
  newPassword: z.string().min(1, "New password is required"),
});

const UserTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  fileCount: z.number(),
  folderCount: z.number(),
  totalCount: z.number(),
});

const verifyFilePassword = protectedProcedure
  .input(VERIFY_PASSWORD_SCHEMA)
  .mutation(async ({ ctx, input }) => {
    const { fileId, password } = input;
    const { user } = ctx.session;
    const userId = user.id;

    const file = await ctx.db.file.findFirst({
      where: { id: fileId, ownerId: userId, deletedAt: undefined },
      select: { passwordHash: true },
    });

    if (!file)
      throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
    if (!file.passwordHash) return { valid: true };

    const valid = await bcrypt.compare(password, file.passwordHash);
    return { valid };
  });

const changeFilePassword = protectedProcedure
  .input(CHANGE_PASSWORD_SCHEMA)
  .mutation(async ({ ctx, input }) => {
    const { fileId, currentPassword, newPassword } = input;
    const { user } = ctx.session;
    const userId = user.id;

    const file = await ctx.db.file.findFirst({
      where: { id: fileId, ownerId: userId, deletedAt: undefined },
      select: { passwordHash: true },
    });

    if (!file?.passwordHash)
      throw new TRPCError({ code: "NOT_FOUND", message: "No password set" });

    const valid = await bcrypt.compare(currentPassword, file.passwordHash);
    if (!valid)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Incorrect current password",
      });

    const newHash = await bcrypt.hash(newPassword, 10);

    await ctx.db.file.update({
      where: { id: fileId, ownerId: userId, deletedAt: undefined },
      data: { passwordHash: newHash },
    });

    return { success: true };
  });

const removeFilePassword = protectedProcedure
  .input(REMOVE_PASSWORD_SCHEMA)
  .mutation(async ({ ctx, input }) => {
    const { fileId, currentPassword } = input;
    const { user } = ctx.session;
    const userId = user.id;

    const file = await ctx.db.file.findFirst({
      where: { id: fileId, ownerId: userId, deletedAt: undefined },
      select: { passwordHash: true },
    });

    if (!file?.passwordHash)
      throw new TRPCError({ code: "NOT_FOUND", message: "No password set" });

    const valid = await bcrypt.compare(currentPassword, file.passwordHash);
    if (!valid)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Incorrect current password",
      });

    await ctx.db.file.update({
      where: { id: fileId, ownerId: userId, deletedAt: undefined },
      data: { passwordHash: null },
    });

    return { success: true };
  });

const resetFilePassword = protectedProcedure
  .input(RESET_PASSWORD_SCHEMA)
  .mutation(async ({ ctx, input }) => {
    const { fileId, newPassword } = input;
    const { user } = ctx.session;
    const userId = user.id;

    // Verify user has 2FA enabled (required for password reset)
    if (!user.twoFactorEnabled) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Two-factor authentication must be enabled to reset file passwords",
      });
    }

    // Verify file exists and user owns it
    const file = await ctx.db.file.findFirst({
      where: { id: fileId, ownerId: userId, deletedAt: undefined },
      select: { id: true, name: true, passwordHash: true },
    });

    if (!file) {
      throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
    }

    if (!file.passwordHash) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "File does not have a password set",
      });
    }

    // Hash the new password
    const newHash = await bcrypt.hash(newPassword, 10);

    // Update the file with new password hash
    await ctx.db.file.update({
      where: { id: fileId, ownerId: userId, deletedAt: undefined },
      data: { passwordHash: newHash },
    });

    return { success: true, fileName: file.name };
  });

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
        tagIds: z.array(z.string()).optional(),
        tagMatchMode: z.enum(["any", "all"]).default("any"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { query, tagIds, tagMatchMode } = input;

      // If no query and no tags are provided, return empty results
      if (!query.trim() && (!tagIds || tagIds.length === 0)) {
        return FolderSearchContentSchema.parse({
          files: [],
          folders: [],
        });
      }

      // Build search conditions for folders and files
      const baseCondition = {
        ownerId: userId,
        deletedAt: null,
      };

      // Build text search condition
      const textCondition = query.trim()
        ? {
            name: {
              contains: query,
              mode: "insensitive" as const,
            },
          }
        : {};

      // Build tag filter conditions
      const tagCondition =
        tagIds && tagIds.length > 0
          ? tagMatchMode === "all"
            ? {
                AND: tagIds.map((tagId) => ({
                  tags: {
                    some: {
                      tagId,
                    },
                  },
                })),
              }
            : {
                tags: {
                  some: {
                    tagId: {
                      in: tagIds,
                    },
                  },
                },
              }
          : {};

      // Combine all conditions
      const whereCondition = {
        ...baseCondition,
        ...textCondition,
        ...tagCondition,
      };

      // Search directly across all user's folders and files
      const [matchingFolders, matchingFiles] = await Promise.all([
        ctx.db.folder.findMany({
          where: whereCondition,
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
          where: whereCondition,
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

      // Get file and verify user has access (either owner or shared with them)
      const file = await ctx.db.file.findFirst({
        where: {
          id: fileId,
          deletedAt: null,
          OR: [
            { ownerId: user.id }, // User owns the file
            {
              // File is shared with the user (through their KEK)
              encryptedDeks: {
                some: {
                  kekUsed: {
                    userId: user.id,
                  },
                },
              },
            },
          ],
        },
        include: {
          encryptedDeks: {
            where: {
              kekUsed: {
                userId: user.id, // Only get DEKs encrypted with current user's KEKs
              },
            },
          },
        },
      });

      if (!file) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found or you don't have access",
        });
      }

      // Check if user has an encrypted DEK for this file
      if (file.encryptedDeks.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to decrypt this file",
        });
      }

      // Get the user's encrypted DEK (should be only one)
      const userEncryptedDEK = file.encryptedDeks[0];

      if (!userEncryptedDEK) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No encrypted DEK found for user",
        });
      }

      // Convert encrypted DEK to base64 for transport
      const encryptedDEKBase64 = Buffer.from(
        userEncryptedDEK.dekCiphertext,
      ).toString("base64");

      return {
        fileId: file.id,
        fileName: file.name,
        originalMimeType: file.mimeType,
        originalSize: file.size.toString(),
        storagePath: file.storagePath,
        encryptedDEKBase64,
        keyId: userEncryptedDEK.kekIdUsed,
        iv: userEncryptedDEK.iv,
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

  setFilePassword: protectedProcedure
    .input(PASSWORD_SCHEMA)
    .mutation(async ({ ctx, input }) => {
      const { fileId, password } = input;
      // Use bcrypt or argon2 in production; here is a placeholder
      const passwordHash = await bcrypt.hash(password, 10);

      await ctx.db.file.update({
        where: {
          id: fileId,
          ownerId: ctx.session.user.id,
          deletedAt: undefined,
        },
        data: { passwordHash },
      });

      return { success: true };
    }),

  verifyFilePassword,
  changeFilePassword,
  removeFilePassword,
  resetFilePassword,

  getFileMetadata: protectedProcedure
    .input(
      z.object({
        fileId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { fileId } = input;

      // Fetch comprehensive file metadata
      const file = await ctx.db.file.findFirst({
        where: {
          id: fileId,
          ownerId: userId,
          deletedAt: null,
          encryptedDeks: {
            some: {
              kekUsed: {
                userId: userId,
              },
            },
          },
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          folder: {
            select: {
              id: true,
              name: true,
              parentId: true,
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          encryptedDeks: {
            include: {
              kekUsed: {
                select: {
                  id: true,
                  alias: true,
                  keyIdentifierInKMS: true,
                  createdAt: true,
                },
              },
            },
          },
          sharedFiles: {
            select: {
              id: true,
              sharedAt: true,
              sharedBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!file) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found or you don't have permission to view it",
        });
      }

      // Get full folder path
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

      const folderPath = await getFolderPath(file.folderId);

      // Format file size
      const fileSizeFormatted = formatFileSize(file.size);

      return {
        id: file.id,
        name: file.name,
        size: file.size,
        sizeFormatted: fileSizeFormatted,
        mimeType: file.mimeType,
        storagePath: file.storagePath,
        md5: file.md5,
        version: file.version,
        passwordProtected: !!file.passwordHash,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        deletedAt: file.deletedAt,
        owner: file.owner,
        folder: file.folder,
        folderPath,
        tags: file.tags.map((tagRelation) => tagRelation.tag),
        encryptionKeys: file.encryptedDeks,
        sharedFiles: file.sharedFiles,
        // Additional calculated metadata
        isImage: file.mimeType.startsWith("image/"),
        isVideo: file.mimeType.startsWith("video/"),
        isAudio: file.mimeType.startsWith("audio/"),
        isPDF: file.mimeType.includes("pdf"),
        isDocument:
          file.mimeType.includes("document") || file.mimeType.includes("word"),
        fileExtension: file.name.split(".").pop()?.toLowerCase() ?? "",
      };
    }),
  getFolderMetadata: protectedProcedure
    .input(
      z.object({
        folderId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { folderId } = input;

      // Fetch comprehensive folder metadata
      const folder = await ctx.db.folder.findFirst({
        where: {
          id: folderId,
          ownerId: userId,
          deletedAt: null,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });

      if (!folder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Folder not found or you don't have permission to view it",
        });
      }

      return {
        id: folder.id,
        name: folder.name,
        passwordProtected: !!folder.passwordHash,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        deletedAt: folder.deletedAt,
        owner: folder.owner,
        tags: folder.tags.map((tagRelation) => tagRelation.tag),
      };
    }),
  getUserTags: protectedProcedure
    .output(z.array(UserTagSchema))
    .query(async ({ ctx }) => {
      const { user } = ctx.session;
      const userId = user.id;

      const tags = await ctx.db.userTags.findMany({
        where: { ownerId: userId },
        include: {
          _count: {
            select: {
              fileTags: true,
              folderTags: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        fileCount: tag._count.fileTags,
        folderCount: tag._count.folderTags,
        totalCount: tag._count.fileTags + tag._count.folderTags,
      }));
    }),
  addTagToItem: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        itemType: z.union([z.literal("file"), z.literal("folder")]),
        tag: z.string().min(1).max(32),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { itemId, itemType, tag } = input;
      const userId = ctx.session.user.id;

      // Find or create the tag for the user
      const userTag = await ctx.db.userTags.upsert({
        where: {
          ownerId_name: {
            ownerId: userId,
            name: tag,
          },
        },
        update: {},
        create: {
          ownerId: userId,
          name: tag,
        },
      });

      // Connect the tag to the file or folder
      await (itemType === "file"
        ? ctx.db.fileTag.upsert({
            where: {
              fileId_tagId: {
                fileId: itemId,
                tagId: userTag.id,
              },
            },
            update: {},
            create: {
              fileId: itemId,
              tagId: userTag.id,
              assignedBy: userId,
            },
          })
        : ctx.db.folderTag.upsert({
            where: {
              folderId_tagId: {
                folderId: itemId,
                tagId: userTag.id,
              },
            },
            update: {},
            create: {
              folderId: itemId,
              tagId: userTag.id,
              assignedBy: userId,
            },
          }));
      return { success: true };
    }),
  removeTagFromItem: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        itemType: z.union([z.literal("file"), z.literal("folder")]),
        tagId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { itemId, itemType, tagId } = input;
      const userId = ctx.session.user.id;

      // Verify the tag belongs to the user
      const userTag = await ctx.db.userTags.findFirst({
        where: {
          id: tagId,
          ownerId: userId,
        },
      });

      if (!userTag) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tag not found or you don't have permission to remove it",
        });
      }

      // Remove the tag association from the file or folder
      try {
        await (itemType === "file"
          ? ctx.db.fileTag.delete({
              where: {
                fileId_tagId: {
                  fileId: itemId,
                  tagId: tagId,
                },
              },
            })
          : ctx.db.folderTag.delete({
              where: {
                folderId_tagId: {
                  folderId: itemId,
                  tagId: tagId,
                },
              },
            }));
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tag association not found",
        });
      }

      return { success: true };
    }),
  renameFolder: protectedProcedure
    .input(
      z.object({
        folderId: z.string(),
        newName: z.string().min(1, "Folder name cannot be empty"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { folderId, newName } = input;

      // First, verify the folder belongs to the user
      const existingFolder = await ctx.db.folder.findFirst({
        where: {
          id: folderId,
          ownerId: userId,
          deletedAt: null,
        },
      });

      if (!existingFolder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Folder not found or you don't have permission to edit it",
        });
      }

      // Update the folder name
      const updatedFolder = await ctx.db.folder.update({
        where: {
          id: folderId,
        },
        data: {
          name: newName,
          updatedAt: new Date(),
        },
      });

      return updatedFolder;
    }),
  deleteFolder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { id } = input;

      // First, verify the folder belongs to the user
      const existingFolder = await ctx.db.folder.findFirst({
        where: {
          id,
          ownerId: userId,
          deletedAt: null,
        },
      });

      if (!existingFolder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Folder not found or you don't have permission to delete it",
        });
      }

      // Check if folder has subfolders or files
      const [subFolders, files] = await Promise.all([
        ctx.db.folder.count({
          where: {
            parentId: id,
            deletedAt: null,
          },
        }),
        ctx.db.file.count({
          where: {
            folderId: id,
            deletedAt: null,
          },
        }),
      ]);

      if (subFolders > 0 || files > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cannot delete folder that contains files or subfolders. Please move or delete the contents first.",
        });
      }

      // Soft delete the folder
      const deletedFolder = await ctx.db.folder.update({
        where: {
          id,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return deletedFolder;
    }),
  moveFile: protectedProcedure
    .input(
      z.object({
        fileId: z.string(),
        targetFolderId: z.string().optional(), // Optional to allow moving to root
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { fileId } = input;
      let { targetFolderId } = input;

      // If no targetFolderId provided, move to root folder
      targetFolderId ??= await getRootFolder({
        db: ctx.db,
        ownerId: userId,
      });

      // First, verify the file belongs to the user and is not deleted
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
          message: "File not found or you don't have permission to move it",
        });
      }

      // Verify the target folder belongs to the user and is not deleted
      const targetFolder = await ctx.db.folder.findFirst({
        where: {
          id: targetFolderId,
          ownerId: userId,
          deletedAt: null,
        },
      });

      if (!targetFolder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Target folder not found or you don't have permission to access it",
        });
      }

      // Check if a file with the same name already exists in the target folder
      const existingFileInTarget = await ctx.db.file.findFirst({
        where: {
          name: existingFile.name,
          folderId: targetFolderId,
          ownerId: userId,
          deletedAt: null,
          NOT: { id: fileId }, // Exclude the file being moved
        },
      });

      if (existingFileInTarget) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A file named "${existingFile.name}" already exists in the target folder`,
        });
      }

      // Move the file by updating its folderId
      const movedFile = await ctx.db.file.update({
        where: {
          id: fileId,
        },
        data: {
          folderId: targetFolderId,
          updatedAt: new Date(),
        },
      });

      return movedFile;
    }),

  // Analytics endpoints
  getFileUploadStats: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;
    const userId = user.id;

    // Get file upload counts by month for the last 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const monthlyUploads = await ctx.db.$queryRaw<
      { month: string; count: number }[]
    >`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
        COUNT(*)::int as count
      FROM "dbo"."File"
      WHERE "ownerId" = ${userId}
        AND "deletedAt" IS NULL
        AND "createdAt" >= ${oneYearAgo}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt")
    `;

    // Get total statistics
    const totalFiles = await ctx.db.file.count({
      where: {
        ownerId: userId,
        deletedAt: null,
      },
    });

    const totalSizeResult = await ctx.db.file.aggregate({
      where: {
        ownerId: userId,
        deletedAt: null,
      },
      _sum: {
        size: true,
      },
    });

    const totalSize = totalSizeResult._sum.size ?? BigInt(0);

    return {
      monthlyUploads,
      totalFiles,
      totalSize: totalSize.toString(),
      totalSizeFormatted: formatFileSize(totalSize),
    };
  }),

  getMimeTypeStats: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;
    const userId = user.id;

    const mimeTypeStats = await ctx.db.$queryRaw<
      { mimeType: string; count: number; totalSize: string }[]
    >`
      SELECT 
        "mimeType",
        COUNT(*)::int as count,
        SUM("size")::text as "totalSize"
      FROM "dbo"."File"
      WHERE "ownerId" = ${userId}
        AND "deletedAt" IS NULL
      GROUP BY "mimeType"
      ORDER BY count DESC
    `;

    // Categorize mime types for better visualization
    const categorizedStats: {
      category: string;
      count: number;
      totalSize: string;
      types: { mimeType: string; count: number; totalSize: string }[];
    }[] = [];

    for (const item of mimeTypeStats) {
      const { mimeType, count, totalSize } = item;
      const category = categorizeFileType(mimeType);

      const existing = categorizedStats.find(
        (cat) => cat.category === category,
      );
      if (existing) {
        existing.count += count;
        existing.totalSize = (
          BigInt(existing.totalSize) + BigInt(totalSize)
        ).toString();
        existing.types.push({ mimeType, count, totalSize });
      } else {
        categorizedStats.push({
          category,
          count,
          totalSize,
          types: [{ mimeType, count, totalSize }],
        });
      }
    }

    return categorizedStats;
  }),

  getStorageStats: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;
    const userId = user.id;

    // Get file size distribution
    const sizeRanges = [
      { label: "< 1 MB", min: 0, max: 1024 * 1024 },
      { label: "1-10 MB", min: 1024 * 1024, max: 10 * 1024 * 1024 },
      { label: "10-100 MB", min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 },
      {
        label: "100 MB - 1 GB",
        min: 100 * 1024 * 1024,
        max: 1024 * 1024 * 1024,
      },
      {
        label: "> 1 GB",
        min: 1024 * 1024 * 1024,
        max: Number.MAX_SAFE_INTEGER,
      },
    ];

    const sizeDistribution = await Promise.all(
      sizeRanges.map(async (range) => {
        const count = await ctx.db.file.count({
          where: {
            ownerId: userId,
            deletedAt: null,
            size: {
              gte: range.min,
              lt: range.max === Number.MAX_SAFE_INTEGER ? undefined : range.max,
            },
          },
        });

        const totalSize = await ctx.db.file.aggregate({
          where: {
            ownerId: userId,
            deletedAt: null,
            size: {
              gte: range.min,
              lt: range.max === Number.MAX_SAFE_INTEGER ? undefined : range.max,
            },
          },
          _sum: {
            size: true,
          },
        });

        return {
          label: range.label,
          count,
          totalSize: (totalSize._sum.size ?? BigInt(0)).toString(),
          totalSizeFormatted: formatFileSize(totalSize._sum.size ?? BigInt(0)),
        };
      }),
    );

    return sizeDistribution;
  }),

  getRecentActivity: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;
    const userId = user.id;

    // Get activity over the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyActivity = await ctx.db.$queryRaw<
      { date: string; uploads: number; downloads: number }[]
    >`
      SELECT 
        DATE("createdAt") as date,
        COUNT(*)::int as uploads,
        0 as downloads
      FROM "dbo"."File"
      WHERE "ownerId" = ${userId}
        AND "deletedAt" IS NULL
        AND "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY DATE("createdAt")
    `;

    return dailyActivity;
  }),
});

// Helper function for file size formatting
function formatFileSize(bytes: bigint): string {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === BigInt(0)) return "0 Bytes";
  const k = 1024;
  const index = Math.floor(Math.log(Number(bytes)) / Math.log(k));
  return `${String(Math.round((Number(bytes) / Math.pow(k, index)) * 100) / 100)} ${String(sizes[index])}`;
}

// Helper function to categorize file types
function categorizeFileType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Images";
  if (mimeType.startsWith("video/")) return "Videos";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (mimeType.startsWith("text/") || mimeType.includes("text")) return "Text";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("word") ||
    mimeType.includes("excel") ||
    mimeType.includes("powerpoint") ||
    mimeType.includes("presentation")
  ) {
    return "Documents";
  }
  if (
    mimeType.includes("zip") ||
    mimeType.includes("archive") ||
    mimeType.includes("compressed")
  ) {
    return "Archives";
  }
  return "Other";
}
