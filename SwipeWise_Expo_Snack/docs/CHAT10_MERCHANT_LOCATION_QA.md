# Chat 10 QA Handoff — Google Places Merchant & Location Integration

## Pre-flight

- Places API (New) enabled in Google Cloud.
- Billing configured for Google Maps Platform.
- Google API key restricted to Places API (New).
- `GOOGLE_PLACES_API_KEY` set only as a Supabase Edge Function secret.
- `merchant-search` deployed.
- Expo started with `npx expo start -c`.

## Automated regression

```bash
npm run test:engine
npm run test:merchant
```

Expected:

- 28/28 engine
- 15/15 merchant context

## Location permission

Test on physical iPhone:

1. Not determined -> tap Find Nearby Stores -> allow while using app.
2. Deny -> verify manual Search Merchant / Enter Manually still works.
3. Previously denied -> verify app does not block Quick Swipe.
4. Location unavailable/error -> verify manual fallback.

## Nearby stores

Test:

- single strong candidate
- two close businesses
- several businesses
- no useful businesses
- deliberately choose a non-closest business

Expected:

- no merchant auto-selected
- distance/confidence visible where available
- `Google Maps` attribution visible

## Intent regression

Physical test:

User is physically at Costco -> Quick Swipe -> chooses **Online** -> Amazon.

Expected: online flow remains valid and GPS does not override intent.

## Search Merchant

With location granted, type examples such as:

- Costco
- Shell
- Shoppers Drug Mart
- Best Buy

Expected: Google-derived physical results may appear, clearly attributed.

With location denied, known catalog search and manual entry must still work without Google.

## Provider-only unknown merchant

Choose an unknown Google result.

Expected: app opens the manual confirmation screen with the merchant name prefilled; user must confirm/edit before continuing. No fake MCC or network acceptance is introduced.

## Online search

Test:

- Amazon
- Best Buy
- Air Canada
- unknown online merchant/manual flow

Location must not be requested.

## SW-BUG-017

Confirm online merchant search works and no longer behaves as a fixed-only merchant list.

## SW-BUG-018

Use Other / Enter Manually and enter a custom merchant. Verify exact confirmed merchant name survives recommendation and purchase history.

## Merchant normalization

Verify examples:

- Costco Wholesale #... -> Costco
- Shell Station... -> Shell

without silently turning Google types into financial MCC evidence.

## Network acceptance

Test:

- known accepted
- known not accepted
- unknown

Known unsupported network must not win. Unknown acceptance warns instead of being assumed.

## Provider failure

Temporarily invalidate/disable provider configuration in a safe test environment.

Expected: non-2xx provider error is shown/falls back; app does not invent nearby stores.

## Privacy inspection

Verify Supabase purchase rows contain no:

- latitude
- longitude
- Google formatted address
- raw Google place result
- Google API key

Review Edge Function logs and confirm error logging does not include coordinates or query strings.
