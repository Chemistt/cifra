import { headers } from "next/headers";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";

import { createCaller } from "@/server/api/root";
import { getServerSession } from "@/server/auth";
import { db } from "@/server/db";

const f = createUploadthing();

export const fileUTRouter = {
  mainFileUploader: f({
    image: {
      /**
       * For full list of options and defaults, see the File Route API reference
       * @see https://docs.uploadthing.com/file-routes#route-config
       */
      maxFileSize: "4MB",
    },
    pdf: {
      maxFileSize: "4MB",
    },
    blob: {
      /**
       * For encrypted files (application/octet-stream)
       */
      maxFileSize: "4MB",
    },
  })
    .input(
      z.object({
        folderId: z.string().optional(),
      }),
    )
    .middleware(async ({ input }) => {
      const session = await getServerSession();
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- uploadthing error
      if (!session) throw new UploadThingError("Unauthorized");

      // metadata here
      return {
        userId: session.user.id,
        folderId: input.folderId,
        session,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("file url", file.ufsUrl);

      try {
        const caller = createCaller({
          db,
          session: metadata.session,
          headers: await headers(),
        });

        // Check if this is an encrypted file (ends with .encrypted)
        const isEncryptedFile = file.name.endsWith(".encrypted");

        if (isEncryptedFile) {
          // For encrypted files, we don't save metadata here
          // The client will handle metadata creation via the encrypted endpoint
          console.log(
            "Encrypted file uploaded, metadata will be handled by client:",
            file.name,
          );
        } else {
          // Regular unencrypted file handling
          await caller.files.createFileMetadata({
            name: file.name,
            storagePath: file.key,
            mimeType: file.type,
            size: file.size,
            md5: file.fileHash,
            folderId: metadata.folderId,
          });
          console.log("File metadata saved to database for:", file.name);
        }
      } catch (error) {
        console.error("Failed to save file metadata:", error);
        // Continue execution even if metadata save fails
      }

      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return {
        uploadedBy: metadata.userId,
        key: file.key,
        url: file.ufsUrl,
      };
    }),
} satisfies FileRouter;

export type FileUTRouter = typeof fileUTRouter;
