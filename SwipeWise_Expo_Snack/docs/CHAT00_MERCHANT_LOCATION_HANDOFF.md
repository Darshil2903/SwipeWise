# Chat 00 Milestone Handoff — Merchant & Location Integration v1

## Build
`03 - SwipeWise_Expo_Merchant_Location_V1.zip`

## What was built
- Foreground-only location path after explicit In Store selection.
- Production-capable nearby POI discovery through authenticated Supabase Edge Function.
- TomTom Search API v2 provider adapter.
- Deterministic nearby ordering with explicit user selection; no closest-store auto-selection.
- Local/manual fallback for denied location, provider failure, no results and unknown merchants.
- Merchant normalization catalog with aliases, canonical keys, source metadata, evidence states and merchant-specific categories.
- Conservative MCC and card-network acceptance evidence handling.
- Online merchant search.
- Real manual merchant-name capture/preservation.
- 60-second memory-only nearby cache.
- Automated merchant-context tests.

## Provider selected
TomTom Search API v2 behind Supabase Edge Function, with manual/local fallback. Orbis Places should be re-evaluated after its Search API exits Public Preview.

## Merchant normalization status
Implemented for V1 catalog plus provider-only/manual unknown states. Costco/Shell alias cases are tested. Provider POI categories are not treated as transaction MCC proof.

## SW-BUG status
- SW-BUG-017 Online merchant search missing: **FIXED IN BUILD / PENDING CHAT 10 LIVE QA**.
- SW-BUG-018 Other/manual merchant name lost: **FIXED IN BUILD / PENDING CHAT 10 LIVE QA**.

## Security implications
- New foreground location permission dependency.
- New Supabase Edge Function and server-side `TOMTOM_API_KEY` secret.
- No DB migration.
- No raw coordinate persistence in normal user history.
- No private key in Expo.

## Cost implications
TomTom currently includes 2,500 Search API requests/month free. Above-free pricing should be confirmed using TomTom's current calculator/plan before scale. 60-second memory cache reduces immediate duplicate nearby calls.

## QA status
Automated:
- Recommendation Engine regression: 28/28 passed.
- Merchant context: 15/15 passed.
- App/new module syntax parsed successfully.

Not performed here:
- physical-iPhone GPS permission flow;
- live TomTom call with production credential;
- deployed Edge Function end-to-end test.

## Next blocker/dependency
Chat 10 must deploy/configure the provider path and run the physical-iPhone QA matrix. Chat 08 should review the new Edge Function/credential/location privacy path before production release.
