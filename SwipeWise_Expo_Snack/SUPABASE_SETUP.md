# SwipeWise Supabase Setup — Google Places Merchant Discovery

## 1. Existing SwipeWise backend

Use the existing SwipeWise development Supabase project containing the approved auth/profile/settings/wallet/purchase schema and verified Canadian card reference data.

Do not re-run `backend/demo_seed.sql` over the verified reference dataset.

## 2. Client-safe Expo variables

Create `.env` in the project root:

```text
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Only client-safe Supabase values belong in Expo.

Never add:

- `GOOGLE_PLACES_API_KEY`
- Supabase `service_role` / secret key
- database password
- JWT signing secret

## 3. Create a Google Cloud Places API key

In Google Cloud Console:

1. Create or select the Google Cloud project for SwipeWise.
2. Attach a billing account as required by Google Maps Platform.
3. Enable **Places API (New)**.
4. Create an API key.
5. Restrict the key under **API restrictions** to **Places API (New)**.
6. Do not copy this key into Expo `.env`.

The key is used only by the Supabase Edge Function.

## 4. Log into and link Supabase CLI

From the `swipewise_expo` project folder:

```bash
npx supabase login
npx supabase projects list
npx supabase link --project-ref YOUR_PROJECT_REF
```

Your project ref is the subdomain from:

```text
https://YOUR_PROJECT_REF.supabase.co
```

## 5. Set the server-only Google Places secret

```bash
npx supabase secrets set GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_PLACES_API_KEY
```

Verify the secret name exists:

```bash
npx supabase secrets list
```

You should see `GOOGLE_PLACES_API_KEY`; the actual value should not be printed.

## 6. Deploy merchant-search

```bash
npx supabase functions deploy merchant-search
```

`supabase/config.toml` keeps JWT verification enabled for this function.

## 7. Start Expo cleanly

```bash
npm install
npx expo start -c
```

Then sign in and test:

`Quick Swipe -> In Store -> Find Nearby Stores`

## 8. Edge Function behavior

The mobile app sends only what is required for merchant discovery:

- foreground latitude/longitude
- search radius
- result limit
- merchant text query when the user explicitly searches

It does not send wallet contents, card ownership, purchase amount, reward preference, purchase history, or Recommendation Engine result to Google Places.

## 9. Google Places API calls used

The Edge Function uses:

- `POST https://places.googleapis.com/v1/places:searchNearby`
- `POST https://places.googleapis.com/v1/places:searchText`

Only a minimal field mask is requested:

- place ID
- display name
- formatted address
- location
- primary type / types

The Edge Function calculates straight-line distance itself from the returned coordinates rather than purchasing/requesting routing-distance data.

## 10. No database migration

This provider swap does not require a new Supabase database table, RLS policy, or destructive migration.
