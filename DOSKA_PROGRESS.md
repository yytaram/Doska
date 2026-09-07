# Doska — Batch Development Plan and Progress

## Project decision

Doska is a reverse marketplace for CIS users:

> A person publishes what they want to buy; people who have that item send offers and can start a chat.

Initial infrastructure decision: **Option B — one CIS-wide deployment**.

This is the fastest path for a prototype/early beta, but it may not satisfy every country’s data-localization rules for production. Do not store real sensitive data until the legal position is reviewed.

## Target stack

### Mobile app

- Expo
- React Native
- TypeScript
- Expo Router
- TanStack Query
- Zustand
- React Hook Form + Zod

### Backend

- Fastify
- TypeScript
- Prisma
- PostgreSQL
- Socket.IO for chat
- Redis later for rate limits, queues and presence
- Argon2 password hashing
- JWT access/refresh tokens

### Admin panel

- Next.js
- TypeScript
- Tailwind CSS or a small custom UI system

### Infrastructure

- Local development: Docker Compose, PostgreSQL, Redis, MinIO
- First hosted environment: one Kazakhstan-based cloud deployment
- Production candidate: Yandex Cloud Kazakhstan, Servercore Kazakhstan or Kazteleport
- Images: S3-compatible object storage; do not store image binaries in PostgreSQL

### Payments

Do not implement payments in the first batches. For mobile boosts, use Apple/Google in-app purchases, normally through RevenueCat. Polar is not part of the initial mobile payment architecture.

## Repository layout

```text
doska/
  apps/
    mobile/
    api/
    admin/
  packages/
    shared/
    config/
  infra/
    docker-compose.yml
  docs/
  DOSKA_PROGRESS.md
  package.json
  pnpm-workspace.yaml
  README.md
```

## Rules for every ChatGPT batch

Before changing anything, ChatGPT must:

1. Read this file completely.
2. Inspect the repository and current git status.
3. Find the current batch and check previous batch acceptance criteria.
4. Continue only from the existing state; do not recreate completed work.
5. Make small, reviewable changes.
6. Run the relevant tests, type checks, lint and build commands.
7. Update the Progress Log below with files changed, commands run, results, blockers and the next batch.
8. Never put secrets in git, source code or this progress file.

At the end of each batch, ChatGPT must report:

- completed items;
- files created or changed;
- verification results;
- any manual action still required from me;
- exact next batch;
- known risks or shortcuts.

## What I personally need to do

### One-time computer setup

Install:

- Git
- Node.js LTS
- pnpm
- Docker Desktop
- VS Code
- Android Studio and an Android emulator
- Expo Go on an Android/iOS test phone
- Xcode only if building iOS locally; Xcode requires macOS

Verify:

```bash
node --version
pnpm --version
git --version
docker --version
```

Recommended project commands:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Do not install Expo CLI globally. The project should use the current Expo tooling through `create-expo-app` and package scripts.

### Accounts to create later

Create these only when the related batch starts:

- GitHub account and a private repository
- Expo account and EAS project
- Yandex Cloud Kazakhstan, Servercore Kazakhstan or Kazteleport account
- Apple Developer account for iOS distribution
- Google Play Console account for Android distribution
- RevenueCat account only when boosts are implemented
- Error-monitoring account only when observability is implemented

### Information I must decide

- Launch language: Russian only first, or Russian + Kazakh from the beginning
- First launch cities
- Minimum user age
- Categories to support
- Whether email login is enough for MVP or phone login is required
- Product name/package IDs, for example `com.doska.app`
- Who will moderate content
- Whether the first beta uses fake data or real users

## Batches

### Batch 0 — Product freeze and safety boundaries

ChatGPT tasks:

- Convert the idea into a one-page product brief.
- Define MVP and explicitly defer photos, delivery, escrow, ratings and payments.
- Define user roles as contextual: ad owner and offer sender.
- Write core user flows: register, create ad, browse, offer, chat, close ad, report.
- Add non-functional requirements: pagination, rate limits, account deletion, audit logs.

My tasks:

- Confirm the first cities, languages and categories.
- Confirm that the first beta is one deployment for CIS and accepts the legal risk for testing only.

Acceptance criteria:

- `docs/product-brief.md` exists.
- MVP has a single end-to-end scenario.
- Deferred features are documented.

### Batch 1 — Workspace and monorepo foundation

ChatGPT tasks:

- Create the pnpm monorepo and the repository layout above.
- Create empty but runnable mobile, API and admin applications.
- Add TypeScript, ESLint, Prettier and shared scripts.
- Add `.env.example` files and a safe `.gitignore`.
- Add a README with setup commands.

My tasks:

- Install the one-time tools.
- Create the private GitHub repository.
- Run the setup commands and commit the initial state.

Acceptance criteria:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
```

all work successfully, or the exact platform-specific exception is recorded.

### Batch 2 — Local infrastructure

ChatGPT tasks:

- Add Docker Compose for PostgreSQL, Redis and MinIO.
- Add health checks and persistent local volumes.
- Add API configuration validation with Zod.
- Add a database connection health endpoint.
- Document local start/stop/reset commands.

My tasks:

- Install and start Docker Desktop.
- Run the local services.
- Confirm that the database and object storage ports are not exposed publicly.

Acceptance criteria:

```bash
docker compose up -d
pnpm db:health
```

works from a clean checkout.

### Batch 3 — Database schema and migrations

ChatGPT tasks:

- Implement Prisma schema and migrations for:
  - users;
  - sessions/refresh tokens;
  - profiles;
  - categories;
  - cities;
  - ads;
  - offers;
  - favorites;
  - blocks;
  - reports;
  - moderation terms;
  - audit logs;
  - device tokens.
- Add ownership fields, statuses, timestamps and indexes.
- Add seed data for categories and initial cities.
- Add database constraints for offer uniqueness and valid ownership.

My tasks:

- Review category and city seed data.
- Run migrations and inspect the local database.

Acceptance criteria:

```bash
pnpm db:migrate
pnpm db:seed
pnpm test
```

pass, and a fresh database can be recreated from migrations.

### Batch 4 — Authentication and account management

ChatGPT tasks:

- Implement email/password registration and login.
- Hash passwords with Argon2.
- Implement short-lived access tokens and refresh-token rotation.
- Add logout, current-user endpoint and password change.
- Add profile creation with nickname, city and language.
- Add account deletion that closes ads and removes/anonymizes personal data according to the documented policy.
- Add tests for authentication and authorization.

My tasks:

- Decide whether email-only login is acceptable for the beta.
- Configure local test accounts.
- Never paste real passwords or secret keys into ChatGPT.

Acceptance criteria:

- A user can register, log in, refresh a session, log out and delete an account.
- Passwords and refresh tokens are never logged.
- Unauthenticated requests cannot access private endpoints.

### Batch 5 — Ads API

ChatGPT tasks:

- Implement create, read, update, close and list-my-ads endpoints.
- Implement statuses: `draft`, `moderation`, `active`, `paused`, `closed`, `rejected`, `expired`.
- Validate title, description, budget, condition, category and city with Zod.
- Use cursor pagination, not loading all ads at once.
- Add ownership authorization and rate limits.
- Add tests for owner/non-owner access.

My tasks:

- Review validation limits and wording.
- Confirm currency is KZT and whether budgets are integer tenge.

Acceptance criteria:

- User A cannot edit or close User B’s ad.
- Public feed returns only allowed statuses.
- Pagination and indexes are used.

### Batch 6 — Mobile UI foundation and authentication screens

ChatGPT tasks:

- Build the mobile navigation with Expo Router.
- Add auth screens, onboarding and profile setup.
- Add a small design system for colors, typography, buttons, cards and inputs.
- Add API client, token storage and TanStack Query setup.
- Add loading, empty and error states.

My tasks:

- Run the app on a real phone or emulator.
- Choose brand colors, logo direction and final Russian/Kazakh wording.

Acceptance criteria:

- The app starts with `pnpm mobile:start`.
- A user can register/login against the local API.
- Navigation works on Android and iOS-compatible layouts.

### Batch 7 — Feed, search and ad creation UI

ChatGPT tasks:

- Build home feed and ad detail screens.
- Build category, city, budget, condition and date filters.
- Add PostgreSQL full-text search for title and description.
- Build create/edit/close ad forms.
- Add optimistic UI only where safe; server remains authoritative.

My tasks:

- Test the main flow with realistic examples such as “Куплю iPhone 15”.
- Review empty states and local-language text.

Acceptance criteria:

- User can create an ad and see it in the feed after the API status allows it.
- Search and filters work with pagination.
- The app does not download every ad.

### Batch 8 — Offers and chat

ChatGPT tasks:

- Implement offer creation, withdrawal, accept/reject and list-offers endpoints.
- Prevent duplicate offers from the same seller on one ad.
- Create a chat only through a valid offer flow.
- Implement Socket.IO text chat with participant authorization.
- Add unread counts, last message and basic block behavior.
- Add message rate limits and message-length limits.
- Add tests proving users cannot read another chat.

My tasks:

- Test two separate accounts on two devices or browser sessions.
- Decide whether chat is allowed before the ad owner accepts an offer.

Acceptance criteria:

```text
User A creates ad
User B sends offer
Chat is created
A and B exchange messages
User C cannot read the chat
```

### Batch 9 — Moderation, reports and admin panel

ChatGPT tasks:

- Add server-side text normalization and moderation-term matching.
- Add moderation queue and report endpoints.
- Add admin authorization separate from ordinary users.
- Build Next.js admin pages for ads, reports, users, categories and moderation terms.
- Record all admin actions in audit logs.
- Add block/reject/restore workflows.

My tasks:

- Define prohibited categories and report reasons with a legal adviser.
- Decide who gets admin access.
- Review moderation false positives.

Acceptance criteria:

- A normal user cannot access admin endpoints.
- Every admin action is auditable.
- A reported ad can be hidden and reviewed.

### Batch 10 — Push notifications and reliability

ChatGPT tasks:

- Add device-token registration and removal.
- Add notifications for new offers, messages, moderation results and expiring ads.
- Add retry-safe notification jobs.
- Add structured logging, request IDs and error handling.
- Add health/readiness endpoints.

My tasks:

- Create Expo/EAS project when instructed.
- Test notification permissions on a physical device.
- Decide notification wording and quiet hours.

Acceptance criteria:

- Notifications do not expose unnecessary private message content.
- Failed delivery does not break the main transaction.
- Logs do not contain passwords, tokens or private message bodies.

### Batch 11 — Deployment of the single CIS-wide environment

ChatGPT tasks:

- Prepare production-like Docker images for API and admin.
- Add reverse proxy, TLS, firewall guidance and environment configuration.
- Deploy PostgreSQL, API, admin, Redis and object storage according to the selected provider.
- Configure backups and restore documentation.
- Add migrations that run safely during deployment.
- Add staging and production separation.

My tasks:

- Choose and create the provider account.
- Create domain names and DNS records.
- Add secrets directly to the provider’s secret manager; never commit them.
- Set billing limits and alerts.
- Confirm the provider’s data-location, backup and subcontractor terms.

Acceptance criteria:

- Staging works from a clean phone install.
- Production secrets are not in git.
- A database backup can be restored in a test environment.
- Admin access is restricted.

### Batch 12 — Security, privacy and beta release

ChatGPT tasks:

- Run dependency audit and security review.
- Test authorization, rate limits, account deletion and data export/deletion behavior.
- Add privacy policy, terms, community rules and prohibited-items policy placeholders.
- Add crash reporting and basic product analytics without collecting unnecessary personal data.
- Prepare store metadata and release checklist.
- Write a beta incident-response procedure.

My tasks:

- Have a Kazakhstan/CIS lawyer review the privacy and cross-border processing model.
- Decide whether real CIS users are permitted in the beta.
- Create Apple/Google developer accounts if releasing publicly.
- Recruit a small test group and define support contact.

Acceptance criteria:

- The complete scenario works repeatedly:

```text
register → create ad → find ad → send offer → chat → close ad → report/block
```

- Security tests pass.
- Privacy documents are approved before real-user launch.
- A rollback and backup restore procedure is tested.

## Progress log

### Current status

- Overall status: `in_progress`
- Current batch: `Batch 8 (not started)`
- Last updated: `2026-09-08`

### Completed work

| Batch | Status      | Notes                                                                      |
| ----- | ----------- | -------------------------------------------------------------------------- |
| 0     | complete    | Product brief, MVP boundaries and end-to-end flow documented               |
| 1     | complete    | pnpm monorepo foundation, runnable applications and shared tooling created |
| 2     | complete    | Local PostgreSQL, Redis and MinIO services and API health checks created   |
| 3     | complete    | Prisma schema, migration, reference seeds and database constraints created |
| 4     | complete    | Secure email authentication and account lifecycle API created              |
| 5     | complete    | Secure ads lifecycle API, public feed and cursor pagination created        |
| 6     | complete    | Russian mobile authentication, session handling and profile UI created     |
| 7     | complete    | Feed, full-text search, filters and ad-management UI created               |
| 8     | not_started | Offers/chat not created                                                    |
| 9     | not_started | Moderation/admin not created                                               |
| 10    | not_started | Push/reliability not created                                               |
| 11    | not_started | Deployment not created                                                     |
| 12    | not_started | Security/beta not started                                                  |

### Batch notes

Batch 0 completed on 2026-09-07.

- Decisions recorded: all Kazakhstan cities; Russian-only UI; provisional minimum
  age of 16; email/password login; fake/test data for the first beta; one
  CIS-wide testing deployment; eight initial categories.
- Created `docs/product-brief.md` with the MVP, deferred features, contextual
  user roles, core flows, end-to-end scenario and safety requirements.
- Verification: reviewed the brief against Batch 0 acceptance criteria. No
  application tests apply because the repository has no source code yet.
- Manual action: create a private GitHub repository before or during Batch 1.
- Risk: data-location, privacy, age and prohibited-items requirements need legal
  review before real users or real data are allowed.
- Next batch: Batch 1 — Workspace and monorepo foundation.

Batch 1 completed on 2026-09-07.

- Created the pnpm workspace with `apps/mobile`, `apps/api`, `apps/admin`,
  `packages/shared` and `packages/config`.
- Added an Expo Router mobile app, Fastify API health endpoint, Next.js admin
  placeholder, TypeScript, ESLint, Prettier, safe `.gitignore`, environment
  templates and setup documentation.
- Installed dependencies and created `pnpm-lock.yaml`.
- Linked the local workspace to the private GitHub repository as `origin`; no
  files were committed or pushed.
- Commands passed: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
  The production build exported the mobile app for Android, iOS and web,
  compiled the API and built the admin app.
- Manual action: review the files, then create the first local commit and push
  it to GitHub when ready.
- Note: the workspace temporarily pins a compatible `browserslist` version
  because the latest version requested an unavailable transitive package in the
  current npm registry state. Revisit this dependency override in a later
  maintenance update.
- Next batch: Batch 2 — Local infrastructure.

Batch 2 completed on 2026-09-07.

- Added Docker Compose services for PostgreSQL 17, Redis 7.4 and MinIO with
  health checks, restart policies and persistent named volumes.
- Bound every published container port to `127.0.0.1`; the services are not
  exposed on public network interfaces.
- Added Zod-validated API configuration, a PostgreSQL connection wrapper,
  `GET /health/database` and the `pnpm db:health` command.
- Added development environment templates and documented start, stop, log and
  data-reset commands in `docs/local-development.md`.
- Added `*.tsbuildinfo` to `.gitignore` and stopped tracking the generated
  Next.js TypeScript cache file; the local cache remains available.
- Verification passed: `docker compose config --quiet`, `docker compose up -d`,
  `docker compose ps`, `pnpm db:health`, `pnpm lint`, `pnpm typecheck`,
  `pnpm build`, and live requests to `/health` and `/health/database`.
- Running services: PostgreSQL on `127.0.0.1:5432`, Redis on
  `127.0.0.1:6379`, MinIO API on `127.0.0.1:9000`, and MinIO console on
  `127.0.0.1:9002`.
- Manual action: none required. Leave Docker Desktop running when working on
  the API; `docker compose down` stops the local services without deleting data.
- Known local exception: port 9001 was already occupied, so the MinIO console
  uses host port 9002. Its S3 API remains on port 9000.
- Dependency workaround: Expo CLI's broad `ws` range resolved to a version
  incompatible with its CommonJS import at build time, so only
  `@expo/cli > ws` is pinned to 8.18.3.
- Next batch: Batch 3 — Database schema and migrations.

Batch 3 completed on 2026-09-07.

- Added Prisma 6.19 with a schema and initial PostgreSQL migration for users,
  sessions/refresh tokens, profiles, categories, cities, ads, offers, favorites,
  blocks, reports, moderation terms, audit logs and device tokens.
- Added ownership fields, lifecycle statuses, timezone-aware timestamps,
  foreign-key behavior and indexes for future feed, ownership, moderation and
  notification queries.
- Added idempotent Russian seed data for the eight agreed starter categories
  and all 90 Kazakhstan cities, grouped by region. The official Bureau of
  National Statistics count for 1 July 2026 was used as the count reference.
- Added database constraints for unique offers, non-negative prices, self-block
  prevention, valid report targets and cross-table triggers that prevent an ad
  owner from offering on their own ad.
- Added integration tests that query the real local PostgreSQL database and
  prove the seed counts, unique-offer rule and ownership constraints.
- Added database commands and review documentation in `docs/database.md`.
- Verification passed: `pnpm install --frozen-lockfile`, `pnpm db:generate`,
  `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:health`, `pnpm test`, `pnpm lint`,
  `pnpm typecheck`, `pnpm build` and `pnpm format:check`.
- Fresh-database verification passed: `pnpm db:reset` deleted only the local
  `doska` development schema, reapplied the checked-in migration and reseeded 8
  categories and 90 cities. The three acceptance commands passed again after
  the reset.
- Manual action: review the category and city tables in `docs/database.md`.
  Docker Desktop and the local services are currently running.
- Known shortcut: region and city names are Russian-only for the initial beta;
  localization and stable government territorial codes can be added later.
- Next batch: Batch 4 — Authentication and account management. Do not start it
  until the user explicitly says `Start Batch 4`.

Batch 4 completed on 2026-09-07.

- Implemented email/password registration and login with normalized email,
  Russian validation responses, a required 16+ beta acknowledgement and profile
  creation using an active Kazakhstan city.
- Added Argon2id password hashing using the OWASP minimum memory-hard settings.
- Added signed 15-minute access tokens and random opaque 30-day refresh tokens.
  Only refresh-token hashes are stored; rotation atomically revokes the previous
  token and rejects reuse.
- Added immediate access revocation through session and account-version checks,
  plus logout, current-user, profile update and password-change endpoints.
- Added per-IP rate limits for registration, login and refresh. API logging
  redacts passwords, refresh tokens and authorization headers.
- Added transactional account deletion: sessions, device tokens, profile,
  favorites and blocks are removed; owned ads and sent offers are closed or
  withdrawn and stripped of user content; email and password are anonymized;
  minimal relational and audit records remain.
- Added a public active-city reference endpoint needed by registration and a
  documented fake-data beta retention policy in `docs/authentication.md`.
- Added migration `20260906175608_add_auth_version` so password changes, logout,
  suspension and deletion can invalidate access tokens immediately.
- Integration verification covers the complete account lifecycle, anonymous
  authorization rejection, Argon2 storage, hashed refresh-token storage,
  one-time token rotation, replay rejection, logout, password change, deleted
  accounts, ad anonymization, audit events, log redaction and login throttling.
- Commands passed: `pnpm install --frozen-lockfile`, `pnpm db:migrate`,
  `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`,
  `pnpm format:check` and Prisma migration status.
- Manual action: none required. Tests use disposable fake accounts and remove
  them afterward. Continue to avoid real credentials or real personal data.
- Known limitation: the rate limiter is in process memory for the local/single
  API instance. A shared Redis-backed limiter is required before horizontally
  scaling the API. The deletion policy still requires legal review before real
  users are accepted.
- Next batch: Batch 5 — Ads API. Do not start it until the user explicitly says
  `Start Batch 5`.

Batch 5 completed on 2026-09-07.

- Implemented authenticated ad creation, private owner detail/list, editing,
  pausing, resuming and idempotent closing, plus a public feed and public ad
  detail endpoint.
- Added the complete ad lifecycle states: `draft`, `moderation`, `active`,
  `paused`, `closed`, `rejected` and `expired`. Public endpoints expose only
  active, unexpired ads; moderation activation/rejection remains an admin task
  for Batch 9.
- Added Zod validation for Russian title and description limits, whole-tenge
  KZT budgets, condition, active category and active Kazakhstan city. Currency
  is controlled by the server and cannot be changed by clients.
- Added opaque keyset cursor pagination and compound PostgreSQL indexes for the
  public feed and owner lists. Added public active-category reference data for
  the future mobile forms.
- Added ownership checks that return the same not-found response for missing and
  non-owned ads, mutation rate limits, atomic lifecycle transitions and audit
  events for ad changes.
- Integration tests cover anonymous access, invalid budgets, owner/non-owner
  authorization, public status filtering, expiration filtering, pagination,
  editing, pausing, resuming, closing, private status filtering and database
  indexes.
- Commands passed: Prisma migration, API type checking and all API integration
  tests. Full workspace lint, type checking, tests, build and formatting were
  also run at batch completion.
- Manual action: review the validation limits and Russian wording in
  `docs/ads-api.md`. Confirm that whole-tenge integer budgets are acceptable;
  this is the recommended initial KZT representation.
- Known limitations: publication and rejection need the moderation workflow in
  Batch 9; automatic transition to `expired` needs a later background job. The
  local rate limiter remains process-local until the shared Redis limiter is
  introduced.
- Next batch: Batch 6 — Mobile UI foundation and authentication screens. Do not
  start it until the user explicitly says `Start Batch 6`.

Batch 6 completed on 2026-09-07.

- Replaced the mobile placeholder with Expo Router navigation for onboarding,
  registration, login, signed-in home and editable profile screens. The layout
  uses safe areas and native controls compatible with Android and iOS.
- Added a small Russian design system with shared colors, spacing, buttons,
  fields, notices, loading states and an accessible city-search picker.
- Added React Hook Form and Zod client validation, TanStack Query caching for
  city data, and Zustand session state. Registration captures email, nickname,
  city, password and the required 16+ test-beta acknowledgement.
- Added a typed API client connected to the existing authentication and profile
  endpoints. Sessions are restored using a refreshed token when necessary;
  Android/iOS tokens are stored with Expo SecureStore. The local web build uses
  browser storage only for development.
- Added `docs/mobile-development.md` with the exact local API address needed
  for web/iOS simulator, Android emulator and Expo Go on a physical phone.
- Added the Expo SecureStore plugin and compatible mobile dependencies.
- Verification passed: `pnpm mobile:start -- --offline` started Metro at
  `http://localhost:8081`; mobile type checking, linting and production export
  for Android, iOS and web all passed. Full workspace verification also passed
  at batch completion.
- Manual action: copy `apps/mobile/.env.example` to `apps/mobile/.env`, choose
  the API address in `docs/mobile-development.md`, then run `pnpm api:dev` and
  `pnpm mobile:start`. Test registration and login with a disposable email and
  password in Expo Go or the Android emulator.
- Known limitation: no production branding, logo or final localized wording is
  selected yet. The home screen is intentionally a signed-in placeholder until
  the feed and ad-creation UI in Batch 7. Physical-device testing requires the
  computer and phone to be on the same Wi-Fi network.
- Next batch: Batch 7 — Feed, search and ad creation UI. Do not start it until
  the user explicitly says `Start Batch 7`.

Post-Batch 6 connection fix completed on 2026-09-07.

- Upgraded the mobile application incrementally from Expo SDK 54 to SDK 57 so
  it matches the current Expo Go application on the physical phone. SDK 57
  uses React Native 0.86 and React 19.2.
- Aligned Expo, React Native and React type packages after the development
  server reported compatibility warnings.
- Added the Expo-required `react-native-worklets` and `react-dom` peer
  dependencies after Expo Doctor identified them as missing. Expo Doctor now
  reports 18/18 checks passing.
- Added local-development configuration for browser and Android-emulator
  testing. The mobile `.env` remains machine-specific and is intentionally not
  committed; use the documented address appropriate to the selected device.
- Confirmed mobile type checking, linting, formatting and the Android/iOS/web
  export pass after the fix. Expo Doctor reports 21/21 checks passing after the
  SDK 57 upgrade.

Batch 7 completed on 2026-09-08.

- Built the signed-in home feed, public ad details and reusable cards with
  Russian loading, empty and error states.
- Added category, city, whole-tenge budget, condition and publication-date
  filters. The client keeps cursor pages separate and loads more only on demand.
- Added PostgreSQL full-text title-and-description search with word-prefix
  matching and a checked-in GIN index migration.
- Built reusable create/edit forms, owner ad listing and a confirmed close
  action. Draft and moderation states stay private and the server remains the
  authority after mutations.
- Added deterministic fake development data: three active public ads, including
  “Куплю iPhone 15 Pro 256 ГБ”, while retaining all 90 cities and eight
  categories.
- Expanded API integration coverage for full-text search, combined budget and
  condition filters, publication dates, invalid ranges and the search index.
- Verification passed: database migration deployment, seed, all five API test
  suites, workspace lint and TypeScript checks. Formatting was applied before
  the final production build.
- Manual action: run the API and mobile web app, sign in with a disposable test
  account, review the seeded feed, create a draft, edit it and close it from “Мои
  объявления”. New moderation submissions will not enter the public feed until
  Batch 9 adds moderator approval.
- Next batch: Batch 8 — Offers and chat. Do not start it until the user
  explicitly says `Start Batch 8`.

## Prompt for the next ChatGPT batch

Copy this into the next ChatGPT message:

```text
We are building Doska. Read DOSKA_PROGRESS.md completely before doing anything.
Inspect the repository and git status. Identify the first incomplete batch, verify the previous batch acceptance criteria, and work only on that batch.
Do not recreate completed work. Run all relevant checks. At the end, update DOSKA_PROGRESS.md with the completed work, changed files, commands/results, manual actions I must do, blockers, risks, and the exact next batch.
```
