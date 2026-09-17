# SwipeWise Merchant & Location Integration v1 — Google Places Provider

## Status

This build changes the Chat 07 primary merchant discovery provider from TomTom to **Google Places API (New)** while preserving the existing privacy, normalization, manual fallback, MCC uncertainty, network acceptance, and Recommendation Engine contracts.

## Provider architecture

```text
Expo / React Native
  -> authenticated Supabase Edge Function: merchant-search
  -> Google Places API (New)
```

Server secret:

`GOOGLE_PLACES_API_KEY`

The key never belongs in Expo `.env`.

## Google endpoints

Nearby merchant discovery:

`POST https://places.googleapis.com/v1/places:searchNearby`

Location-biased merchant text search:

`POST https://places.googleapis.com/v1/places:searchText`

The Edge Function uses a narrow field mask for ID, display name, formatted address, location, primary type and types.

## In Store flow

```text
User explicitly chooses In Store
  -> Find Nearby Stores
  -> foreground permission / foreground coordinates
  -> Supabase merchant-search
  -> Google Nearby Search
  -> deterministic normalization
  -> ordered candidates
  -> USER chooses merchant
  -> merchant-specific purchase purpose
  -> deterministic Recommendation Engine
```

GPS never decides In Store vs Online.

## Location denied/unavailable

SwipeWise remains usable:

```text
In Store
  -> Search Merchant
  -> SwipeWise local merchant catalog
  -> or Enter Merchant Manually
  -> purchase category
  -> Recommendation Engine
```

When foreground coordinates are not available, the app intentionally does not perform server-IP-biased Google Text Search. This prevents a Supabase server location from being mistaken for the user's location.

## Online flow

Online merchant search remains independent of location and uses the SwipeWise online merchant catalog plus manual entry.

Google Places is not needed to identify Amazon.ca, Air Canada, Best Buy online, etc. in the approved V1 online flow.

## Merchant normalization

Google result examples may normalize to SwipeWise canonical identities:

- `Costco Wholesale #1234` -> `costco` / `Costco`
- `Shell Station #98` -> `shell` / `Shell`

For known merchants, SwipeWise uses its own canonical merchant identity for recommendation/purchase persistence.

For unknown/provider-only Google results, the user must confirm/edit the merchant name before continuing. This keeps durable purchase data based on a user-confirmed merchant name rather than silently persisting provider content.

## MCC/category evidence

Google place types are discovery hints only.

They are never automatically promoted into:

- payment-network MCC
- issuer reward category certainty
- guaranteed transaction classification

MCC evidence remains `VERIFIED`, `LIKELY`, or `UNKNOWN` based on SwipeWise financial evidence, not Google POI type alone.

## Network acceptance

Google Places does not determine whether Visa, Mastercard, or American Express is accepted for SwipeWise recommendation purposes.

Acceptance remains a separate SwipeWise evidence model and is passed to the Recommendation Engine only when verified.

## Distance/confidence

Google Nearby Search can rank by distance. The Edge Function also calculates straight-line distance from the user's transient foreground coordinates to each returned place coordinate.

SwipeWise deterministic ordering still considers:

1. distance band
2. recognized canonical merchant identity
3. provider score if one exists
4. exact distance tie-break

The user always selects the merchant; SwipeWise does not silently pick the closest result.

## Privacy

- foreground-only location
- no background tracking
- no raw coordinate persistence in purchases or recommendations
- no coordinate analytics
- provider key server-side only
- no wallet/card/amount/reward-history data sent to Google
- no provider-result cache in the mobile merchant provider service

## Google Maps attribution

When Google Places content is displayed without a Google Map, the UI displays the exact text:

`Google Maps`

using the required text-attribution treatment (normal weight, 12sp, legible contrast) near the Google-derived merchant results.

## Google Places content storage

Google Places has restrictions on caching/storage of Places content. This build therefore:

- does not cache Google provider results in the merchant provider service
- does not write raw Google addresses/coordinates to purchase history
- normalizes known merchants to SwipeWise canonical identities
- requires manual confirmation for unknown/provider-only merchant names

Review current Google Maps Platform terms/policies again before production launch.

## Tests

Automated suites:

```bash
npm run test:engine
npm run test:merchant
```

Expected:

- Engine: 28/28
- Merchant Context: 15/15

Live GPS/Google provider behavior requires physical-iPhone QA after provider deployment.
