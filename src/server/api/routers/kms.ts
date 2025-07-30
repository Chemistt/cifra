import {
  CreateAliasCommand,
  CreateKeyCommand,
  DecryptCommand,
  DeleteAliasCommand,
  EncryptCommand,
  KeySpec,
  KeyUsageType,
  KMSClient,
  OriginType,
  ScheduleKeyDeletionCommand,
  UpdateKeyDescriptionCommand,
} from "@aws-sdk/client-kms";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const client = new KMSClient({ region: "ap-southeast-1" });

export const kmsRouter = createTRPCRouter({
  getKeys: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session;
    const keys = await ctx.db.userKey.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return keys;
  }),

  createKey: protectedProcedure
    .input(
      z.object({
        alias: z.string().min(1).max(256),
        description: z.string().max(8192).optional(),
        isPrimary: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { alias, description, isPrimary } = input;

      try {
        // If this is set as primary, unset other primary keys
        if (isPrimary) {
          await ctx.db.userKey.updateMany({
            where: {
              userId: user.id,
              isPrimary: true,
            },
            data: {
              isPrimary: false,
            },
          });
        }

        // Create the key in AWS KMS
        const createKeyCommand = new CreateKeyCommand({
          KeyUsage: KeyUsageType.ENCRYPT_DECRYPT,
          KeySpec: KeySpec.SYMMETRIC_DEFAULT,
          Origin: OriginType.AWS_KMS,
          Description: description ?? `Key for user ${user.email}`,
          Tags: [
            {
              TagKey: "Owner",
              TagValue: user.email,
            },
            {
              TagKey: "CreatedBy",
              TagValue: "cifra-app",
            },
          ],
        });

        const createKeyResponse = await client.send(createKeyCommand);

        if (!createKeyResponse.KeyMetadata?.KeyId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create key in AWS KMS",
          });
        }

        const keyId = createKeyResponse.KeyMetadata.KeyId;

        // Create alias for the key
        const aliasName = `alias/${user.id}-${alias}`;
        const createAliasCommand = new CreateAliasCommand({
          AliasName: aliasName,
          TargetKeyId: keyId,
        });

        await client.send(createAliasCommand);

        // Store the key reference in the database
        const userKey = await ctx.db.userKey.create({
          data: {
            alias,
            description,
            isPrimary,
            keyIdentifierInKMS: keyId,
            userId: user.id,
          },
        });

        return userKey;
      } catch (error) {
        console.error("Error creating key:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create key. Please try again.",
        });
      }
    }),

  updateKey: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        alias: z.string().min(1).max(256).optional(),
        description: z.string().max(8192).optional(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { id, alias, description, isPrimary } = input;

      try {
        // Verify the key belongs to the user
        const existingKey = await ctx.db.userKey.findFirst({
          where: {
            id,
            userId: user.id,
          },
        });

        if (!existingKey) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Key not found",
          });
        }

        // If this is set as primary, unset other primary keys
        if (isPrimary) {
          await ctx.db.userKey.updateMany({
            where: {
              userId: user.id,
              isPrimary: true,
              id: { not: id },
            },
            data: {
              isPrimary: false,
            },
          });
        }

        // Update description in AWS KMS if provided
        if (description !== undefined) {
          const updateDescriptionCommand = new UpdateKeyDescriptionCommand({
            KeyId: existingKey.keyIdentifierInKMS,
            Description: description,
          });
          await client.send(updateDescriptionCommand);
        }

        // Update alias in AWS KMS if provided
        if (alias && alias !== existingKey.alias) {
          const oldAliasName = `alias/${user.id}-${existingKey.alias}`;
          const newAliasName = `alias/${user.id}-${alias}`;

          // Delete old alias
          const deleteAliasCommand = new DeleteAliasCommand({
            AliasName: oldAliasName,
          });
          await client.send(deleteAliasCommand);

          // Create new alias
          const createAliasCommand = new CreateAliasCommand({
            AliasName: newAliasName,
            TargetKeyId: existingKey.keyIdentifierInKMS,
          });
          await client.send(createAliasCommand);
        }

        // Update the key in the database
        const updatedKey = await ctx.db.userKey.update({
          where: { id },
          data: {
            ...(alias && { alias }),
            ...(description !== undefined && { description }),
            ...(isPrimary !== undefined && { isPrimary }),
          },
        });

        return updatedKey;
      } catch (error) {
        console.error("Error updating key:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update key. Please try again.",
        });
      }
    }),

  deleteKey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { id } = input;

      try {
        // Verify the key belongs to the user
        const existingKey = await ctx.db.userKey.findFirst({
          where: {
            id,
            userId: user.id,
          },
        });

        if (!existingKey) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Key not found",
          });
        }

        // Check if the key is being used by any encrypted DEKs
        const deksUsingKey = await ctx.db.encryptedDEK.findFirst({
          where: {
            kekIdUsed: id,
          },
        });

        if (deksUsingKey) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Cannot delete key that is currently being used to encrypt files",
          });
        }

        // Delete alias from AWS KMS
        const aliasName = `alias/${user.id}-${existingKey.alias}`;
        const deleteAliasCommand = new DeleteAliasCommand({
          AliasName: aliasName,
        });
        await client.send(deleteAliasCommand);

        // Schedule key deletion in AWS KMS (7 days by default)
        const scheduleKeyDeletionCommand = new ScheduleKeyDeletionCommand({
          KeyId: existingKey.keyIdentifierInKMS,
          PendingWindowInDays: 7,
        });
        await client.send(scheduleKeyDeletionCommand);

        // Remove the key from the database
        await ctx.db.userKey.delete({
          where: { id },
        });

        return { success: true };
      } catch (error) {
        console.error("Error deleting key:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete key. Please try again.",
        });
      }
    }),

  getKeyUsage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { id } = input;

      // Verify the key belongs to the user
      const existingKey = await ctx.db.userKey.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Key not found",
        });
      }

      // Get usage statistics
      const [totalFiles, totalDEKs] = await Promise.all([
        ctx.db.file.count({
          where: {
            encryptedDeks: {
              some: {
                kekIdUsed: id,
              },
            },
          },
        }),
        ctx.db.encryptedDEK.count({
          where: {
            kekIdUsed: id,
          },
        }),
      ]);

      return {
        totalFiles,
        totalDEKs,
        key: existingKey,
      };
    }),

  encryptDEK: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;

      try {
        // If no kekId provided, use the primary key
        const keyToUse = await ctx.db.userKey.findFirst({
          where: {
            userId: user.id,
            isPrimary: true,
          },
        });

        if (!keyToUse) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No primary key found. Please create a key first.",
          });
        }

        // Convert base64 DEK to buffer for encryption
        const dekBuffer = Buffer.from(input, "base64");

        // Encrypt the DEK using AWS KMS
        const encryptCommand = new EncryptCommand({
          KeyId: keyToUse.keyIdentifierInKMS,
          Plaintext: dekBuffer,
        });

        const encryptResponse = await client.send(encryptCommand);

        if (!encryptResponse.CiphertextBlob) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to encrypt DEK",
          });
        }

        // Convert encrypted DEK to base64 for transport over tRPC
        const encryptedDEKBuffer = Buffer.from(encryptResponse.CiphertextBlob);
        const encryptedDEKBase64 = encryptedDEKBuffer.toString("base64");

        return {
          encryptedDEK: encryptedDEKBase64,
          keyId: keyToUse.id,
          keyIdentifierInKMS: keyToUse.keyIdentifierInKMS,
        };
      } catch (error) {
        console.error("Error encrypting DEK:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to encrypt DEK. Please try again.",
        });
      }
    }),

  decryptDEK: protectedProcedure
    .input(
      z.object({
        encryptedDEKBase64: z.string(),
        keyId: z.string(), // ID of the UserKey used to encrypt the DEK
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { encryptedDEKBase64, keyId } = input;

      try {
        // Verify the key belongs to the user
        const userKey = await ctx.db.userKey.findFirst({
          where: {
            id: keyId,
            userId: user.id,
          },
        });

        if (!userKey) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Encryption key not found",
          });
        }

        // Convert base64 encrypted DEK to buffer for decryption
        const encryptedDEKBuffer = Buffer.from(encryptedDEKBase64, "base64");

        // Decrypt the DEK using AWS KMS
        const decryptCommand = new DecryptCommand({
          CiphertextBlob: encryptedDEKBuffer,
          KeyId: userKey.keyIdentifierInKMS,
        });

        const decryptResponse = await client.send(decryptCommand);

        if (!decryptResponse.Plaintext) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to decrypt DEK",
          });
        }

        // Convert decrypted DEK to base64 for transport
        const dekBuffer = Buffer.from(decryptResponse.Plaintext);
        const dekBase64 = dekBuffer.toString("base64");

        return {
          dekBase64,
          keyId: userKey.id,
        };
      } catch (error) {
        console.error("Error decrypting DEK:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to decrypt DEK. Please try again.",
        });
      }
    }),
});
