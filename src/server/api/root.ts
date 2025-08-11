import { deletedRouter } from "@/server/api/routers/deleted";
import { filesRouter } from "@/server/api/routers/files";
import { kmsRouter } from "@/server/api/routers/kms";
import { passkeyRouter } from "@/server/api/routers/passkey";
import { profileRouter } from "@/server/api/routers/profile";
import { sharingRouter } from "@/server/api/routers/sharing";
import { totpRouter } from "@/server/api/routers/totp";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  profile: profileRouter,
  passkey: passkeyRouter,
  totp: totpRouter,
  files: filesRouter,
  deleted: deletedRouter,
  kms: kmsRouter,
  sharing: sharingRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
