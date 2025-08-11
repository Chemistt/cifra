import { randomBytes } from "node:crypto";

import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import qrcode from "qrcode";
import { z } from "zod";

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

  // Password management
  setPassword: protectedProcedure
    .input(z.object({ 
      password: z.string().min(8, "Password must be at least 8 characters long"),
      confirmPassword: z.string().min(1, "Please confirm your password"),
    }).refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;

      // Hash the password
      const hashedPassword = await bcrypt.hash(input.password, 12);

      // Check if user already has a credential account
      const existingAccount = await ctx.db.account.findFirst({
        where: { 
          userId: user.id, 
          providerId: "credential" 
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
          })
      );

      return { success: true };
    }),

  changePassword: protectedProcedure
    .input(z.object({ 
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z.string().min(8, "Password must be at least 8 characters long"),
      confirmNewPassword: z.string().min(1, "Please confirm your new password"),
    }).refine((data) => data.newPassword === data.confirmNewPassword, {
      message: "New passwords do not match",
      path: ["confirmNewPassword"],
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;

      // Get current credential account
      const credentialAccount = await ctx.db.account.findFirst({
        where: { 
          userId: user.id, 
          providerId: "credential" 
        },
      });

      if (!credentialAccount?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST", 
          message: "No password is currently set",
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(input.currentPassword, credentialAccount.password);
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

  hasPassword: protectedProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx.session;

      const count = await ctx.db.account.count({
        where: { 
          userId: user.id, 
          providerId: "credential",
          password: { not: undefined }
        },
      });

      return { hasPassword: count > 0 };
    }),

  deletePassword: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { user } = ctx.session;

      // Check if user has other authentication methods
      const otherAccounts = await ctx.db.account.findMany({
        where: { 
          userId: user.id, 
          providerId: { not: "credential" }
        },
      });

      if (otherAccounts.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete password without other authentication methods. Please add a social login or passkey first.",
        });
      }

      // Delete the credential account
      await ctx.db.account.deleteMany({
        where: { 
          userId: user.id, 
          providerId: "credential" 
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

  // TOTP management
  hasTotpEnabled: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;

    const count = await ctx.db.twoFactor.count({
      where: {
        userId: user.id,
        secret: { not: undefined },
      },
    });

    return { hasTotpEnabled: count > 0 };
  }),

  generateTotpSetup: protectedProcedure.mutation(async ({ ctx }) => {
    const { user } = ctx.session;

    // Check if user has password set (requirement)
    const hasPassword = await ctx.db.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
        password: { not: undefined },
      },
    });

    if (!hasPassword) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Password must be set before enabling TOTP authentication",
      });
    }

    // Check if user already has TOTP enabled (only one device allowed)
    const existingTotp = await ctx.db.twoFactor.findFirst({
      where: {
        userId: user.id,
        secret: { not: undefined },
      },
    });

    if (existingTotp) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "TOTP is already enabled for this account",
      });
    }

    // Generate secret
    const secret = authenticator.generateSecret();
    
    // Create otpauth URL
    const otpauthUrl = authenticator.keyuri(user.email, "Cifra", secret);

    // Generate QR code
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return {
      secret,
      qrCodeDataUrl,
      manualEntryKey: secret,
      accountName: user.email,
      issuer: "Cifra",
    };
  }),

  enableTotp: protectedProcedure
    .input(z.object({
      secret: z.string().min(1, "Secret is required"),
      totpCode: z.string().length(6, "TOTP code must be 6 digits"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;

      // Verify TOTP code
      const isValid = authenticator.verify({
        token: input.totpCode,
        secret: input.secret,
      });

      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid TOTP code",
        });
      }

      // Save TOTP configuration
      await ctx.db.twoFactor.create({
        data: {
          userId: user.id,
          secret: input.secret,
          backupCodes: [],
        },
      });

      // Enable two-factor for user
      await ctx.db.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true },
      });

      return { success: true };
    }),

  disableTotp: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1, "Password is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;

      // Verify password
      const credentialAccount = await ctx.db.account.findFirst({
        where: {
          userId: user.id,
          providerId: "credential",
        },
      });

      if (!credentialAccount?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password verification required",
        });
      }

      const isValidPassword = await bcrypt.compare(input.currentPassword, credentialAccount.password);
      if (!isValidPassword) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Incorrect password",
        });
      }

      // Delete TOTP device
      await ctx.db.twoFactor.deleteMany({
        where: {
          userId: user.id,
          secret: { not: undefined },
        },
      });

      // Disable two-factor for user
      await ctx.db.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: false },
      });

      return { success: true };
    }),

  // Backup recovery codes
  generateBackupCodes: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1, "Password is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;

      // Verify user has TOTP enabled
      const totpRecord = await ctx.db.twoFactor.findFirst({
        where: {
          userId: user.id,
          secret: { not: undefined },
        },
      });

      if (!totpRecord) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "TOTP must be enabled to generate backup codes",
        });
      }

      // Verify password
      const credentialAccount = await ctx.db.account.findFirst({
        where: {
          userId: user.id,
          providerId: "credential",
        },
      });

      if (!credentialAccount?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password verification required",
        });
      }

      const isValidPassword = await bcrypt.compare(input.currentPassword, credentialAccount.password);
      if (!isValidPassword) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Incorrect password",
        });
      }

      // Generate 10 backup codes (8 characters each)
      const backupCodes: string[] = [];
      for (let index = 0; index < 10; index++) {
        const code = randomBytes(4).toString("hex").toUpperCase();
        backupCodes.push(code);
      }

      // Hash the backup codes before storing
      const hashedBackupCodes = await Promise.all(
        backupCodes.map(async (code) => bcrypt.hash(code, 12))
      );

      // Update TOTP record with new backup codes
      await ctx.db.twoFactor.update({
        where: { id: totpRecord.id },
        data: { backupCodes: hashedBackupCodes },
      });

      return { backupCodes };
    }),

  getBackupCodesStatus: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;

    const totpRecord = await ctx.db.twoFactor.findFirst({
      where: {
        userId: user.id,
        secret: { not: undefined },
      },
      select: {
        backupCodes: true,
      },
    });

    if (!totpRecord) {
      return { hasBackupCodes: false, backupCodesCount: 0 };
    }

    return {
      hasBackupCodes: totpRecord.backupCodes.length > 0,
      backupCodesCount: totpRecord.backupCodes.length,
    };
  }),

  recoverWithBackupCode: protectedProcedure
    .input(z.object({
      backupCode: z.string().min(1, "Backup code is required"),
      newSecret: z.string().min(1, "New secret is required"),
      totpCode: z.string().length(6, "TOTP code must be 6 digits"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;

      // Find TOTP record
      const totpRecord = await ctx.db.twoFactor.findFirst({
        where: {
          userId: user.id,
          secret: { not: undefined },
        },
      });

      if (!totpRecord) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No TOTP configuration found",
        });
      }

      // Verify backup code
      let validBackupCode = false;
      let usedCodeIndex = -1;

      for (let index = 0; index < totpRecord.backupCodes.length; index++) {
        const hashToCheck = totpRecord.backupCodes[index];
        if (hashToCheck) {
          const isValid = await bcrypt.compare(input.backupCode, hashToCheck);
          if (isValid) {
            validBackupCode = true;
            usedCodeIndex = index;
            break;
          }
        }
      }

      if (!validBackupCode) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid backup code",
        });
      }

      // Verify new TOTP code
      const isValidTotp = authenticator.verify({
        token: input.totpCode,
        secret: input.newSecret,
      });

      if (!isValidTotp) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid TOTP code for new device",
        });
      }

      // Remove used backup code and update with new secret
      const updatedBackupCodes = [...totpRecord.backupCodes];
      updatedBackupCodes.splice(usedCodeIndex, 1);

      await ctx.db.twoFactor.update({
        where: { id: totpRecord.id },
        data: {
          secret: input.newSecret,
          backupCodes: updatedBackupCodes,
        },
      });

      return { success: true, remainingBackupCodes: updatedBackupCodes.length };
    }),

  generateReplaceDeviceSetup: protectedProcedure.mutation(async ({ ctx }) => {
    const { user } = ctx.session;

    // Check if user has TOTP enabled (requirement for replacement)
    const existingTotp = await ctx.db.twoFactor.findFirst({
      where: {
        userId: user.id,
        secret: { not: undefined },
      },
    });

    if (!existingTotp) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "TOTP must be enabled before you can replace a device",
      });
    }

    // Generate new secret for replacement device
    const secret = authenticator.generateSecret();
    
    // Generate QR code and manual entry data
    const accountName = user.email || user.name || "User";
    const serviceName = "Cifra";
    const otpAuthUrl = authenticator.keyuri(accountName, serviceName, secret);
    
    const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);
    
    return {
      secret,
      qrCodeDataUrl,
      manualEntryKey: secret,
      accountName,
      issuer: serviceName,
    };
  }),
});
