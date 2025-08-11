import type { ReactNode } from "react";
import { Toaster } from "sonner";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      {children}
      <Toaster expand richColors />
    </div>
  );
}
