# Offers and chat

Batch 8 adds the first seller-to-buyer negotiation flow. A chat is created only
inside the same transaction as a valid offer. For the initial beta, both people
can chat while the offer is pending; acceptance is not required to begin the
conversation.

## Offer routes

| Method | Route                  | Purpose                                    |
| ------ | ---------------------- | ------------------------------------------ |
| POST   | `/ads/:id/offers`      | Send one offer and create its chat         |
| GET    | `/account/offers`      | List offers sent by the authenticated user |
| GET    | `/ads/:id/offers`      | List offers received by that ad's owner    |
| POST   | `/offers/:id/accept`   | Accept a pending offer as the ad owner     |
| POST   | `/offers/:id/reject`   | Reject a pending offer as the ad owner     |
| POST   | `/offers/:id/withdraw` | Withdraw a pending offer as its sender     |

Only active, unexpired ads accept offers. An ad owner cannot offer on their own
ad, and the database unique constraint prevents a sender from creating more
than one offer for the same ad. Accepting one offer rejects the other pending
offers for that ad.

Prices are optional whole-tenge amounts. Offer descriptions contain 5–1000
characters when supplied. Clients cannot choose the currency; it remains KZT.

## Chat routes and real-time events

| Method | Route                 | Purpose                                     |
| ------ | --------------------- | ------------------------------------------- |
| GET    | `/chats`              | List chats, last messages and unread counts |
| GET    | `/chats/:id/messages` | Read a cursor-paginated message page        |
| POST   | `/chats/:id/messages` | Send through the HTTP fallback              |
| POST   | `/chats/:id/read`     | Mark received messages as read              |

Socket.IO authenticates with the access token in `handshake.auth.token` and
supports these client events:

- `chat:join` with `{ id }`
- `message:send` with `{ id, body }`
- `chat:read` with `{ id }`

The server emits `message:new` only to the authorized chat room and emits
`chat:read` to the other participant. Both Socket.IO joins and HTTP message
reads derive participants from the offer: the seller is the offer sender and
the buyer is the ad owner. Other users receive the same not-found response as a
missing chat.

Messages contain 1–2000 characters. HTTP and Socket.IO sending are limited to
30 messages per minute per API instance/user. The local limiter must move to
shared Redis before the API runs as multiple instances.

## Blocking

`PUT /account/blocks/:userId` blocks a user and
`DELETE /account/blocks/:userId` removes the block. A block in either direction
prevents new offers between the pair and prevents either participant from
sending further chat messages. Existing conversation history remains visible
for safety and dispute context.

## Manual two-account check

1. Start Docker, the API and the mobile web app.
2. Log in as a seller in one browser profile and send an offer on a seeded demo ad.
3. Log in as the demo buyer in a private window and open “Мои объявления”.
4. Open the received offer, exchange messages, then accept or reject it.
5. Confirm the unread badge changes and blocking prevents another message.

Use only disposable fake accounts and content during the beta.
