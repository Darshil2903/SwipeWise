# SwipeWise — Expo + Supabase + Recommendation Engine + Google Places Merchant Context

This is the current SwipeWise Expo/React Native development build. It preserves the existing UI, authentication, navigation, Quick Swipe flow, wallet/history persistence, Light/Dark/System appearance, and deterministic Recommendation Engine while replacing the previous TomTom merchant provider with **Google Places API (New)** behind a Supabase Edge Function.

## Production-backed pieces in this build

- Supabase email/password authentication and persistent sessions
- RLS-isolated user profile, settings, wallet, and purchase history
- Verified card products, reward rules, and card benefits from Supabase
- Wallet-only deterministic recommendation ranking
- Explicit **In Store / Online** intent choice
- Foreground-only `expo-location`, requested only when the user taps **Find Nearby Stores**
- Google Places API (New) Nearby Search through authenticated Supabase Edge Function `merchant-search`
- Google Places API (New) Text Search only when foreground coordinates are already available
- Manual merchant search/entry fallback when location/provider is unavailable
- Deterministic merchant normalization into SwipeWise canonical merchant identities
- MCC/category uncertainty kept separate from Google place types
- Verified network acceptance passed to the engine only when SwipeWise has verified evidence
- SW-BUG-017 online merchant search flow
- SW-BUG-018 merchant-name preservation for manual entry
- Google Maps text attribution shown with Google-derived merchant results

## Important merchant-data rules

Google Places is a **discovery source**, not SwipeWise's financial truth.

- A Google place type is never treated as a guaranteed transaction MCC.
- Google does not decide card-network acceptance.
- The user still chooses the intended merchant.
- GPS never decides whether the purchase is In Store or Online.
- Raw user coordinates are not written to purchase/recommendation history or analytics.
- Google Places result content is not cached or durably stored by the merchant provider service.
- Known Google results are normalized to SwipeWise's own canonical merchant record before purchase persistence.
- Unknown/provider-only Google results require the user to confirm or edit the merchant name before continuing.

Google Places content has its own attribution and caching/storage requirements. Review the current Google Maps Platform terms before production release.

## Server-side provider secret

The mobile app must never contain the Google Places API key.

Set it only as a Supabase Edge Function secret:

```bash
npx supabase secrets set GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_PLACES_API_KEY
npx supabase functions deploy merchant-search
```

The Google Cloud project for that key must have **Places API (New)** enabled and billing configured. Restrict the key to the Places API (New) service.

## Client environment

Create `.env` from `.env.example`:

```text
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Do not put `GOOGLE_PLACES_API_KEY`, Supabase service-role keys, database passwords, or other server credentials in Expo environment files.

## Install and run

```bash
npm install
npx expo start -c
```

## Tests

```bash
npm run test
```

Expected in this build:

- Recommendation Engine: **28/28**
- Merchant Context: **15/15**

Physical-iPhone location and live Google Places calls still require real-device QA after the Edge Function and key are configured.

See:

- `SUPABASE_SETUP.md`
- `docs/MERCHANT_LOCATION_V1.md`
- `docs/CHAT10_MERCHANT_LOCATION_QA.md`
- `docs/CHAT08_MERCHANT_LOCATION_SECURITY.md`
- `docs/CHAT00_MERCHANT_LOCATION_HANDOFF.md`
