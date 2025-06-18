import { redirect } from "next/navigation";

import SignIn from "@/components/sign-in";
import { getServerSession } from "@/server/auth";

export default async function AuthPage() {
  const session = await getServerSession();
  if (session) {
    redirect("/");
  }
  return (
    <main className="flex flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <h2 className="text-2xl font-bold">Welcome to Cifra</h2>
        <p className="text-muted-foreground text-sm">
          Sign in below to get started (maybe you get free things who knows)
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <SignIn />
      </div>
    </main>
  );
}
