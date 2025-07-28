import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const profileRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;

    const profile = await ctx.db.user.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return profile;
  }),
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        image: z.string().url("Invalid URL").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;

      const updatedProfile = await ctx.db.user.update({
        where: { id: user.id },
        data: {
          name: input.name.trim(),
          image: input.image?.trim(),
        },
      });

      return updatedProfile;
    }),
});