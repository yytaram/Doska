# Ads API

Doska ads describe what a buyer wants to purchase. The API keeps owner-only
drafts and moderation states separate from the public active feed.

## Routes

| Method  | Route                   | Purpose                                 | Access        |
| ------- | ----------------------- | --------------------------------------- | ------------- |
| `GET`   | `/reference/categories` | Active categories for forms             | Public        |
| `GET`   | `/ads`                  | Cursor-paginated public feed            | Public        |
| `GET`   | `/ads/:id`              | One public active ad                    | Public        |
| `POST`  | `/ads`                  | Create a draft or submit for moderation | Authenticated |
| `GET`   | `/account/ads`          | List all ads owned by the current user  | Owner         |
| `GET`   | `/account/ads/:id`      | Read one owned ad in any status         | Owner         |
| `PATCH` | `/ads/:id`              | Update an editable owned ad             | Owner         |
| `POST`  | `/ads/:id/pause`        | Pause an active owned ad                | Owner         |
| `POST`  | `/ads/:id/resume`       | Send a paused ad back to moderation     | Owner         |
| `POST`  | `/ads/:id/close`        | Close an owned ad                       | Owner         |

Non-owners receive the same not-found response as a missing private ad. This
avoids exposing whether another user's private ad exists.

## Validation for review

| Field       | Current rule                                | Russian UI direction            |
| ----------- | ------------------------------------------- | ------------------------------- |
| Title       | Trimmed, 5–120 characters                   | `Что вы хотите купить?`         |
| Description | Trimmed, 20–5000 characters                 | `Опишите товар подробнее`       |
| Budget      | `null` or integer from 0 to 999,999,999,999 | `Бюджет, ₸` / `Цена договорная` |
| Currency    | Server-controlled `KZT` only                | `₸`                             |
| Condition   | One of the six values below                 | `Желаемое состояние`            |
| Category    | Existing active category ID                 | `Категория`                     |
| City        | Existing active city ID                     | `Город`                         |

Whole-tenge budgets are the recommended MVP choice: Kazakhstan cash and
marketplace prices are normally expressed without fractional tenge, validation
is clearer, and the limit remains far above realistic marketplace budgets. The
PostgreSQL column can still support decimals later if product requirements
change.

Condition values:

| API value   | Russian label      |
| ----------- | ------------------ |
| `any`       | Любое              |
| `new`       | Новое              |
| `like_new`  | Как новое          |
| `good`      | Хорошее            |
| `fair`      | Удовлетворительное |
| `for_parts` | На запчасти        |

## Status lifecycle

| Status       | Public               | Meaning and allowed next action                                    |
| ------------ | -------------------- | ------------------------------------------------------------------ |
| `draft`      | No                   | Owner is still editing; can remain a draft or submit to moderation |
| `moderation` | No                   | Waiting for future moderator approval                              |
| `active`     | Yes, while unexpired | Moderator-approved; owner can edit, pause or close                 |
| `paused`     | No                   | Owner paused it; resume sends it back to moderation                |
| `closed`     | No                   | Owner finished or abandoned it; cannot be edited                   |
| `rejected`   | No                   | Future moderator rejection; owner may edit and resubmit            |
| `expired`    | No                   | Expiration process marked it finished; cannot be edited            |

An owner cannot set `active`, `rejected` or `expired` through the ads API.
Moderation will control the first two in Batch 9; automated expiration is a
later reliability task. Even before that job exists, the public query excludes
an active row whose `expiresAt` timestamp has passed.

Editing active, paused or already-moderating content results in `moderation`, so
unreviewed changes cannot remain visible. Closing is idempotent.

## Pagination and filtering

Both public and owner lists use opaque keyset cursors ordered by creation time
and ID. The default page contains 20 ads and the maximum is 50. A response is:

```json
{
  "items": [],
  "nextCursor": null
}
```

Clients pass `nextCursor` back unchanged. They must not construct it or use page
numbers. Public filters currently support category, city and condition; Batch 7
will add search, budget and date filters.

The migration adds matching PostgreSQL indexes for public status pagination,
owner pagination, owner-and-status pagination, and category/city feed queries.

## Rate limits

- Public and owner reads: 120 requests per minute per API instance and IP.
- Create: 10 requests per hour.
- Update, pause, resume and close: 30 requests per hour per route.

These are conservative beta defaults. They use the same in-memory local limiter
as authentication and must move to shared Redis before multi-instance hosting.
