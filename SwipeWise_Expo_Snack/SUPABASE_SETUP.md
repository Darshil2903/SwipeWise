# SwipeWise Supabase Setup — Google Places + Free-Tier Safety Guard

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

## 3. Google Cloud setup

1. Create/select the Google Cloud project for SwipeWise.
2. Attach billing as required by Google Maps Platform.
3. Enable **Places API (New)**.
4. Create an API key.
5. Restrict the key under **API restrictions** to **Places API (New)**.
6. Keep Application restrictions as `None` while the key is used only by the server-side Supabase Edge Function.
7. Do not copy this key into Expo `.env`.

## 4. Google billing budget alert

Create a Google Cloud billing budget of **$1/month** with alerts. A Google budget is an alert, not a guaranteed hard stop.

SwipeWise therefore also enforces its own server-side hard request guard before calling Google.

## 5. SwipeWise hard request guard

Default server-side limit:

```text
4,000 Google Places request attempts per calendar month
```

The current Google Places Pro free usage cap is 5,000 monthly events per relevant SKU. SwipeWise intentionally uses a lower combined limit as a conservative safety wall.

When the SwipeWise limit is reached:

- the Edge Function does NOT call Google;
- Nearby Merchant discovery returns a safe message;
- manual merchant search/entry remains available;
- no user IDs, merchant queries, or coordinates are stored in the usage counter.

The counter resets by month using Pacific Time because Google Maps Platform free usage resets monthly on Pacific Time boundaries.

## 6. Log into and link Supabase CLI

From the `swipewise_expo` project folder:

```bash
npx supabase login
npx supabase projects list
npx supabase link --project-ref YOUR_PROJECT_REF
```

## 7. Apply the safety-guard database migration

Run:

```bash
npx supabase db push
```

This applies:

```text
supabase/migrations/20260917090000_google_places_usage_guard.sql
```

It creates only:

- `public.google_places_monthly_usage`
- `public.consume_google_places_request(integer)`

The table stores aggregate month + request count only.

## 8. Set the server-only Google Places secret

```bash
npx supabase secrets set GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_PLACES_API_KEY
```

Optional: lower the hard limit below 4,000:

```bash
npx supabase secrets set GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT=3000
```

The Edge Function clamps this safety setting to a maximum of 4,900 even if a larger value is configured.

Verify secret names:

```bash
npx supabase secrets list
```

## 9. Deploy merchant-search

```bash
npx supabase functions deploy merchant-search
```

`supabase/config.toml` keeps JWT verification enabled for this function.

## 10. Start Expo cleanly

```bash
npm install
npx expo start -c
```

Then sign in and test:

`Quick Swipe -> In Store -> Find Nearby Stores`

## 11. Check current monthly SwipeWise Google request count

In Supabase Dashboard -> SQL Editor run:

```sql
select month_start, request_count, updated_at
from public.google_places_monthly_usage
order by month_start desc;
```

This table contains no coordinates, search terms, or user identifiers.

## 12. Edge Function behavior

The mobile app sends only what is required for merchant discovery:

- foreground latitude/longitude
- search radius
- result limit
- merchant text query when the user explicitly searches

It does not send wallet contents, card ownership, purchase amount, reward preference, purchase history, or Recommendation Engine result to Google Places.

Before every Google request, the Edge Function atomically consumes one unit from the monthly safety allowance. If the guard cannot be checked, the function fails closed and does not call Google.
