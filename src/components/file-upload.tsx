"use client";

import { FileText, ImageIcon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UploadDropzone } from "@/lib/uploadthing";

type FileUploadProps = {
  onUploadComplete?: () => void;
  folderId?: string;
};

export function FileUpload({ onUploadComplete, folderId }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadIcon className="h-5 w-5" />
          Upload Files
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <UploadDropzone
          endpoint="mainFileUploader"
          input={{
            folderId,
          }}
          onClientUploadComplete={(response) => {
            console.log("Files uploaded:", response);
            setIsUploading(false);
            setUploadProgress(0);

            // Show success message
            toast.success(
              `Successfully uploaded ${String(response.length)} file${response.length === 1 ? "" : "s"}!`,
            );

            // Call the callback to refresh the file list
            onUploadComplete?.();
          }}
          onUploadError={(error) => {
            console.error("Upload error:", error);
            setIsUploading(false);
            setUploadProgress(0);
            toast.error(`Upload failed: ${error.message}`);
          }}
          onUploadBegin={(name) => {
            console.log("Upload beginning for:", name);
            setIsUploading(true);
            setUploadProgress(0);
            toast.info(`Starting upload: ${name}`);
          }}
          onUploadProgress={(progress) => {
            setUploadProgress(progress);
          }}
          onChange={(acceptedFiles) => {
            console.log("Files dropped:", acceptedFiles);
            // Show file preview
            const fileNames = acceptedFiles.map((f) => f.name).join(", ");
            toast.info(`Ready to upload: ${fileNames}`);
          }}
          config={{
            mode: "auto",
          }}
          appearance={{
            container: {
              border: "2px dashed hsl(var(--border))",
              borderRadius: "var(--radius)",
              backgroundColor: "hsl(var(--background))",
            },
            uploadIcon: {
              color: "hsl(var(--muted-foreground))",
            },
            label: {
              color: "hsl(var(--foreground))",
            },
            allowedContent: {
              color: "hsl(var(--muted-foreground))",
            },
            button: {
              backgroundColor: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            },
          }}
        />

        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Uploading...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            Images (4MB max)
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            PDFs (4MB max)
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
