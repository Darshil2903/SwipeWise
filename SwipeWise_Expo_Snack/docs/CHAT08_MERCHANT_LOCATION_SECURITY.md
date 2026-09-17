# Chat 08 Security Handoff — Google Places Merchant/Location Layer

## Permission model

- Foreground / when-in-use location only.
- Permission requested only after the user explicitly taps **Find Nearby Stores**.
- No background or continuous tracking.
- Location denial never blocks Quick Swipe.

## Coordinate handling

Raw user coordinates are transient application state used only for the active discovery/search request.

They are not written to:

- purchases
- recommendation history
- analytics
- durable cache
- logs

## Provider

Google Places API (New):

- Nearby Search (New)
- Text Search (New), only when foreground coordinates are already available

## Credential model

`GOOGLE_PLACES_API_KEY` is a Supabase Edge Function secret only.

It must not appear in Expo `.env`, source control, mobile bundle, or user-visible logs.

Google Cloud API restrictions should limit the key to **Places API (New)**.

## Network path

`Expo -> authenticated Supabase merchant-search Edge Function -> Google Places HTTPS API`

## Data sent to Google

Only what merchant discovery requires:

- latitude/longitude
- radius
- result limit
- explicit merchant query for text search

Not sent:

- email
- Supabase user ID as provider data
- wallet/card ownership
- purchase amount
- reward preference
- purchase history
- Recommendation Engine result

## Logs

The Edge Function logs only coarse provider error status. It intentionally does not log coordinates, query text, user IDs, wallet data, amounts, or raw Google response bodies.

## Provider content cache/storage

No Google Places result cache is implemented in `merchantProviderService.js`.

Known Google results normalize to SwipeWise's canonical merchant identity. Unknown/provider-only Google merchant names require user confirmation before use as durable purchase data.

## Attribution

Google-derived result containers display `Google Maps` text attribution in the UI.

## Database impact

None.

No new tables, columns, triggers, or RLS policies were added for this provider change.

## Security QA focus

Verify:

- no Google API key in client bundle/logs
- function requires authenticated Supabase JWT
- location denied/manual fallback works
- coordinates never appear in purchase rows
- error logs do not contain coordinates/query text
- Google attribution is visible with Google-derived content

## Billing / abuse safety guard

A new aggregate server-side usage guard prevents uncapped Google Places calls.

- DB object: `public.google_places_monthly_usage`.
- RPC: `public.consume_google_places_request(integer)`.
- RPC execution is revoked from `public`, `anon`, and `authenticated`; only `service_role` may execute it.
- Edge Function uses Supabase's server-provided admin credential only inside the hosted function.
- No service-role/secret key is exposed to Expo.
- Counter contains month, request count, and update timestamp only.
- No user IDs, coordinates, merchant names, queries, wallet data, or recommendation data are stored.
- Counter increment is atomic and the function fails closed if the guard cannot be checked.
