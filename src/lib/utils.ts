import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getAvatarInitials(name: string | null | undefined) {
  return name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
    : "U";
}
function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const formatFileSize = (bytes: bigint): string => {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === BigInt(0)) return "0 Bytes";
  const k = 1024;
  const index = Math.floor(Math.log(Number(bytes)) / Math.log(k));
  return `${String(Math.round((Number(bytes) / Math.pow(k, index)) * 100) / 100)} ${String(sizes[index])}`;
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.startsWith("video/")) return "🎥";
  if (mimeType.startsWith("audio/")) return "🎵";
  return "📄";
};

export { cn, formatDate, formatFileSize, getAvatarInitials, getFileIcon };
