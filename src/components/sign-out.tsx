"use client";

import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <Button onClick={() => void signOut()}>
      <LogOutIcon className="h-4 w-4" />
      Sign out
    </Button>
  );
}
