# Push notifications and reliability

Batch 10 uses a PostgreSQL outbox so marketplace actions do not call the push provider directly. Creating an offer, sending a message or changing moderation status commits the action and a deduplicated notification job in the same database transaction. A provider failure therefore cannot roll back the user action.

## Notification events

| Event                       | Recipient              | Push text                                    | Private content               |
| --------------------------- | ---------------------- | -------------------------------------------- | ----------------------------- |
| New offer                   | Ad owner               | “К вашему объявлению отправили предложение.” | No offer description or price |
| New message                 | Other chat participant | “У вас новое сообщение в Doska.”             | No message body               |
| Moderation result           | Ad owner               | Publication/status result                    | No moderation note            |
| Ad expiring within 24 hours | Ad owner               | Reminder to check the ad                     | No ad description             |

Notifications include only internal IDs and an app route needed for navigation. Passwords, access/refresh tokens, report details, offer descriptions and message bodies are never stored in notification jobs or logged by the worker.

## Delivery behavior

- A unique deduplication key prevents the same event being queued twice.
- Jobs are claimed with a five-minute lease so an interrupted worker can recover them.
- Failed delivery retries with exponential delays of 1, 2, 4, 8 and 16 minutes, up to five attempts.
- A token rejected as `DeviceNotRegistered` is disabled automatically.
- Jobs with no enabled device token are completed without affecting the marketplace action.
- The API process runs the worker every 15 seconds and scans hourly for active ads expiring in the next 24 hours.

The fake beta currently sends notifications immediately and has no quiet hours. Decide the final quiet-hours policy before real-user testing.

## API routes

- `POST /account/device-tokens` registers or refreshes an authenticated user’s Expo token.
- `DELETE /account/device-tokens/:id` removes only a token owned by the authenticated user.
- `GET /health/live` proves the process is running.
- `GET /health/ready` checks the database dependency before declaring the API ready.

Every response includes an `x-request-id` header. Error responses also include the same `requestId` in JSON. Logs are structured JSON and redact authorization headers, passwords, refresh tokens, device tokens, message bodies, descriptions and report details.

## Expo/EAS action required

Remote push notifications require an Expo account, an EAS project linked to this app and a development build. A physical device is recommended; a compatible Android emulator with Google Play services can also receive pushes. They are not required for the automated API tests.

1. Create or open the Expo project for the `doska` slug and `com.doska.app` identifiers.
2. Copy its EAS project UUID into the untracked `apps/mobile/.env` file:

   ```env
   EXPO_PUBLIC_EAS_PROJECT_ID=your-project-uuid
   ```

3. Configure Android/iOS push credentials in Expo without adding credential files or access tokens to Git.
4. Produce and install an EAS development build on a physical phone.
5. Sign in, allow notifications and test the four events with fake accounts.

An optional Expo enhanced-security access token belongs only in the API environment or secret manager as `EXPO_ACCESS_TOKEN`. Never put it in the mobile app or commit it.

## Manual test

1. Sign in on two physical-device development builds with two fake accounts.
2. Create and approve an ad for the first account.
3. Send an offer from the second account and confirm the first receives a generic notification.
4. Send a chat message and confirm the notification does not reveal its text.
5. Reject or approve a submitted ad from the admin panel and confirm the owner receives the result.
6. Temporarily set an active fake ad to expire within 24 hours and confirm one reminder is queued, not duplicates.
