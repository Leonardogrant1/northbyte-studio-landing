# RevenueCat Webhook Integration — Design Spec

**Date:** 2026-05-15  
**Status:** Approved

## Overview

Replace the current model where individual app backends call `/api/affiliate/referral/update` with a single RevenueCat webhook endpoint in this admin backend. RevenueCat sends all purchase events for all apps to one URL; we resolve the app via stored RevenueCat App IDs and update affiliate referrals accordingly.

The `/api/affiliate/track` endpoint remains unchanged — it is called directly by app clients when a user enters an affiliate code.

---

## Schema Changes

### `apps` table

Add two optional fields and their indexes:

```ts
revenueCatAppStoreId:  v.optional(v.string())   // RC App ID for App Store variant
revenueCatPlayStoreId: v.optional(v.string())   // RC App ID for Play Store variant
```

Indexes:
- `by_rc_appstore_id` on `["revenueCatAppStoreId"]`
- `by_rc_playstore_id` on `["revenueCatPlayStoreId"]`

These are public, non-secret identifiers — safe to store in plain text.

### `affiliate_referral` table

Add two optional fields to capture purchase context:

```ts
countryCode: v.optional(v.string())   // ISO 3166-1 alpha-2, e.g. "GB", "DE"
store:       v.optional(v.string())   // "APP_STORE" | "PLAY_STORE" | "STRIPE"
```

Existing records are unaffected (all optional).

---

## New Convex Mutation: `handleRevenueCatEvent`

**File:** `convex/affiliate_referral/mutations.ts` (new export added to existing file)

### Args

| Field | Type | Source in RC event |
|---|---|---|
| `rcAppId` | `string` | `event.app_id` |
| `appUserId` | `string` | `event.app_user_id` (used as `revenueCatUserId` for lookup) |
| `event` | `eventType` | `event.type` |
| `productId` | `string?` | `event.product_id` |
| `transactionId` | `string?` | `event.transaction_id` (stored as `subscriptionId`) |
| `price` | `number?` | `event.price` |
| `currency` | `string?` | `event.currency` |
| `countryCode` | `string?` | `event.country_code` |
| `store` | `string?` | `event.store` |

### Logic

1. **App lookup:** Query `apps` by `revenueCatAppStoreId` or `revenueCatPlayStoreId` matching `rcAppId`. If no app found → throw error (misconfiguration).
2. **Referral lookup:** Query `affiliate_referral` via `by_rc_user` index (`revenueCatUserId == appUserId`) filtered by `appId`. If no referral found → return `null` silently (purchase not from an affiliate link).
3. **Event handling** (idempotent per event type):
   - `INITIAL_PURCHASE`: set `status: "converted"`, `convertedAt`, `productId`, `subscriptionId`, `price`, `currency`, `countryCode`, `store`
   - `CANCELLATION`: set `status: "cancelled"`, `cancelledAt`
   - `UNCANCELLATION`: set `status: "converted"`, `uncancelledAt`
   - `REFUND`: set `status: "refunded"`, `refundedAt`
4. Idempotency: if the relevant timestamp field is already set, return `null` (no-op).

---

## New API Route: `/api/affiliate/revenue-cat`

**File:** `src/app/api/affiliate/revenue-cat/route.ts`

### Auth

RevenueCat sends an `Authorization` header with a configurable value. Validate against env var `REVENUE_CAT_WEBHOOK_SECRET`. Return `401` on mismatch.

### Event Filtering

Only process: `INITIAL_PURCHASE`, `CANCELLATION`, `UNCANCELLATION`, `REFUND`.

All other event types (e.g. `RENEWAL`, `PRODUCT_CHANGE`, `EXPIRATION`) → return `200 OK` immediately with no action. RevenueCat retries on non-2xx responses, so always return 2xx.

### Request Flow

```
POST /api/affiliate/revenue-cat
  1. Validate Authorization header → 401 if invalid
  2. Parse event body
  3. If event.type not in handled set → 200 OK (ignored)
  4. Call handleRevenueCatEvent with mapped fields
  5. 200 OK
```

### Error Handling

- App not found (misconfigured RC app ID): `500` — this needs attention
- Referral not found: `200` — silent ignore, not every purchase is from an affiliate
- Convex mutation errors: `500`

---

## New Environment Variable

| Variable | Description |
|---|---|
| `REVENUE_CAT_WEBHOOK_SECRET` | Authorization header value configured in the RevenueCat dashboard webhook settings |

---

## What Stays Unchanged

- `/api/affiliate/track` — still called by app clients when user enters affiliate code
- `/api/affiliate/referral/update` — kept as-is; external backends may still use it during transition
- `handleUpdate` mutation — untouched
