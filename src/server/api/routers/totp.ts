import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { auth } from "@/server/auth";

export const totpRouter = createTRPCRouter({
  setPassword: protectedProcedure
    .input(
      z
        .object({
          password: z
            .string()
            .min(8, "Password must be at least 8 characters long"),
          confirmPassword: z.string().min(1, "Please confirm your password"),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;

      // Hash the password
      const hashedPassword = await bcrypt.hash(input.password, 12);

      // Check if user already has a credential account
      const existingAccount = await ctx.db.account.findFirst({
        where: {
          userId: user.id,
          providerId: "credential",
        },
      });

      // Update or create credential account
      await (existingAccount
        ? ctx.db.account.update({
            where: { id: existingAccount.id },
            data: { password: hashedPassword },
          })
        : ctx.db.account.create({
            data: {
              userId: user.id,
              accountId: user.email,
              providerId: "credential",
              password: hashedPassword,
            },
          }));

      return { success: true };
    }),
  changePassword: protectedProcedure
    .input(
      z
        .object({
          currentPassword: z.string().min(1, "Current password is required"),
          newPassword: z
            .string()
            .min(8, "Password must be at least 8 characters long"),
          confirmNewPassword: z
            .string()
            .min(1, "Please confirm your new password"),
        })
        .refine((data) => data.newPassword === data.confirmNewPassword, {
          message: "New passwords do not match",
          path: ["confirmNewPassword"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;

      // Get current credential account
      const credentialAccount = await ctx.db.account.findFirst({
        where: {
          userId: user.id,
          providerId: "credential",
        },
      });

      if (!credentialAccount?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No password is currently set",
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        input.currentPassword,
        credentialAccount.password,
      );
      if (!isValidPassword) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Incorrect current password",
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(input.newPassword, 12);

      // Update password
      await ctx.db.account.update({
        where: { id: credentialAccount.id },
        data: { password: hashedPassword },
      });

      return { success: true };
    }),
  hasPassword: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;

    const count = await ctx.db.account.count({
      where: {
        userId: user.id,
        providerId: "credential",
        password: { not: undefined },
      },
    });

    return { hasPassword: count > 0 };
  }),
  deletePassword: protectedProcedure.mutation(async ({ ctx }) => {
    const { user } = ctx.session;

    // Check if user has other authentication methods
    const otherAccounts = await ctx.db.account.findMany({
      where: {
        userId: user.id,
        providerId: { not: "credential" },
      },
    });

    if (otherAccounts.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Cannot delete password without other authentication methods. Please add a social login or passkey first.",
      });
    }

    // Delete the credential account
    await ctx.db.account.deleteMany({
      where: {
        userId: user.id,
        providerId: "credential",
      },
    });

    // Also delete TOTP since password is required for TOTP setup
    await ctx.db.twoFactor.deleteMany({
      where: {
        userId: user.id,
        secret: { not: undefined },
      },
    });

    return { success: true };
  }),
  getTotp: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;

    try {
      const totp = await ctx.db.twoFactor.findMany({
        where: {
          userId: user.id,
        },
      });

      return totp;
    } catch (error) {
      console.error("Error fetching TOTP records:", error);
      return [];
    }
  }),
  hasTotpEnabled: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;

    try {
      const count = await ctx.db.twoFactor.count({
        where: {
          userId: user.id,
          secret: { not: undefined },
        },
      });

      return { hasTotpEnabled: count > 0 };
    } catch (error) {
      console.error("Error checking TOTP status:", error);
      return { hasTotpEnabled: false };
    }
  }),
  getBackupCodesStatus: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;

    try {
      const codes = await auth.api.viewBackupCodes({
        body: {
          userId: user.id,
        },
      });

      return {
        hasBackupCodes: Boolean(codes.status),
        backupCodesCount:
          codes.status && codes.backupCodes ? codes.backupCodes.length : 0,
      };
    } catch (error) {
      console.error("Error checking backup codes status:", error);
      return {
        hasBackupCodes: false,
        backupCodesCount: 0,
      };
    }
  }),
  getBackupCodes: protectedProcedure.mutation(async ({ ctx }) => {
    const { user } = ctx.session;

    try {
      const codes = await auth.api.viewBackupCodes({
        body: {
          userId: user.id,
        },
      });

      if (!codes.status) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Backup codes not found",
        });
      }

      return codes;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      console.error("Error fetching backup codes:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch backup codes",
      });
    }
  }),
});
