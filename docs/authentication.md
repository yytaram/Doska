# Authentication and account lifecycle

Doska's beta authentication is email and password only. Phone-number and social
login remain deferred.

## API routes

| Method   | Route               | Purpose                                          | Authentication                         |
| -------- | ------------------- | ------------------------------------------------ | -------------------------------------- |
| `GET`    | `/reference/cities` | List active cities for profile setup             | Public                                 |
| `POST`   | `/auth/register`    | Create an account, profile and first session     | Public, rate-limited                   |
| `POST`   | `/auth/login`       | Verify credentials and create a session          | Public, rate-limited                   |
| `POST`   | `/auth/refresh`     | Rotate a refresh token and issue new tokens      | Refresh token, rate-limited            |
| `POST`   | `/auth/logout`      | Revoke the session identified by a refresh token | Refresh token                          |
| `GET`    | `/auth/me`          | Return the current account and profile           | Bearer access token                    |
| `PUT`    | `/account/profile`  | Create or update nickname, city and language     | Bearer access token                    |
| `POST`   | `/account/password` | Change password and revoke every session         | Bearer access token + current password |
| `DELETE` | `/account`          | Delete/anonymize the account                     | Bearer access token + current password |

Registration requires acceptance of the provisional 16+ beta rule. Passwords
must contain 12–128 characters. The current Russian-only profile language is
`ru`.

## Token and password safety

- Passwords use Argon2id with 19 MiB memory, two iterations and one degree of
  parallelism. This matches the minimum configuration in the OWASP Password
  Storage Cheat Sheet.
- Access tokens are HS256 JWTs that expire after 15 minutes by default. They
  contain only the user ID, session ID and account authentication version.
- Refresh tokens are 256-bit random opaque values. PostgreSQL stores only their
  SHA-256 hashes, never the usable tokens.
- Each successful refresh revokes the previous token and creates a linked new
  session. Reusing the old token is rejected.
- Logout revokes the associated session immediately. Private routes check the
  session on every request, so its access token is rejected immediately too.
- Changing a password revokes every session and increments the authentication
  version. The user must sign in again.
- Passwords, refresh tokens and authorization headers are explicitly redacted
  from API logs. Integration tests capture logs and verify the credentials do
  not appear.
- Authentication responses use generic invalid-credential errors so login does
  not reveal whether an email is registered.

Production must provide a unique `JWT_SECRET` of at least 32 characters. The
checked-in value is only a local-development placeholder, and configuration
validation rejects it when `NODE_ENV=production`.

References:

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Official Fastify JWT plugin](https://github.com/fastify/fastify-jwt)
- [Official node-argon2 implementation](https://github.com/ranisalt/node-argon2)

## Account deletion policy for the fake-data beta

Deletion is immediate and transactional:

- the email is replaced with an internal `@deleted.invalid` address;
- the password hash is replaced, the account is marked `DELETED`, and all
  sessions and device tokens are removed;
- the profile, favorites and block relationships are deleted;
- the user's ads are closed and their title, description and budget are erased;
- offers sent by the user are withdrawn and their description and price erased;
- free-text details on reports submitted by the user are erased;
- minimal IDs, timestamps, status records and audit events remain so database
  relationships and moderation history stay internally consistent.

Deleted accounts cannot sign in or use an old access or refresh token. Closed,
anonymized ads must not appear in a public feed when the ads API is added.

This is a technical beta policy for fake data, not an approved legal retention
policy. A Kazakhstan/CIS privacy review is still required before accepting real
users or personal data.
