/* eslint-disable unicorn/no-null */
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

// Constants
const FILE_RETENTION_DAYS = 30;

export const deletedRouter = createTRPCRouter({
  // Get Deleted Files
  getDeletedFiles: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;
    const userId = user.id;

    // Calculate retention cutoff date
    const retentionCutoff = new Date();
    retentionCutoff.setDate(retentionCutoff.getDate() - FILE_RETENTION_DAYS);
    
    // Automatically delete expired files 
    await ctx.db.file.deleteMany({
      where: {
        ownerId: userId,
        deletedAt: {
          not: null,
          lt: retentionCutoff,
        },
      },
    });

    // Fetch remaining deleted files (expired files already cleaned up above)
    const files = await ctx.db.file.findMany({
      where: {
        ownerId: userId,
        deletedAt: { 
          not: null,
        },
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { deletedAt: "desc" },
    });

    const mappedFiles = files.map((file) => {
      // Calculate days until permanent deletion
      let daysRemaining = 0;
      if (file.deletedAt) {
        const deletedDate = new Date(file.deletedAt);
        const retentionEndDate = new Date(deletedDate);
        retentionEndDate.setDate(retentionEndDate.getDate() + FILE_RETENTION_DAYS);
        
        const today = new Date();
        const diffTime = retentionEndDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        daysRemaining = Math.max(0, diffDays);
      }

      return {
        ...file,
        type: "file" as const,
        tags: file.tags.map((tagRelation) => tagRelation.tag),
        daysRemaining,
      };
    });

    return mappedFiles;
  }),

  // Restore File
  restoreFile: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { id } = input;

      try {
        return await ctx.db.file.update({
          where: {
            id,
            ownerId: userId,
            deletedAt: { not: null },
          },
          data: { 
            deletedAt: null,
            updatedAt: new Date(),
          },
        });
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found or not deleted.",
        });
      }
    }),

  // Permanently delete a file (user initiated)
  permanentlyDeleteFile: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const userId = user.id;
      const { id } = input;

      try {
        // First check if the file exists and is deleted
        const file = await ctx.db.file.findFirst({
          where: {
            id,
            ownerId: userId,
            deletedAt: { not: null },
          },
          select: {
            id: true,
            name: true,
            storagePath: true,
          },
        });

        if (!file) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found or not deleted.",
          });
        }

        // Permanently delete from database 
        await ctx.db.file.delete({
          where: {
            id,
            ownerId: userId,
            deletedAt: { not: null }, 
          },
        });

        return {
          success: true,
          message: `File "${file.name}" permanently deleted`,
          fileName: file.name,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to permanently delete file",
        });
      }
    }),
});
