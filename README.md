# Cifra

This is a seamless file sharing platform with end-to-end encryption.

## Tech Stack

- [Next.js](https://nextjs.org)
- [Better Auth](https://www.better-auth.com)
- [Prisma](https://prisma.io)
- [tRPC](https://trpc.io)
- [Tailwind CSS](https://tailwindcss.com)
- [UploadThing](https://uploadthing.com)

## Requirements

- Node.js 22+
- pnpm 10.12.1+

You will also need to have accounts for the following services to populate the `.env` file:

- [Vercel](https://vercel.com)
- [Supabase](https://supabase.com)
- [UploadThing](https://uploadthing.com)
- [Google Cloud (Google Auth Platform)](https://console.cloud.google.com)
- [Discord Developer Portal](https://discord.com/developers)

> Note: You may not need a Supabase account if you are connecting via Vercel.

## Development

Clone the repository.

```bash
git clone https://github.com/Chemistt/cifra.git
cd cifra
```

Run `pnpm install` to install the dependencies.

```bash
pnpm install
```

If pnpm is not installed, use `corepack` to install it.

```bash
corepack enable
pnpm install
```

Populate the `.env` file according to the `.env.example` file. Once done, run `pnpm run dev` to start the development server.

```bash
pnpm run dev
```

## Database

If you wish to use a local database, we provide a docker file for local postgres database.

```bash
./start-database.sh
```

If you encounter errors with prisma, run `pnpm run db:push` from the root directory of your app. This command will sync your Prisma schema with your database and will generate the TypeScript types for the Prisma Client based on your schema.

> Note that you need to restart the TypeScript server after doing this so that it can detect the generated types.

## Editor Setup

The following extensions are recommended for an optimal developer experience. The links below provide editor specific plugin support.

- [Prisma Extension](https://www.prisma.io/docs/guides/development-environment/editor-setup)
- [Tailwind CSS IntelliSense Extension](https://tailwindcss.com/docs/editor-setup)
- [Prettier Extension](https://prettier.io/docs/en/editors.html)
- [ESLint Extension](https://eslint.org/docs/latest/user-guide/integrations#editors)
- [Prety TypeScript Errors Extension](https://marketplace.visualstudio.com/items?itemName=yoavbls.pretty-ts-errors)
