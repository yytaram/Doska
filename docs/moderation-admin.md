# Moderation, reports and admin panel

Batch 9 adds a staff-only moderation workflow. It is suitable for fake-data local testing, not for real-user moderation until the prohibited-items policy and report reasons have legal review.

## Local setup

Create an ordinary fake account in the mobile app first. Grant that account the admin role from the project folder:

```powershell
pnpm --filter @doska/api admin:grant -- admin@example.test
```

This local bootstrap command changes the role, revokes existing sessions and writes an audit event. Sign in again afterward.

Start the API and admin panel in separate terminals:

```powershell
pnpm api:dev
pnpm admin:dev
```

Open `http://localhost:3001`. The API remains at `http://localhost:3000`.

## Roles and authorization

- `USER` accounts cannot access any `/admin/*` route.
- `MODERATOR` accounts can review ads and reports and maintain moderation terms.
- `ADMIN` accounts can also suspend/restore users and maintain categories.
- Staff role is reloaded from the database for every authenticated request. It is not trusted from browser state.
- Admin browser tokens are kept in session storage. Access tokens expire normally.

## Text moderation

Before matching, text is Unicode-normalized, lowercased for Russian, `ё` is converted to `е`, punctuation becomes spaces and repeated spaces are collapsed. Matching uses whole normalized phrases.

- A `review` term records evidence and keeps a submitted ad in `moderation`.
- A `block` term records evidence and immediately moves a submitted ad to `rejected`.
- Drafts may contain matches but are not rejected until submitted.
- Editing an active or paused ad sends it back through moderation.

No real prohibited-term list is seeded. Staff must add only legally reviewed terms in the admin panel. This avoids presenting an improvised list as policy.

## Reports and actions

Authenticated users can submit an ad, user or offer report through `POST /reports`. The mobile ad page includes an ad-report form. Report reason remains free text for the fake beta; replace it with legally reviewed reason codes before real-user launch.

Staff can approve, reject, hide or restore ads; review reports; suspend or restore users; and maintain categories and moderation terms. Every staff mutation creates an `audit_logs` record with the actor, action, entity and relevant non-secret metadata. Hiding from a report creates both an ad-hide event and a report-review event.

## Manual acceptance check

1. Sign in to the admin panel with the fake admin account.
2. Add a temporary `review` term.
3. Submit a fake ad containing that term from the mobile app.
4. Open **Объявления**, approve or reject it, and refresh.
5. From a second fake account, report an active ad.
6. Open **Жалобы**, choose **Скрыть и закрыть**, and confirm the ad disappears from the public feed.
7. Deactivate the temporary term when finished.
