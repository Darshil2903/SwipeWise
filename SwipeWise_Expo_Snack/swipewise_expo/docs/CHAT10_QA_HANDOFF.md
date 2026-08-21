# Chat 10 QA Handoff — Recommendation Engine v1

## Automated baseline

Run:

```bash
npm run test:engine
```

Expected: **28 deterministic scenarios passed**.

Machine-readable results: `tests/recommendationEngine.results.json`.
Full architecture/test matrix: `docs/RECOMMENDATION_ENGINE_V1.md`.

## Required regression groups

- Costco warehouse → CIBC Costco base cashback when only Mastercard is accepted.
- Costco Gas → merchant-specific Costco Gas rule, shared cap behavior.
- Generic grocery/dining/gas → category precedence when verified classification evidence is supplied.
- Air Canada → merchant-specific TD rule with direct-purchase condition.
- Rental car/travel → relevant rental/travel benefit reasons without converting coverage limits to dollars.
- Online streaming → online-only rule applies online and is blocked in-store.
- No amount → no unnecessary amount screen for normal rules.
- Amount-dependent rule → amount screen only when threshold/cap state can alter the winner.
- Threshold below / exact boundary.
- Cap before / exact boundary / exceeded / split across cap.
- Shared cap group across categories.
- Unsupported network cannot win.
- Missing acceptance produces warning, not fabricated acceptance.
- Stale product/rule behavior.
- Uncertain product/rule exclusion.
- Expired/future rule exclusion.
- Missing point valuation: preserve multiplier, no fake dollars, warn.
- Tie: stable deterministic ordering.
- Verified owned legacy product: can participate with warning at pure-engine level.
- Unknown cap progress: conservative post-cap/fallback, never assume zero.

## Manual Expo/Supabase integration cases

1. Sign in with User A; add two exact verified products; Quick Swipe must rank only those two.
2. Remove one card; rerun same context; removed card must disappear immediately.
3. Sign in as User B; User A cards/purchases must not appear.
4. Force reference-cache refresh failure after a successful load; app should use cached reference data and show stale-cache warning.
5. Clear app storage/no cache + block reference fetch; app should fail safely rather than fall back to hard-coded financial values.
6. Verify old generic `cibc-aventura` is not offered in Add Card.
7. Inspect Best Card and Why This Card for rule ID/source/verified date consistency.
8. For a points winner with no production valuation, verify there is no estimated dollar reward and logging does not invent one.
9. Verify Light/Dark/System, onboarding, history, settings, and auth regression because `App.js` was integrated but UI structure should be unchanged.
10. Verify In Store/Online remains explicit and GPS never silently chooses purchase mode.

## Bug report payload for engine defects

Record:
- user-owned card slugs,
- purchase mode,
- merchant,
- purchase purpose/category,
- normalized MCC/classification/acceptance evidence if present,
- amount or absence,
- cap state and whether authoritative,
- reward preference,
- purchase date/time,
- expected winner/order,
- actual winner/order,
- `rule_ids_used`,
- `reason_codes`,
- `warning_codes`,
- reference `verified_at` and cache state.
