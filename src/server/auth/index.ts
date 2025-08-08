import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { passkey } from "better-auth/plugins/passkey";
import { twoFactor } from "better-auth/plugins/two-factor";
import { headers } from "next/headers";
import { cache } from "react";

import { env } from "@/env";

const prisma = new PrismaClient();

export const auth = betterAuth({
  appName: "Cifra",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [twoFactor(), passkey()],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // Ensure bcrypt compatible with betterAuth
    password: {
      hash: async (password: string) => {
        return await bcrypt.hash(password, 12);
      },
      verify: async (data: { password: string; hash: string }) => {
        return await bcrypt.compare(data.password, data.hash);
      },
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
    },
  },
} satisfies BetterAuthOptions);

export const getServerSession = cache(
  async () =>
    await auth.api.getSession({
      headers: await headers(),
    }),
);

export type Session = typeof auth.$Infer.Session;
export type AuthUserType = Session["user"];
