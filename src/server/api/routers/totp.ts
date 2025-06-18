import { z } from "zod/v4";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const totpRouter = createTRPCRouter({
  getTotp: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;

    const totp = await ctx.db.twoFactor.findMany({
      where: {
        userId: user.id,
      },
    });

    return totp;
  }),

  deletePasskey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const { user } = ctx.session;

      await ctx.db.twoFactor.delete({
        where: { id, userId: user.id },
      });
    }),
});
