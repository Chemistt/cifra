/* eslint-disable unicorn/no-null */
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const ADD_TAG_SCHEMA = z.object({
  itemId: z.string(),
  itemType: z.union([z.literal("file"), z.literal("folder")]),
  tag: z.string().min(1).max(32),
});

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
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { query } = input;

      // If no query is provided, return empty results
      if (!query.trim()) {
        return [];
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
              include: {
                tag: true,
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

  // Delete Files
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

    addTagToItem: protectedProcedure
    .input(ADD_TAG_SCHEMA)
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
      if (itemType === "file") {
        await ctx.db.fileTag.upsert({
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
        });
      } else {
        await ctx.db.folderTag.upsert({
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
        });
      }
      return { success: true };
    }),
});
