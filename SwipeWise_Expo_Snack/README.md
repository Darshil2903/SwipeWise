# SwipeWise — Expo + Supabase + Recommendation Engine v1

This is the active SwipeWise Expo/React Native project. It preserves the existing UI, authentication, navigation, Quick Swipe flow, wallet/history persistence, and Light/Dark/System behavior while replacing the checkout recommendation's hard-coded financial path with a deterministic engine backed by the verified Supabase reference tables.

## What is production-backed in this milestone

- Supabase email/password authentication and persistent sessions
- RLS-isolated user profile, settings, wallet, and purchase history
- Exact card-product identities from `card_products`
- Verified reward rules from `reward_rules`
- Verified card benefits from `card_benefits`
- Wallet-only checkout ranking
- Explicit In Store vs Online purchase mode
- Deterministic rule precedence, effective-date checks, lifecycle checks, thresholds, caps, post-cap rates, and shared cap groups
- Context-sensitive benefit handling without turning insurance limits into reward dollars
- Deterministic `Why This Card` reason/warning codes
- One-hour client cache for public/reference card data, with stale-cache warning fallback
- 28 deterministic recommendation-engine scenarios in `tests/recommendationEngine.test.js`

## Important financial-data policy

Issuer earning facts and SwipeWise estimates are separate. `point_value_cents` from the old prototype is **not** used as an issuer fact. Production point valuations are intentionally empty in `engine/pointValuations.js` until a separately sourced SwipeWise valuation methodology is approved. Therefore point multipliers can be shown without inventing a cash-equivalent value.

Coverage limits for insurance/protection are descriptive metadata. They are never added to a numeric reward score.

## What remains demo / deferred

- Nearby/online merchant lists in `App.js` are UI-only demo discovery data. They contain no financial rates.
- Merchant/MCC normalization and confirmed network acceptance remain a Chat 07 dependency. Until supplied, the engine uses verified base or merchant-specific rules conservatively and warns when a classification is required.
- Authoritative issuer cap progress is not available from optional SwipeWise purchase logs. Logs can prove a minimum spend but cannot prove that the issuer-account cap is unused. The engine therefore uses a conservative post-cap rate when cap progress is unknown.
- Production monetary point valuations are not configured yet.
- Native Action Button/App Intents, Safari extension, Apple Pay, bank connections, personalized bank offers, and monetization remain out of scope.

## Project setup

Read `SUPABASE_SETUP.md`. For the live development backend, the Chat 05 verified-card migration must already be applied in addition to the base schema.

Client environment variables:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Never put a Supabase `service_role` key, `sb_secret_*` key, database password, or other server secret in the Expo app.

## Tests

```bash
npm run test:engine
```

For the generated detailed result artifact used in this milestone:

```bash
SWIPEWISE_TEST_REPORT_PATH=tests/recommendationEngine.results.json npm run test:engine
```

See `docs/RECOMMENDATION_ENGINE_V1.md`, `docs/CHAT08_SECURITY_HANDOFF.md`, and `docs/CHAT10_QA_HANDOFF.md`.
