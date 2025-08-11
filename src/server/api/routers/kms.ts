/* eslint-disable unicorn/no-null */
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
import { AuditAction } from "@prisma/client";
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
        expiryOption: z.enum(["30", "60", "120", "never"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { alias, description, isPrimary, expiryOption } = input;

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

        // Compute expiresAt from expiryOption
        let expiresAt: Date | undefined;
        const now = new Date();
        switch (expiryOption) {
          case "30": {
            expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
          }
          case "60": {
            expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
            break;
          }
          case "120": {
            expiresAt = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
            break;
          }
          default: {
            // "never" or undefined => no expiry
            expiresAt = undefined;
            break;
          }
        }

        // Store the key reference in the database
        const userKey = await ctx.db.userKey.create({
          data: {
            alias,
            description,
            isPrimary,
            ...(expiresAt ? { expiresAt } : {}),
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

  // DEK rewrapping for file sharing - decrypt with sender's KEK and re-encrypt with recipient's KEK
  rewrapDEKForRecipient: protectedProcedure
    .input(
      z.object({
        fileId: z.string(),
        recipientUserId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { fileId, recipientUserId } = input;

      try {
        // Get the file and verify ownership
        const file = await ctx.db.file.findFirst({
          where: {
            id: fileId,
            ownerId: user.id,
            deletedAt: null,
          },
          include: {
            encryptedDeks: {
              where: {
                kekUsed: {
                  userId: user.id, // Get the owner's encrypted DEK
                },
              },
            },
          },
        });

        if (!file) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found or you don't have permission",
          });
        }

        if (file.encryptedDeks.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File is not encrypted",
          });
        }

        // Get the file owner's encrypted DEK
        const ownerEncryptedDEK = file.encryptedDeks[0];
        if (!ownerEncryptedDEK) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No encrypted DEK found for file owner",
          });
        }

        // Get the owner's KEK for decryption
        if (!ownerEncryptedDEK.kekIdUsed) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No KEK ID found for encrypted DEK",
          });
        }

        const ownerKey = await ctx.db.userKey.findFirst({
          where: {
            id: ownerEncryptedDEK.kekIdUsed,
            userId: user.id,
          },
        });

        if (!ownerKey) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Owner's encryption key not found",
          });
        }

        // Get the recipient's primary KEK for encryption
        const recipientKey = await ctx.db.userKey.findFirst({
          where: {
            userId: recipientUserId,
            isPrimary: true,
          },
        });

        if (!recipientKey) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recipient's primary encryption key not found",
          });
        }

        // Check if recipient already has access to this file
        const existingRecipientDEK = await ctx.db.encryptedDEK.findFirst({
          where: {
            fileId: fileId,
            kekUsed: {
              userId: recipientUserId,
            },
          },
        });

        if (existingRecipientDEK) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Recipient already has access to this file",
          });
        }

        // Step 1: Decrypt the DEK using owner's KEK
        const encryptedDEKBuffer = Buffer.from(ownerEncryptedDEK.dekCiphertext);
        const decryptCommand = new DecryptCommand({
          CiphertextBlob: encryptedDEKBuffer,
          KeyId: ownerKey.keyIdentifierInKMS,
        });

        const decryptResponse = await client.send(decryptCommand);

        if (!decryptResponse.Plaintext) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to decrypt DEK",
          });
        }

        // Step 2: Re-encrypt the DEK using recipient's KEK
        const dekBuffer = Buffer.from(decryptResponse.Plaintext);
        const encryptCommand = new EncryptCommand({
          KeyId: recipientKey.keyIdentifierInKMS,
          Plaintext: dekBuffer,
        });

        const encryptResponse = await client.send(encryptCommand);

        if (!encryptResponse.CiphertextBlob) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to re-encrypt DEK for recipient",
          });
        }

        // Step 3: Store the recipient's encrypted DEK
        const recipientEncryptedDEKBuffer = Buffer.from(
          encryptResponse.CiphertextBlob,
        );

        const newEncryptedDEK = await ctx.db.encryptedDEK.create({
          data: {
            dekCiphertext: recipientEncryptedDEKBuffer,
            iv: ownerEncryptedDEK.iv, // Same IV as owner since it's the same file
            kekIdUsed: recipientKey.id,
            fileId: fileId,
          },
        });

        return {
          success: true,
          recipientEncryptedDEKId: newEncryptedDEK.id,
          recipientKeyId: recipientKey.id,
        };
      } catch (error) {
        console.error("Error rewrapping DEK:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to share file encryption key. Please try again.",
        });
      }
    }),

  // Batch DEK rewrapping for multiple recipients
  rewrapDEKForMultipleRecipients: protectedProcedure
    .input(
      z.object({
        fileId: z.string(),
        recipientUserIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { fileId, recipientUserIds } = input;

      const results: {
        recipientUserId: string;
        success: boolean;
        error?: string;
      }[] = [];

      for (const recipientUserId of recipientUserIds) {
        try {
          // Use the same logic as the single recipient function
          // Get the file and verify ownership
          const file = await ctx.db.file.findFirst({
            where: {
              id: fileId,
              ownerId: user.id,
              deletedAt: null,
            },
            include: {
              encryptedDeks: {
                where: {
                  kekUsed: {
                    userId: user.id, // Get the owner's encrypted DEK
                  },
                },
              },
            },
          });

          if (!file || file.encryptedDeks.length === 0) {
            throw new Error("File not found or not encrypted");
          }

          const ownerEncryptedDEK = file.encryptedDeks[0];
          if (!ownerEncryptedDEK) {
            throw new Error("No encrypted DEK found for file owner");
          }

          // Check if recipient already has access
          const existingRecipientDEK = await ctx.db.encryptedDEK.findFirst({
            where: {
              fileId: fileId,
              kekUsed: {
                userId: recipientUserId,
              },
            },
          });

          if (existingRecipientDEK) {
            throw new Error("Recipient already has access to this file");
          }

          // Get keys
          if (!ownerEncryptedDEK.kekIdUsed) {
            throw new Error("No KEK ID found for encrypted DEK");
          }

          const [ownerKey, recipientKey] = await Promise.all([
            ctx.db.userKey.findFirst({
              where: {
                id: ownerEncryptedDEK.kekIdUsed,
                userId: user.id,
              },
            }),
            ctx.db.userKey.findFirst({
              where: {
                userId: recipientUserId,
                isPrimary: true,
              },
            }),
          ]);

          if (!ownerKey || !recipientKey) {
            throw new Error("Encryption keys not found");
          }

          // Decrypt and re-encrypt DEK
          const encryptedDEKBuffer = Buffer.from(
            ownerEncryptedDEK.dekCiphertext,
          );
          const decryptCommand = new DecryptCommand({
            CiphertextBlob: encryptedDEKBuffer,
            KeyId: ownerKey.keyIdentifierInKMS,
          });

          const decryptResponse = await client.send(decryptCommand);

          if (!decryptResponse.Plaintext) {
            throw new Error("Failed to decrypt DEK");
          }

          const dekBuffer = Buffer.from(decryptResponse.Plaintext);
          const encryptCommand = new EncryptCommand({
            KeyId: recipientKey.keyIdentifierInKMS,
            Plaintext: dekBuffer,
          });

          const encryptResponse = await client.send(encryptCommand);

          if (!encryptResponse.CiphertextBlob) {
            throw new Error("Failed to re-encrypt DEK for recipient");
          }

          // Store the recipient's encrypted DEK
          const recipientEncryptedDEKBuffer = Buffer.from(
            encryptResponse.CiphertextBlob,
          );

          await ctx.db.encryptedDEK.create({
            data: {
              dekCiphertext: recipientEncryptedDEKBuffer,
              iv: ownerEncryptedDEK.iv,
              kekIdUsed: recipientKey.id,
              fileId: fileId,
            },
          });

          results.push({ recipientUserId, success: true });
        } catch (error) {
          results.push({
            recipientUserId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        results,
        totalRecipients: recipientUserIds.length,
        successfulShares: results.filter((r) => r.success).length,
        failedShares: results.filter((r) => !r.success).length,
      };
    }),

  // Rotate owner's DEKs from one KEK to another KEK
  rotateDEKsToKey: protectedProcedure
    .input(
      z.object({
        fromKeyId: z.string(),
        toKeyId: z.string(),
        makePrimary: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { fromKeyId, toKeyId, makePrimary } = input;

      if (fromKeyId === toKeyId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Source and target keys must be different",
        });
      }

      try {
        // Verify keys belong to the user
        const [fromKey, toKey] = await Promise.all([
          ctx.db.userKey.findFirst({
            where: { id: fromKeyId, userId: user.id },
          }),
          ctx.db.userKey.findFirst({ where: { id: toKeyId, userId: user.id } }),
        ]);

        if (!fromKey || !toKey) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "One or both keys were not found",
          });
        }

        // Fetch all owner's encrypted DEKs that currently use fromKey
        const encryptedDeks = await ctx.db.encryptedDEK.findMany({
          where: {
            kekIdUsed: fromKeyId,
            file: {
              ownerId: user.id,
              deletedAt: null,
            },
          },
          select: {
            id: true,
            fileId: true,
            dekCiphertext: true,
            iv: true,
          },
        });

        let successCount = 0;
        const failures: { fileId: string; error: string }[] = [];

        for (const enc of encryptedDeks) {
          try {
            // Decrypt with fromKey
            const decryptCmd = new DecryptCommand({
              CiphertextBlob: Buffer.from(enc.dekCiphertext),
              KeyId: fromKey.keyIdentifierInKMS,
            });
            const decryptResp = await client.send(decryptCmd);
            if (!decryptResp.Plaintext) {
              throw new Error("KMS did not return plaintext");
            }

            // Re-encrypt with toKey
            const encryptCmd = new EncryptCommand({
              KeyId: toKey.keyIdentifierInKMS,
              Plaintext: Buffer.from(decryptResp.Plaintext),
            });
            const encryptResp = await client.send(encryptCmd);
            if (!encryptResp.CiphertextBlob) {
              throw new Error("KMS did not return ciphertext");
            }

            const newCipher = Buffer.from(encryptResp.CiphertextBlob);

            // Upsert recipient encrypted DEK for the same file under toKey
            await ctx.db.encryptedDEK.upsert({
              where: {
                fileId_kekIdUsed: { fileId: enc.fileId, kekIdUsed: toKey.id },
              },
              update: {
                dekCiphertext: newCipher,
                iv: enc.iv,
              },
              create: {
                fileId: enc.fileId,
                kekIdUsed: toKey.id,
                dekCiphertext: newCipher,
                iv: enc.iv,
              },
            });

            // Remove old encrypted DEK under fromKey
            await ctx.db.encryptedDEK.delete({ where: { id: enc.id } });

            successCount += 1;
          } catch (error) {
            failures.push({
              fileId: enc.fileId,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        // Optionally make target key primary
        if (makePrimary) {
          await ctx.db.$transaction([
            ctx.db.userKey.updateMany({
              where: { userId: user.id, isPrimary: true },
              data: { isPrimary: false },
            }),
            ctx.db.userKey.update({
              where: { id: toKey.id },
              data: { isPrimary: true },
            }),
          ]);
        }

        // Mark rotation on fromKey
        await ctx.db.userKey.update({
          where: { id: fromKey.id },
          data: { rotatedAt: new Date() },
        });

        // Audit log
        await ctx.db.auditLog.create({
          data: {
            action: AuditAction.USER_KEY_ROTATED,
            targetType: "UserKey",
            targetId: fromKey.id,
            actorId: user.id,
            details: {
              fromKeyId,
              toKeyId,
              rewrappedCount: successCount,
              failureCount: failures.length,
            },
          },
        });

        return {
          totalToRewrap: encryptedDeks.length,
          rewrapped: successCount,
          failed: failures.length,
          failures,
        };
      } catch (error) {
        console.error("Error rotating DEKs:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to rotate keys. Please try again.",
        });
      }
    }),
});
