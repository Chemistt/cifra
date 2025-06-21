"use client";

import { Upload } from "lucide-react";
import { useState } from "react";

import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type FileUploadDialogProps = {
  onUploadComplete?: () => void;
  folderId?: string;
  children?: React.ReactNode;
};

export function FileUploadDialog({
  onUploadComplete,
  folderId,
  children,
}: FileUploadDialogProps) {
  const [open, setOpen] = useState(false);

  const handleUploadComplete = () => {
    setOpen(false);
    onUploadComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Upload images and PDF files to your secure storage. Maximum file
            size is 4MB.
          </DialogDescription>
        </DialogHeader>
        <FileUpload
          onUploadComplete={handleUploadComplete}
          folderId={folderId}
        />
      </DialogContent>
    </Dialog>
  );
}
