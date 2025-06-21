import Link from "next/link";

import { SignOutButton } from "@/components/sign-out";
import { Button } from "@/components/ui/button";
import { getServerSession } from "@/server/auth";

export default async function Home() {
  const session = await getServerSession();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
          Cifra
        </h1>
        <div className="flex flex-col items-center gap-2">
          <p className="text-2xl text-white"></p>
        </div>
        {session ? (
          <div className="flex flex-col items-center gap-2">
            <p>Logged in as {session.user.email}</p>
            <div className="flex items-center gap-2">
              <SignOutButton />
              <Button asChild>
                <Link href="/files">Go to Files</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p>Click the button below to sign in</p>
            <Button asChild>
              <Link href="/auth">Sign in</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
