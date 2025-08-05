/* eslint-disable unicorn/no-null */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const sharingRouter = createTRPCRouter({
  // Create a new share group for files
  createShareGroup: protectedProcedure
    .input(
      z.object({
        fileIds: z.array(z.string()),
        recipientEmails: z.array(z.email()),
        permissionLevel: z.enum(["VIEW", "DOWNLOAD", "EDIT"]),
        expiresAt: z.date().optional(),
        password: z.string().optional(),
        maxDownloads: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const {
        fileIds,
        recipientEmails,
        permissionLevel,
        expiresAt,
        password,
        maxDownloads,
      } = input;

      try {
        // Verify all files belong to the user
        const files = await ctx.db.file.findMany({
          where: {
            id: { in: fileIds },
            ownerId: user.id,
            deletedAt: null,
          },
          include: {
            encryptedDeks: {
              where: {
                kekUsed: {
                  userId: user.id,
                },
              },
            },
          },
        });

        if (files.length !== fileIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "One or more files not found or you don't have permission",
          });
        }

        // Check if all files are encrypted
        const unencryptedFiles = files.filter(
          (file) => file.encryptedDeks.length === 0,
        );
        if (unencryptedFiles.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Files must be encrypted to share: ${unencryptedFiles
              .map((f) => f.name)
              .join(", ")}`,
          });
        }

        // Find recipient users by email
        const recipients = await ctx.db.user.findMany({
          where: {
            email: { in: recipientEmails },
          },
          include: {
            userKeys: {
              where: {
                isPrimary: true,
              },
            },
          },
        });

        const foundEmails = new Set(recipients.map((r) => r.email));
        const notFoundEmails = recipientEmails.filter(
          (email) => !foundEmails.has(email),
        );

        if (notFoundEmails.length > 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Recipients not found: ${notFoundEmails.join(", ")}`,
          });
        }

        // Check if all recipients have primary keys
        const recipientsWithoutKeys = recipients.filter(
          (r) => r.userKeys.length === 0,
        );
        if (recipientsWithoutKeys.length > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Recipients must have encryption keys set up: ${recipientsWithoutKeys
              .map((r) => r.email)
              .join(", ")}`,
          });
        }

        // Generate link token
        const linkToken = `share_${String(Date.now())}_${Math.random()
          .toString(36)
          .slice(2, 15)}`;

        // Hash password if provided
        let passwordHash: string | undefined;
        if (password) {
          const bcrypt = await import("bcryptjs");
          passwordHash = await bcrypt.hash(password, 12);
        }

        // Create share group in a transaction
        const result = await ctx.db.$transaction(async (tx) => {
          // Create the share group
          const shareGroup = await tx.shareGroup.create({
            data: {
              permissionLevel,
              linkToken,
              passwordHash,
              maxDownloads,
              expiresAt,
              ownerId: user.id,
              sharedUsers: {
                connect: recipients.map((r) => ({ id: r.id })),
              },
            },
          });

          // Create shared file records
          const sharedFiles = await Promise.all(
            fileIds.map((fileId) =>
              tx.sharedFile.create({
                data: {
                  shareGroupId: shareGroup.id,
                  fileId,
                  sharedById: user.id,
                },
              }),
            ),
          );

          return { shareGroup, sharedFiles };
        });

        // Rewrap DEKs for all recipients for all files
        const rewrapResults: {
          fileId: string;
          recipientUserId: string;
          success: boolean;
          error?: string;
        }[] = [];

        // Use the same DEK rewrapping logic as in KMS router
        for (const file of files) {
          for (const recipient of recipients) {
            try {
              // Get the file owner's encrypted DEK
              const ownerEncryptedDEK = file.encryptedDeks[0];
              if (!ownerEncryptedDEK?.kekIdUsed) {
                throw new Error("No encrypted DEK found for file");
              }

              // Get recipient's primary key
              const recipientKey = recipient.userKeys[0];
              if (!recipientKey) {
                throw new Error("Recipient has no primary key");
              }

              // Check if recipient already has access
              const existingRecipientDEK = await ctx.db.encryptedDEK.findFirst({
                where: {
                  fileId: file.id,
                  kekUsed: {
                    userId: recipient.id,
                  },
                },
              });

              if (existingRecipientDEK) {
                throw new Error("Recipient already has access to this file");
              }

              // Get owner's key for decryption
              const ownerKey = await ctx.db.userKey.findFirst({
                where: {
                  id: ownerEncryptedDEK.kekIdUsed,
                  userId: user.id,
                },
              });

              if (!ownerKey) {
                throw new Error("Owner's encryption key not found");
              }

              // Decrypt and re-encrypt DEK (import AWS KMS client)
              const { DecryptCommand, EncryptCommand, KMSClient } =
                await import("@aws-sdk/client-kms");
              const client = new KMSClient({ region: "ap-southeast-1" });

              // Step 1: Decrypt DEK with owner's KEK
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

              // Step 2: Re-encrypt with recipient's KEK
              const dekBuffer = Buffer.from(decryptResponse.Plaintext);
              const encryptCommand = new EncryptCommand({
                KeyId: recipientKey.keyIdentifierInKMS,
                Plaintext: dekBuffer,
              });

              const encryptResponse = await client.send(encryptCommand);
              if (!encryptResponse.CiphertextBlob) {
                throw new Error("Failed to re-encrypt DEK for recipient");
              }

              // Step 3: Store recipient's encrypted DEK
              const recipientEncryptedDEKBuffer = Buffer.from(
                encryptResponse.CiphertextBlob,
              );

              await ctx.db.encryptedDEK.create({
                data: {
                  dekCiphertext: recipientEncryptedDEKBuffer,
                  iv: ownerEncryptedDEK.iv,
                  kekIdUsed: recipientKey.id,
                  fileId: file.id,
                },
              });

              rewrapResults.push({
                fileId: file.id,
                recipientUserId: recipient.id,
                success: true,
              });
            } catch (error) {
              rewrapResults.push({
                fileId: file.id,
                recipientUserId: recipient.id,
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }
        }

        // Log audit event
        await ctx.db.auditLog.create({
          data: {
            action: "FILE_SHARE",
            targetType: "ShareGroup",
            targetId: result.shareGroup.id,
            details: {
              fileCount: fileIds.length,
              recipientCount: recipients.length,
              permissionLevel,
              hasPassword: !!password,
              expiresAt,
            },
            actorId: user.id,
          },
        });

        return {
          shareGroup: result.shareGroup,
          sharedFiles: result.sharedFiles,
          rewrapResults,
          linkToken,
          successfulShares: rewrapResults.filter((r) => r.success).length,
          failedShares: rewrapResults.filter((r) => !r.success).length,
        };
      } catch (error) {
        console.error("Error creating share group:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create share group. Please try again.",
        });
      }
    }),

  // Get shares created by the current user
  getMyShares: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { limit = 50, offset = 0 } = input ?? {};

      const shares = await ctx.db.shareGroup.findMany({
        where: {
          ownerId: user.id,
        },
        include: {
          sharedFiles: {
            include: {
              file: {
                select: {
                  id: true,
                  name: true,
                  mimeType: true,
                  size: true,
                  createdAt: true,
                },
              },
            },
          },
          sharedUsers: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      });

      return shares;
    }),

  // Get files shared with the current user
  getSharedWithMe: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { limit = 50, offset = 0 } = input ?? {};

      const shareGroups = await ctx.db.shareGroup.findMany({
        where: {
          sharedUsers: {
            some: {
              id: user.id,
            },
          },
          // Only include non-expired shares
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          sharedFiles: {
            include: {
              file: {
                select: {
                  id: true,
                  name: true,
                  mimeType: true,
                  size: true,
                  createdAt: true,
                  storagePath: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      });

      return shareGroups;
    }),

  // Get share group details by link token
  getShareByToken: protectedProcedure
    .input(
      z.object({
        linkToken: z.string(),
        password: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { linkToken, password } = input;

      const shareGroup = await ctx.db.shareGroup.findFirst({
        where: {
          linkToken,
          // Check if not expired
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          sharedUsers: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          sharedFiles: {
            include: {
              file: {
                select: {
                  id: true,
                  name: true,
                  mimeType: true,
                  size: true,
                  createdAt: true,
                  storagePath: true,
                },
              },
            },
          },
        },
      });

      if (!shareGroup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share not found or expired",
        });
      }

      // Check if user has access (is owner or in shared users)
      const hasAccess =
        shareGroup.ownerId === user.id ||
        shareGroup.sharedUsers.some((u) => u.id === user.id);

      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this share",
        });
      }

      // Check password if required
      if (shareGroup.passwordHash && password) {
        const bcrypt = await import("bcryptjs");
        const isValidPassword = await bcrypt.compare(
          password,
          shareGroup.passwordHash,
        );
        if (!isValidPassword) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid password",
          });
        }
      } else if (shareGroup.passwordHash && !password) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Password required",
        });
      }

      // Check download limit
      if (
        shareGroup.maxDownloads &&
        shareGroup.downloadCount >= shareGroup.maxDownloads
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Download limit exceeded",
        });
      }

      return shareGroup;
    }),

  // Revoke a share group
  revokeShare: protectedProcedure
    .input(z.object({ shareGroupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { shareGroupId } = input;

      const shareGroup = await ctx.db.shareGroup.findFirst({
        where: {
          id: shareGroupId,
          ownerId: user.id,
        },
      });

      if (!shareGroup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share not found or you don't have permission",
        });
      }

      // Delete the share group (cascade will handle shared files and encrypted DEKs)
      await ctx.db.shareGroup.delete({
        where: {
          id: shareGroupId,
        },
      });

      // Log audit event
      await ctx.db.auditLog.create({
        data: {
          action: "LINK_REVOKE",
          targetType: "ShareGroup",
          targetId: shareGroupId,
          actorId: user.id,
        },
      });

      return { success: true };
    }),

  // Remove a specific file from a share group
  removeFileFromShare: protectedProcedure
    .input(
      z.object({
        shareGroupId: z.string(),
        fileId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx.session;
      const { shareGroupId, fileId } = input;

      // Verify ownership of the share group
      const shareGroup = await ctx.db.shareGroup.findFirst({
        where: {
          id: shareGroupId,
          ownerId: user.id,
        },
        include: {
          sharedUsers: true,
        },
      });

      if (!shareGroup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share not found or you don't have permission",
        });
      }

      // Remove the shared file
      await ctx.db.sharedFile.deleteMany({
        where: {
          shareGroupId,
          fileId,
        },
      });

      // Remove encrypted DEKs for all shared users for this file
      await ctx.db.encryptedDEK.deleteMany({
        where: {
          fileId,
          kekUsed: {
            userId: {
              in: shareGroup.sharedUsers.map((u) => u.id),
            },
          },
        },
      });

      return { success: true };
    }),

  // Track download for analytics/limits
  trackDownload: protectedProcedure
    .input(
      z.object({
        linkToken: z.string(),
        fileId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { linkToken, fileId } = input;

      // Increment download count
      await ctx.db.shareGroup.update({
        where: {
          linkToken,
        },
        data: {
          downloadCount: {
            increment: 1,
          },
        },
      });

      // Log audit event
      await ctx.db.auditLog.create({
        data: {
          action: "LINK_ACCESS",
          targetType: "File",
          targetId: fileId,
          details: {
            linkToken,
            downloadType: "file",
          },
          actorId: ctx.session.user.id,
        },
      });

      return { success: true };
    }),
});
