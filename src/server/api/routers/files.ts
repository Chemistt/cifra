/* eslint-disable unicorn/no-null */
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const filesRouter = createTRPCRouter({
  getFolderContents: protectedProcedure
    .input(
      z.object({
        folderId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;

      let { folderId } = input;

      // Assume root folder if no folderId is provided
      if (!folderId) {
        const rootFolder = await ctx.db.folder.findFirst({
          where: {
            ownerId: user.id,
            parentId: null,
          },
          select: {
            id: true,
          },
        });
        if (rootFolder) {
          folderId = rootFolder.id;
        } else {
          const newRootFolder = await ctx.db.folder.create({
            data: {
              name: "",
              ownerId: userId,
              parentId: null,
            },
          });
          folderId = newRootFolder.id;
        }
      }

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
              include: {
                tag: true,
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
              include: {
                tag: true,
              },
            },
          },
        }),
      ]);

      const mappedFolders = folders.map((folder) => ({
        ...folder,
        type: "folder" as const,
        tags: folder.tags.map((tagRelation) => tagRelation.tag),
      }));
      const mappedFiles = files.map((file) => ({
        ...file,
        type: "file" as const,
        tags: file.tags.map((tagRelation) => tagRelation.tag),
      }));

      const items = [...mappedFolders, ...mappedFiles];

      // Sort the items, e.g., folders first, then by name
      items.sort((a, b) => {
        if (a.type === "folder" && b.type === "file") {
          return -1;
        }
        if (a.type === "file" && b.type === "folder") {
          return 1;
        }
        return a.name.localeCompare(b.name);
      });

      return items;
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
  searchFiles: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        tagIds: z.array(z.string()).optional(), // Optional tag filter
        tagMatchMode: z.enum(["any", "all"]).default("any"), // How to match tags
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { query, tagIds, tagMatchMode } = input;

      // If no query and no tags are provided then return empty results
      if (!query.trim() && (!tagIds || tagIds.length === 0)) {
        return [];
      }

      // Build tag filter conditions
      const tagFilter =
        tagIds && tagIds.length > 0
          ? tagMatchMode === "all"
            ? {
                every: {
                  tagId: {
                    in: tagIds,
                  },
                },
              }
            : {
                some: {
                  tagId: {
                    in: tagIds,
                  },
                },
              }
          : undefined;

      // Build search conditions for folders
      const folderConditions = {
        ownerId: userId,
        deletedAt: null,
        ...(query.trim() && {
          name: {
            contains: query,
            mode: "insensitive" as const,
          },
        }),
        ...(tagFilter && { tags: tagFilter }),
      };

      // Build search conditions for files
      const fileConditions = {
        ownerId: userId,
        deletedAt: null,
        ...(query.trim() && {
          name: {
            contains: query,
            mode: "insensitive" as const,
          },
        }),
        ...(tagFilter && { tags: tagFilter }),
      };

      // Search directly across all user's folders and files
      const [matchingFolders, matchingFiles] = await Promise.all([
        ctx.db.folder.findMany({
          where: folderConditions,
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            passwordHash: true,
            parentId: true,
            tags: {
              include: {
                tag: true,
              },
            },
          },
          take: 50, // Limit results for performance
        }),
        ctx.db.file.findMany({
          where: fileConditions,
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
              include: {
                tag: true,
              },
            },
          },
          take: 50, // Limit results for performance
        }),
      ]); // Get folder paths for context
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

      // Map folders with path information
      const mappedFolders = await Promise.all(
        matchingFolders.map(async (folder) => {
          const path = folder.parentId
            ? await getFolderPath(folder.parentId)
            : [];
          return {
            ...folder,
            type: "folder" as const,
            tags: folder.tags.map((tagRelation) => tagRelation.tag),
            path: path,
          };
        }),
      );

      // Map files with path information
      const mappedFiles = await Promise.all(
        matchingFiles.map(async (file) => {
          const path = await getFolderPath(file.folderId);
          return {
            ...file,
            type: "file" as const,
            tags: file.tags.map((tagRelation) => tagRelation.tag),
            path: path,
          };
        }),
      );

      const results = [...mappedFolders, ...mappedFiles];

      // Sort results: folders first, then by relevance (exact match first), then by name
      results.sort((a, b) => {
        // Folders first
        if (a.type === "folder" && b.type === "file") {
          return -1;
        }
        if (a.type === "file" && b.type === "folder") {
          return 1;
        }

        // Exact matches first
        const aExact = a.name.toLowerCase() === query.toLowerCase();
        const bExact = b.name.toLowerCase() === query.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Secondly by name
        return a.name.localeCompare(b.name);
      });

      return results;
    }),
  getUserTags: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;
    const userId = user.id;

    const userTags = await ctx.db.userTags.findMany({
      where: {
        ownerId: userId,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            fileTags: true,
            folderTags: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return userTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      fileCount: tag._count.fileTags,
      folderCount: tag._count.folderTags,
      totalCount: tag._count.fileTags + tag._count.folderTags,
    }));
  }),
  searchByTags: protectedProcedure
    .input(
      z.object({
        tagIds: z.array(z.string()).min(1, "At least one tag must be selected"),
        matchMode: z.enum(["any", "all"]).default("any"), // Match any tag or all tags
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { tagIds, matchMode } = input;

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

      // Search folders by tags
      const folderQuery = {
        where: {
          ownerId: userId,
          deletedAt: null,
          tags:
            matchMode === "all"
              ? {
                  every: {
                    tagId: {
                      in: tagIds,
                    },
                  },
                }
              : {
                  some: {
                    tagId: {
                      in: tagIds,
                    },
                  },
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
            include: {
              tag: true,
            },
          },
        },
        take: 50,
      };

      // Search files by tags
      const fileQuery = {
        where: {
          ownerId: userId,
          deletedAt: null,
          tags:
            matchMode === "all"
              ? {
                  every: {
                    tagId: {
                      in: tagIds,
                    },
                  },
                }
              : {
                  some: {
                    tagId: {
                      in: tagIds,
                    },
                  },
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
            include: {
              tag: true,
            },
          },
        },
        take: 50,
      };

      const [matchingFolders, matchingFiles] = await Promise.all([
        ctx.db.folder.findMany(folderQuery),
        ctx.db.file.findMany(fileQuery),
      ]);

      // Map folders with path information
      const mappedFolders = await Promise.all(
        matchingFolders.map(async (folder) => {
          const path = folder.parentId
            ? await getFolderPath(folder.parentId)
            : [];
          return {
            ...folder,
            type: "folder" as const,
            tags: folder.tags.map((tagRelation) => tagRelation.tag),
            path: path,
          };
        }),
      );

      // Map files with path information
      const mappedFiles = await Promise.all(
        matchingFiles.map(async (file) => {
          const path = await getFolderPath(file.folderId);
          return {
            ...file,
            type: "file" as const,
            tags: file.tags.map((tagRelation) => tagRelation.tag),
            path: path,
          };
        }),
      );

      const results = [...mappedFolders, ...mappedFiles];

      // Sort results: folders first, then by name
      results.sort((a, b) => {
        // Folders first
        if (a.type === "folder" && b.type === "file") {
          return -1;
        }
        if (a.type === "file" && b.type === "folder") {
          return 1;
        }

        // Then by name
        return a.name.localeCompare(b.name);
      });

      return results;
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
              folderPath: true,
              uploadedById: true,
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
});

// Helper function for file size formatting
function formatFileSize(bytes: bigint): string {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === BigInt(0)) return "0 Bytes";
  const k = 1024;
  const index = Math.floor(Math.log(Number(bytes)) / Math.log(k));
  return `${String(Math.round((Number(bytes) / Math.pow(k, index)) * 100) / 100)} ${String(sizes[index])}`;
}
