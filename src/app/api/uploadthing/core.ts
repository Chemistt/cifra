import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

import { getServerSession } from "@/server/auth";

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
  })
    .middleware(async () => {
      const session = await getServerSession();
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- uploadthing error
      if (!session) throw new UploadThingError("Unauthorized");

      // metadata here
      return { userId: session.user.id };
    })
    .onUploadComplete(({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("file url", file.ufsUrl);
      // TODO: save metadate to db

      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type FileUTRouter = typeof fileUTRouter;
