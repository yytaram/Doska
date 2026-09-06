# Local development services

PostgreSQL, Redis and MinIO run locally through Docker Compose. All published
ports are bound to `127.0.0.1`, so they are available only on this computer.

## Services

| Service | Local address | Purpose |
| --- | --- | --- |
| PostgreSQL | `127.0.0.1:5432` | Application database |
| Redis | `127.0.0.1:6379` | Later: rate limits, jobs and presence |
| MinIO API | `http://127.0.0.1:9000` | S3-compatible object storage |
| MinIO console | `http://127.0.0.1:9002` | Local storage administration |

The checked-in defaults are development-only credentials. Do not reuse them in
staging or production.

## Start and verify

Start Docker Desktop, then run from the repository root:

```bash
docker compose up -d
docker compose ps
pnpm db:health
```

When the services are ready, every entry in `docker compose ps` should report
`healthy`, and the database check prints `Database health check passed.`

The API exposes two health endpoints while `pnpm api:dev` is running:

- `GET http://127.0.0.1:3000/health`
- `GET http://127.0.0.1:3000/health/database`

The database endpoint returns HTTP 503 without connection details if PostgreSQL
is unavailable.

## Stop, inspect and restart

```bash
docker compose stop
docker compose start
docker compose logs -f
docker compose down
```

`docker compose down` removes containers and the local network but keeps the
named data volumes.

## Reset local data

This permanently deletes the local PostgreSQL, Redis and MinIO development
data. Run it only when a clean local environment is intended:

```bash
docker compose down --volumes
docker compose up -d
```

## Optional local overrides

The defaults work on a clean checkout. To override them, copy
`infra/.env.example` to `infra/.env` and pass it explicitly:

```bash
docker compose --env-file infra/.env up -d
```

Copy `apps/api/.env.example` to `apps/api/.env` when you need to change the API
configuration. Neither local `.env` file should be committed.
