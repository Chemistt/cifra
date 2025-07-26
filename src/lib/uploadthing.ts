import {
  generateReactHelpers,
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";

import type { FileUTRouter } from "@/app/api/uploadthing/core";

export const UploadButton = generateUploadButton<FileUTRouter>();
export const UploadDropzone = generateUploadDropzone<FileUTRouter>();

export const { useUploadThing } = generateReactHelpers<FileUTRouter>();
