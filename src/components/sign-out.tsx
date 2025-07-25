"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      className="cursor-pointer"
      onClick={() =>
        void signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/");
            },
          },
        })
      }
    >
      <LogOutIcon className="h-4 w-4" />
      Sign out
    </Button>
  );
}
