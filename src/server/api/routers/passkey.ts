import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const passkeyRouter = createTRPCRouter({
  getPasskeys: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;

    const passkeys = await ctx.db.passkey.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return passkeys;
  }),

  updatePasskeyName: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, name } = input;
      const { user } = ctx.session;

      const passkey = await ctx.db.passkey.update({
        where: { id, userId: user.id },
        data: { name: name.trim() },
      });

      return passkey;
    }),

  deletePasskey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const { user } = ctx.session;

      await ctx.db.passkey.delete({
        where: { id, userId: user.id },
      });
    }),
});
