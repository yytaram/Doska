# Doska

Doska is a Russian-language reverse marketplace for Kazakhstan. People publish
what they want to buy, and people who have the item can send offers.

## Project structure

```text
apps/mobile   Expo + React Native application
apps/api      Fastify API
apps/admin    Next.js moderation/admin application
packages/shared  Shared types and constants
packages/config  Shared configuration files
infra          Local infrastructure (added in Batch 2)
```

## Prerequisites

- Node.js 24 or later
- pnpm 11 or later
- Docker Desktop (needed from Batch 2)
- Android Studio/emulator or Expo Go for mobile testing

## First-time setup

```bash
corepack enable
pnpm install
```

Copy the environment template for each app before it needs configuration:

```bash
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
Copy-Item apps/admin/.env.example apps/admin/.env.local
```

Do not commit the copied files: they are ignored by Git.

## Common commands

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm mobile:start
pnpm mobile:android
pnpm api:dev
pnpm admin:dev
```

`pnpm mobile:ios` opens an iOS simulator only on macOS. On Windows, use Expo Go
on an iPhone or use a cloud build later.
