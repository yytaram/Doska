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
infra          Local PostgreSQL, Redis and MinIO infrastructure
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
pnpm db:migrate
pnpm db:seed
pnpm test
pnpm mobile:start
pnpm mobile:android
pnpm api:dev
pnpm admin:dev
```

## Local services

With Docker Desktop running:

```bash
docker compose up -d
pnpm db:health
```

See [local development services](docs/local-development.md) for ports, health
checks, logs, shutdown and reset instructions.

See [database schema and reference data](docs/database.md) for migrations,
database reset instructions, starter categories and the 90-city seed catalog.

See [authentication and account lifecycle](docs/authentication.md) for the API
routes, token model, security rules and beta account-deletion policy.

See [ads API](docs/ads-api.md) for validation limits, status transitions,
ownership rules, filtering and cursor pagination.

`pnpm mobile:ios` opens an iOS simulator only on macOS. On Windows, use Expo Go
on an iPhone or use a cloud build later.
