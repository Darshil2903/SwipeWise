# Chat 08 Security Handoff — Merchant & Location Integration v1

## Location permission behavior
- Foreground/when-in-use only via `expo-location`.
- Requested only when user taps **Find Nearby Stores**.
- No background/continuous tracking.
- Denial/unavailable/error leaves manual merchant search and entry usable.

## Coordinate handling
- Foreground coordinates exist only in Quick Swipe component memory and provider request payloads.
- 60-second in-memory nearby cache only.
- No raw coordinates written to normal purchase history, recommendation history, AsyncStorage or analytics by Chat 07.
- Edge Function intentionally does not log coordinates/query payloads.

## Provider
- TomTom Search API v2 (`nearbySearch` and `poiSearch`).
- Country restricted to Canada in the Edge Function.

## Credential model
- `TOMTOM_API_KEY`: Supabase Edge Function secret only.
- Expo contains only existing client-safe Supabase URL/publishable-key variables.
- `.env` is excluded from the ZIP; `.env.example` contains placeholders only.
- No service-role key, provider secret, DB password or admin credential in Expo.

## Backend proxy
`Expo -> authenticated Supabase Edge Function merchant-search -> TomTom HTTPS API`

`supabase/config.toml` sets `verify_jwt = true` for `merchant-search`.

Input is bounded:
- action allowlist: nearby/search;
- radius 50–10,000 m;
- result limit 1–20;
- query max 120 characters;
- country set CA.

Response is minimized to place ID, score, distance, position, address and limited POI brand/category/classification hints.

## Data minimization
Not forwarded to TomTom:
- email;
- Supabase user ID;
- wallet/card ownership;
- amount;
- reward preference/history;
- recommendation result.

## Logging
Edge Function only logs generic provider HTTP status or generic request failure. It intentionally does not log coordinates, query strings, user IDs, wallet data or provider response bodies.

## MCC/category boundary
Provider POI category/classification hints are not treated as transaction MCC proof and are not promoted into financial merchant classifications for the engine.

## Network acceptance boundary
Only verified catalog acceptance is passed. Unknown acceptance remains null/unknown so the engine warns rather than fabricating eligibility.

## Supabase objects/functions
Added:
- Edge Function: `merchant-search`
- Function config: JWT verification enabled.

No database tables, columns, RLS policies, triggers, storage buckets, or service-role use were added.

## Review focus
Chat 08 should verify:
- deployed function really requires authenticated JWT;
- TomTom secret is absent from client bundle/build logs;
- no request-body logging at Supabase infrastructure/custom logging layer;
- CORS/auth policy is acceptable for the production mobile client;
- rate limiting/abuse controls are sufficient before public launch;
- privacy policy disclosure matches actual foreground-location/provider processing.
