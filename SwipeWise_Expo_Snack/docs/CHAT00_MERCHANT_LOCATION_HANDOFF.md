# Chat 00 Handoff — Chat 07 Google Places Provider Revision

## Build

`03A - SwipeWise_Expo_Google_Places_Merchant_Location_V1.zip`

## Change from prior Chat 07 build

The merchant provider has been switched from TomTom Search API v2 to **Google Places API (New)** before production/live QA.

## Preserved Chat 07 architecture

- explicit In Store / Online intent
- foreground-only location
- manual fallback
- deterministic merchant normalization
- ambiguity/user-selection rule
- MCC uncertainty model
- verified network-acceptance model
- SW-BUG-017 fix
- SW-BUG-018 fix
- Recommendation Engine contract

## Google implementation

- Nearby Search (New) via Supabase Edge Function
- Text Search (New) only when foreground coordinates are available
- server secret: `GOOGLE_PLACES_API_KEY`
- API key never enters Expo
- minimal Google field mask
- straight-line distance calculated by Edge Function
- Google Maps attribution displayed with Google-derived results
- provider-result caching removed to respect Google Places content rules
- unknown/provider-only Google merchant requires user confirmation before durable use

## Database changes

None.

## Dependency changes

No additional dependency beyond the already-added `expo-location ~19.0.8`.

## QA state

Automated engine and merchant-context tests must be run from the final ZIP. Live Google Places + physical iPhone testing remains a Chat 10 responsibility.

## Next action

Deploy/configure Google Places provider, then send this build to Chat 10 for physical-device/live-provider QA and Chat 08 for security validation.
