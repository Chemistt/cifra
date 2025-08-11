"use client";

import { UploadIcon } from "lucide-react";
import * as React from "react";
import { useRef, useState } from "react";

import { EncryptedFileUploadDialog } from "@/components/encrypted-file-upload-dialog";

type GlobalDropzoneProps = {
  folderId?: string;
  children: React.ReactNode;
};

const handleDragOver = (event: React.DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

export function GlobalDropzone({ folderId, children }: GlobalDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0); // Tracks nested drag events to prevent flickering
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);

  // Handle drag events
  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Only show dropzone if files are being dragged
    if (event.dataTransfer.types.includes("Files")) {
      dragCounterRef.current += 1;
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setIsDragOver(false);
    dragCounterRef.current = 0;

    const files = [...event.dataTransfer.files];
    if (files.length > 0) {
      setDroppedFiles(files);
    }
  };

  const handleUploadComplete = () => {
    setDroppedFiles([]);
  };

  return (
    <>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative h-full w-full"
      >
        {children}

        {/* Dropzone Overlay */}
        {isDragOver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="border-primary bg-background/95 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 shadow-lg">
              <UploadIcon className="text-primary mb-4 h-16 w-16" />
              <p className="text-primary text-xl font-medium">
                Drop files here to upload
              </p>
              <p className="text-muted-foreground text-sm">
                Files will be encrypted before upload
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Encrypted File Upload Dialog */}
      <EncryptedFileUploadDialog
        folderId={folderId}
        preloadedFiles={droppedFiles}
        autoStartUpload
        onUploadComplete={handleUploadComplete}
      />
    </>
  );
}
