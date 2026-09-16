# Chat 10 — Merchant & Location Integration v1 Physical-iPhone QA

Use build: `03 - SwipeWise_Expo_Merchant_Location_V1.zip`

Preconditions:
- Supabase client env values configured.
- `merchant-search` Edge Function deployed with JWT verification.
- `TOMTOM_API_KEY` set only as a Supabase secret.
- Test account authenticated and wallet populated.

## A. Location permission

1. Fresh install/permission not determined: open app. Confirm no location prompt at launch.
2. Quick Swipe -> In Store. Confirm no prompt merely from choosing In Store.
3. Tap Find Nearby Stores. Confirm foreground/when-in-use prompt appears.
4. Allow: nearby flow continues.
5. Deny: Quick Swipe remains usable and shows Search Merchant / Enter Merchant Manually.
6. Previously denied: repeat; app must not block/crash.
7. Disable Location Services or force a location error: manual fallback remains available.
8. Confirm app never asks for background/always location.

## B. Nearby stores

Test a location with:
- one obvious candidate;
- two close stores;
- several stores;
- no useful stores.

Expected:
- candidate name/distance/address shown when supplied;
- closest store is not auto-selected;
- user can deliberately choose a non-closest store;
- no results/provider failure offers manual search/entry.

## C. Purchase intent isolation

While physically at/near Costco:
1. Quick Swipe.
2. Choose Online.
3. Search Amazon.
4. Select an Amazon purchase type.
5. Continue to recommendation.

Expected: online flow remains valid; GPS/Costco never changes the purchase mode or merchant to Costco.

## D. Manual search without location

1. Deny location.
2. In Store -> Search Merchant.
3. Search Best Buy or another known catalog merchant.
4. Select it and continue.

Expected: normalized merchant flows into recommendation with no GPS dependency.

## E. Unknown manual merchant

1. In Store -> Enter Merchant Manually.
2. Enter `Local Electronics Shop`.
3. Choose Electronics.
4. Continue.

Expected:
- exact merchant name remains visible and is saved if purchase is logged;
- MCC shown/treated as unknown;
- network acceptance shown/treated as unknown;
- no fabricated category/MCC/acceptance evidence.

## F. Online search — SW-BUG-017

Search separately for:
- Amazon
- Best Buy
- Air Canada
- unknown online merchant

Expected: known merchants normalize; unknown merchant can be entered manually; location is never requested.

## G. Other / Enter Manually — SW-BUG-018

Run both In Store and Online manual flows with a unique name such as `QA Merchant 2026`.

Expected: merchant name is not replaced by `Other Merchant` or `Other`; it survives category -> recommendation -> optional purchase save -> History/Purchase Details.

## H. Normalization

Verify provider/manual examples where possible:
- `Costco Wholesale #123` -> display/canonical `Costco`, while provider/original metadata remains on normalized context.
- `Shell Station #...` -> canonical `Shell`.

## I. Network acceptance

Costco Canada in-store:
- known accepted Mastercard remains eligible;
- known unsupported Visa/Amex card cannot win because verified Costco in-store acceptance is Mastercard only.

Unknown merchant:
- acceptance is unknown;
- engine warns `ACCEPTANCE_UNKNOWN` rather than silently accepting/excluding every network.

Costco.ca / Online Costco:
- current verified context carries Mastercard + Visa.

## J. Recommendation regression

Run:

```bash
npm run test:engine
npm run test:merchant
```

Expected:
- Recommendation Engine: 28/28.
- Merchant context: 15/15.

Do not change existing expected engine winners without verified financial-data justification.

## K. Privacy inspection

Confirm in Supabase purchase rows and app logs:
- no raw latitude/longitude;
- no TomTom API key;
- no location trail;
- no provider request containing wallet, amount, card ownership, recommendation result, email, or user ID.

## QA completion decision

Pass Chat 07 only after physical-iPhone foreground permission, real nearby provider response, provider failure fallback, manual flows, online flow, Costco acceptance behavior, purchase persistence, and both automated suites pass.
