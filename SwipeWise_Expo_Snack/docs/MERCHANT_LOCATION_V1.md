# SwipeWise Merchant & Location Integration v1

Date: 2026-09-15

## Scope

This milestone replaces the old demo merchant-context path without changing the financial recommendation formula. The user still explicitly chooses **In Store** or **Online**. Location is only requested after the user chooses In Store and taps **Find Nearby Stores**.

## Selected V1 provider strategy

**Primary:** TomTom Search API v2 through an authenticated Supabase Edge Function.

**Fallback:** local canonical merchant catalog + manual merchant entry. Online search uses the local canonical catalog in V1 and does not require location.

Why this approach:

- TomTom Search v2 has nearby-POI and POI/text search suitable for the current flow.
- REST works with Expo/React Native and the no-Mac development path.
- The private TomTom API key stays in a Supabase Edge Function secret, never in Expo.
- Current TomTom pricing shows 2,500 free Search API requests per month.
- TomTom's newer Orbis Places APIs have larger free allowances, but the current Orbis Search documentation is marked Public Preview. V1 therefore uses the supported Search API v2 and should revisit Orbis after general availability.

Current sources checked 2026-09-15:

- TomTom Search API v2: https://docs.tomtom.com/search-api/documentation/product-information/introduction
- TomTom pricing: https://docs.tomtom.com/pricing
- TomTom Orbis Nearby Search public preview: https://docs.tomtom.com/search-api/documentation/tomtom-orbis-maps/search-service/nearby-search
- Google Maps Platform pricing: https://developers.google.com/maps/billing-and-pricing/pricing
- Foursquare pricing: https://foursquare.com/pricing/
- Apple Maps Server API quota: https://developer.apple.com/documentation/applemapsserverapi
- OSMF Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/

## Provider comparison

| Provider | Strengths | Main V1 concern | Cost signal checked 2026-09-15 |
|---|---|---|---|
| TomTom Search API v2 | Nearby POIs, POI search, IDs, distance, brand/category hints, simple REST | Previous-generation Search product; migration path should be revisited | 2,500 Search API requests/month free |
| TomTom Orbis Places | Newer stack; 5,000 Discover, 10,000 Suggest, 5,000 Details free | Search documentation is Public Preview | Free allowances listed on TomTom pricing page |
| Google Places (New) | Excellent place coverage/search, mature product | More expensive at scale; Places content/attribution/caching rules add product constraints | Nearby Search Pro: 5,000 free events/month, then $32/1,000 through 100k |
| Foursquare Places | Strong POI/chain/category focus | Small current free allowance | 500 Pro calls free; 501–100k $15 CPM |
| Apple Maps Server API | Apple ecosystem, 25,000 service calls/day/team | Requires Apple Maps credentials/JWT; Apple map/data display/licensing constraints; less convenient for current browser/no-Mac workflow | 25,000 service calls/day/team quota |
| HERE / TomTom alternatives | Mature enterprise location products | Pricing/licensing/config complexity was not compelling enough for this V1 | Re-evaluate if TomTom quality/cost fails QA |
| Public OSM/Nominatim | Open ecosystem | Public Nominatim is not suitable as a production merchant autocomplete/POI backend; max 1 request/sec and limited-capacity policy | Free public service but policy-limited; self-host/paid provider needed for scale |

## Location permission architecture

- `expo-location` foreground permission only.
- No permission request at app launch.
- Permission request occurs only after: Quick Swipe → In Store → Find Nearby Stores.
- Denied/unavailable/error: manual Search Merchant and Enter Merchant Manually remain available.
- The client keeps the most recent foreground coordinate only in component memory while Quick Swipe is open.
- Nearby provider cache is memory-only for 60 seconds.
- Raw user coordinates are not written to purchases, recommendation history, AsyncStorage, analytics, or logs by Chat 07.

## Nearby discovery

1. User explicitly chooses In Store.
2. User taps Find Nearby Stores.
3. SwipeWise requests foreground location.
4. The client invokes authenticated Supabase Edge Function `merchant-search`.
5. Edge Function forwards only the minimum provider fields: latitude, longitude, radius, limit, and for text search the query.
6. TomTom results are minimized and returned to the app.
7. Results are normalized and deterministically ordered.
8. **The user selects the merchant. No result is auto-selected.**

Provider failures, quota failures, malformed/no results, location denial, and location errors all fall back to manual search/entry instead of inventing a merchant.

## Deterministic confidence / ambiguity rules

Ordering uses explainable inputs only:

1. distance band: <=30 m, <=100 m, <=250 m, then farther;
2. known canonical catalog match before provider-only identity inside the same band;
3. provider score inside the same band/status;
4. distance as final tie-breaker.

UI confidence labels are descriptive only (for example High confidence / Likely nearby / Possible match). They never authorize automatic selection.

## Merchant normalization model

Normalized objects preserve:

- canonical merchant key/name when known;
- original user-entered name when manually entered;
- original provider name and provider place ID;
- provider distance/address/category hints;
- normalization status: `KNOWN`, `PROVIDER_ONLY`, or `MANUAL`;
- MCC evidence and status;
- network acceptance evidence and status;
- merchant-specific purchase categories.

Examples:

- `Costco Wholesale #1234` -> canonical `Costco`, while preserving provider name/place ID.
- `Shell Station #98` -> canonical `Shell`, while preserving provider metadata.
- `Local Electronics Shop` -> manual/unknown identity with the exact entered name preserved.

## MCC/category evidence

A TomTom POI category is **not** treated as proof of a payment-network MCC.

MCC states are modeled as:

- `VERIFIED`
- `LIKELY` (reserved for future evidence work; not promoted to the engine as exact MCC)
- `UNKNOWN`

Only `VERIFIED` MCC evidence is passed as an MCC to the Recommendation Engine. V1 catalog entries intentionally default to `UNKNOWN` unless a reliable transaction-classification source is added later.

## Network acceptance

Acceptance is evidence-driven and mode-specific. The normalized object carries status, networks, source, verification date and scope.

Only verified acceptance is passed to the Recommendation Engine. Unknown acceptance becomes `acceptedNetworks: null`, allowing the engine's existing `ACCEPTANCE_UNKNOWN` warning behavior rather than pretending approval or exclusion.

V1 preloads only acceptance evidence verified from an official source:

- Costco Canada warehouses/gas: Mastercard.
- Costco.ca: Mastercard and Visa.

Source checked 2026-09-15: https://customerservice.costco.ca/app/answers/answer_view/a_id/1017193/

Other merchant acceptance remains unknown until independently verified.

## Online merchant search — SW-BUG-017

Resolved in Chat 07.

Online now has a real search field over normalized canonical merchants, including Amazon, Best Buy and Air Canada, plus popular results and manual entry. Location is never requested for online search.

## Manual merchant entry — SW-BUG-018

Resolved in Chat 07.

`Other / Enter Manually` now opens a merchant-name input. The exact name is preserved through category, recommendation and purchase logging. An unknown manually entered merchant does not receive a fabricated MCC, network list, or reward-category certainty.

## Recommendation Engine context contract

Chat 07 converts the normalized merchant object into the existing engine contract rather than changing the engine formula:

```js
{
  merchantName,            // canonical or preserved manual name
  mcc,                     // exact value only when VERIFIED; otherwise null
  acceptedNetworks,        // list only when VERIFIED; otherwise null
  merchantClassifications: [], // provider POI categories are not promoted to financial classifications
  merchantAttributes: {}
}
```

Quick Swipe separately supplies existing fields such as `purchaseMode`, `purchaseCategory`, `amount`, `country`, date and purchase history.

## Caching

- Nearby results: 60-second **memory-only** cache.
- No durable coordinate cache.
- Merchant catalog: static app reference data may be cached/bundled because it is not user location history.
- Provider place IDs may be preserved on the transient normalized merchant object but are not added to purchase history in this milestone.

## Security / privacy

The mobile client never receives `TOMTOM_API_KEY`.

Path:

`Expo -> authenticated Supabase Edge Function -> TomTom Search API v2`

The function is configured with JWT verification and reads `TOMTOM_API_KEY` from server-side secrets. It does not accept or forward email, Supabase user ID, wallet contents, card ownership, purchase amount, reward preference/history, or recommendation result. HTTPS is used for Supabase and TomTom.

## Cost model

Assumption for planning only: **8 provider Search API calls per active user per month** (roughly four nearby/search sessions with two provider calls each). The 60-second in-memory nearby cache can reduce repeat calls.

TomTom Search API v2 currently lists **2,500 free requests/month**. Its public pricing page uses an interactive calculator for usage above the free allowance; this document does not invent a unit rate that was not exposed in the static pricing data.

| Active users | Assumed provider calls/month | Known minimum monthly API cost |
|---:|---:|---:|
| 10 | 80 | $0 within current free allowance |
| 100 | 800 | $0 within current free allowance |
| 1,000 | 8,000 | exceeds free allowance by ~5,500; paid amount must be checked in TomTom calculator/plan |
| 10,000 | 80,000 | exceeds free allowance by ~77,500; paid amount must be checked in TomTom calculator/plan |

For comparison only, under current published rates and the same 8-call assumption, Google Nearby/Text Search Pro-style calls would be materially more expensive after its 5,000-event free cap, while Foursquare Pro has only 500 free calls and then published CPM pricing. Actual SwipeWise usage should be measured before committing to a paid tier.

## Deployment

Install dependencies:

```bash
npm install
```

Configure client-safe Supabase values using `.env.example`.

Set the server-only TomTom key:

```bash
supabase secrets set TOMTOM_API_KEY=YOUR_TOMTOM_KEY
```

Deploy the function:

```bash
supabase functions deploy merchant-search
```

Then test on the physical iPhone. No live GPS or live TomTom credential was available in the build environment used for this milestone, so live provider/GPS behavior must be verified by Chat 10.
