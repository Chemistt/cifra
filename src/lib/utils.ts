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

export { cn, getAvatarInitials };
