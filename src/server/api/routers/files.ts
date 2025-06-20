/* eslint-disable unicorn/no-null */
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
});
