# Doska product brief

## Purpose

Doska is a Russian-language reverse marketplace for Kazakhstan. A buyer posts
what they want to purchase, and people who have that item respond with offers.
The buyer and an offer sender can then communicate in private chat.

The first beta uses fake/test data only. It is not a public marketplace and
must not be used for real sensitive personal data, real payments, or real
transactions.

## Launch decisions

| Area | Decision |
| --- | --- |
| Coverage | All Kazakhstan cities, represented by a maintained city list |
| Language | Russian only |
| Minimum age | 16 (provisional; legal review is required before public launch) |
| Login | Email and password only |
| Beta data | Fake/test data only |
| Hosting | One CIS-wide deployment for testing only |
| Currency | KZT; final budget precision will be confirmed in Batch 5 |
| Initial categories | Electronics; Phones and Computers; Auto; Home and Furniture; Clothing; Children; Sports and Hobbies; Services |

The one-deployment decision is an early-beta shortcut. Before any real-user
launch, the data-location and cross-border processing model must be reviewed
for Kazakhstan and every intended country.

## MVP

### People and contextual roles

Every user has one ordinary account. Their role depends on the action:

- **Ad owner:** publishes and manages a request to buy an item.
- **Offer sender:** responds to another user's request with an offer.

A person can be both roles at different times. There are no seller-only or
buyer-only accounts.

### Included in the MVP

- Email/password registration, sign-in, session management and account deletion.
- A profile with nickname, selected city and language.
- Create, edit, pause and close a request-to-buy ad.
- Browse and search active ads by category, city, budget and condition.
- Send, withdraw, accept or reject an offer.
- Private text chat between valid offer participants.
- Favorites, blocking, reporting and basic moderation.
- Admin review tools and an audit trail for admin actions.

### Explicitly deferred

The following are not part of the MVP:

- Photos and other uploads.
- Delivery, shipment tracking or pickup coordination.
- Escrow, payments, refunds, wallet balances and paid boosts.
- Ratings, reviews, reputation scores or identity verification.
- Phone-number login, social login and public profiles.
- Automated AI moderation decisions; early moderation remains reviewable by a human.
- A public real-user release outside the tested legal and safety model.

## Core flows

### 1. Register and set up a profile

1. A user registers with an email address and password.
2. They choose a nickname and city, then see the feed.
3. They can sign out, change password or request account deletion.

### 2. Create an ad

1. The ad owner chooses a category and city.
2. They describe the item wanted, desired condition and KZT budget.
3. The ad is saved as a draft or sent to moderation.
4. Once allowed, it appears in the public feed as active.

### 3. Browse and offer

1. An offer sender searches or filters active ads.
2. They open an ad and send one offer describing the item and proposed price.
3. The ad owner reviews the offer and accepts or rejects it.

### 4. Chat and close

1. A valid offer creates a chat for the ad owner and offer sender.
2. The participants exchange text messages and may block or report each other.
3. The ad owner closes the ad when the request is no longer open.

### 5. Report

1. A user reports an ad, offer or participant with a reason.
2. The report enters a moderation queue.
3. An administrator can hide, reject or restore content and the action is recorded.

## Single end-to-end scenario

```text
Test user A registers
  -> creates “Куплю iPhone 15” in Almaty
  -> ad is approved and becomes active
  -> test user B finds it and sends an offer
  -> A accepts the offer
  -> A and B exchange messages in their private chat
  -> A closes the ad
  -> either user can report or block the other if needed
```

## Safety, privacy and quality boundaries

- Public lists use cursor pagination; clients must never download all ads.
- Registration, login, ads, offers and messages have server-side rate limits.
- Authorization is enforced on every private resource; users cannot edit another
  person's ad or read another chat.
- Account deletion closes active ads and removes or anonymizes personal data
  according to a documented retention policy.
- Passwords, tokens and private message bodies are never written to logs.
- Admin actions are recorded with actor, action, target and timestamp in audit logs.
- Users can block other users and report unsafe, prohibited or abusive content.
- Image binaries will eventually use object storage, not PostgreSQL; uploads are
  deferred from the MVP.
- No real payment, escrow or delivery promise is made by the beta product.

## Before a real-user release

- Obtain legal review for age policy, privacy policy, prohibited items, data
  retention and cross-border processing.
- Define moderators, escalation rules, report reasons and response times.
- Add approved terms, privacy notice and community rules.
- Verify backup/restore, incident response and production access restrictions.
