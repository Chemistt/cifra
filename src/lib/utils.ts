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

export { cn, formatDate, getAvatarInitials };
