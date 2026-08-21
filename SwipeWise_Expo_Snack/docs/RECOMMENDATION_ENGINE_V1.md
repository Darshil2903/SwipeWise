# SwipeWise Recommendation Engine v1 — Verified Supabase Data Integration

## Status

**Implementation status: COMPLETE in the active Expo codebase.**

The checkout decision path now consumes verified Supabase `card_products`, `reward_rules`, and `card_benefits` records through `services/cardReferenceService.js`, evaluates only the signed-in user's wallet products, and returns a deterministic structured result. No LLM is used to choose or explain the winner.

A live authenticated Supabase/Expo smoke test still requires the user's local `.env` and hosted development project; secrets were intentionally not copied into this artifact.

## 1. Project inspection summary

The original active project had a working Supabase account/data baseline but still kept financial recommendation facts in `App.js`. The old path used a hard-coded card catalog, hard-coded reward rules and point values, a local `rankCards(...)` score, benefit-count scoring, and a hard-coded `shouldAskAmount(...)` category list. Quick Swipe UI, authentication, wallet/purchase persistence, History, settings, and themes were otherwise already connected and were preserved.

The active backend schema file is the earlier baseline; the hosted database has the later Chat 05 verified migration. Chat 06 does not duplicate or undo that migration.

## 2. Demo financial logic removed/replaced

### REMOVE / removed from the production decision path

- Hard-coded `cards[].rules` reward percentages and point multipliers in `App.js`.
- Prototype point cash values / point-equivalent assumptions.
- Hard-coded financial benefits used as scoring facts.
- Hard-coded annual fees as production facts.
- Ambiguous prototype `cibc-aventura` identity from the production wallet catalog.
- Old `rankCards(...)` score and arbitrary benefit-count bonus.
- Hard-coded `shouldAskAmount(...)` list.
- Fake last-four card digits.

### REPLACE WITH SUPABASE / implemented

- Exact product identity, canonical name, network, fees, status, source, verification → `card_products`.
- Reward kind/currency/rate, merchant/category/mode, thresholds, caps, post-cap, shared cap group, lifecycle/effective date, conditions, source/verification → `reward_rules`.
- Benefit type/details/coverage/conditions/effective dates/source/verification → `card_benefits`.

### KEEP AS UI-ONLY DEMO

- Nearby and online merchant candidate arrays/distances in `App.js` until Chat 07 replaces merchant discovery/normalization.
- UI categories and visual bank accent colors.
- Future new-card recommendation placeholder in Insights; it does not participate in checkout ranking.

### UNRELATED / preserved

- Supabase Auth, profile/settings sync, wallet/purchase persistence, navigation, onboarding, explicit In Store/Online, Light/Dark/System, History, and account flows.

## 3. Recommendation Engine v1 architecture

```text
Authenticated user_cards
        +
Cached verified public reference data
(card_products + reward_rules + card_benefits)
        +
Explicit purchase context
(mode + merchant + purchase purpose/category + optional amount)
        +
Optional merchant acceptance/MCC metadata
        +
Optional authoritative cap state
        ↓
Product eligibility + acceptance gate
        ↓
Verified/effective/lifecycle rule filtering
        ↓
Rule precedence + condition matching
        ↓
Threshold/cap/post-cap resolution
        ↓
Cashback or point-unit calculation
        ↓
Separate SwipeWise point valuation layer (if available)
        ↓
Contextual benefit metadata / tie-break policy
        ↓
Preference-aware deterministic ordering
        ↓
Best Card + ranked alternatives + rules + reasons + warnings + sources
```

`engine/recommendationEngine.js` is pure decision logic. `services/cardReferenceService.js` owns reference fetching/caching. `engine/pointValuations.js` keeps SwipeWise estimates separate from issuer facts. `App.js` supplies wallet/context and renders the result.

## 4. Exact rule precedence

Eligibility is evaluated before reward comparison:

1. User must own the card (`isOwned`).
2. Merchant/network acceptance: known not accepted → exclude; unknown → keep with warning.
3. Product verification/lifecycle: uncertain/demo/draft → exclude; stale → warning; owned legacy/retired may participate only if its current rules are otherwise verified.
4. Rule verification: non-verified/uncertain/demo/draft rows do not apply.
5. Acquisition/welcome/personalized offer lifecycles are excluded from normal checkout.
6. Effective date: future and expired rows do not apply.
7. Purchase mode: `online`, `in_store`, `both`, or general/null.
8. Merchant pattern and material eligibility conditions.
9. Category specificity.
10. Amount threshold/cap/post-cap state.

Applicable rule precedence is then:

- merchant + exact category: specificity 400
- merchant + parent/fallback category: 350
- exact verified category: 300
- parent category: 250
- `Other`/base: 100

Ties use mode specificity and stable rule ID order. Rules do not stack unless the data model explicitly represents a separate stackable reward; the normal engine selects one earning rule per reward stream. This prevents base + category double counting.

## 5. Purchase mode

The engine receives purchase mode from the user's explicit Quick Swipe choice. Location/GPS never changes it. An `online` rule cannot match an in-store context, and an `in_store` rule cannot match online. Null/general rules can match either.

## 6. Amount requirement logic

`requiresPurchaseAmount(...)`/`amountCouldChangeWinner(...)` is winner-sensitive, not category-hard-coded.

Amount is requested only when the engine can prove that a verified transaction threshold or a **known authoritative cap state** can change which card wins. Thresholds are probed immediately below/at the boundary. Caps compare the current pre-cap regime with the verified post-cap regime.

Amount is **not** requested merely because:

- the user wants to log a purchase,
- a normal uncapped rule exists,
- point valuation is missing,
- cap progress itself is unknown (transaction amount alone cannot fix missing issuer-account history).

If cap usage is unknown, the engine uses a conservative safe rate and warns instead of pretending the cap is unused.

## 7. Reward calculation rules

### Cashback

A verified cashback `rate` is interpreted as percent of eligible spend. If amount exists, estimated reward dollars are calculated from the effective/blended rate. If amount is absent, the percentage can still be compared but no reward dollars are invented.

### Points

A verified points `rate` remains points per dollar in its own `reward_currency`. With amount, the engine can calculate point units. Monetary reward value is null unless a separate SwipeWise point valuation is supplied.

Reward currencies remain distinct: Aeroplan, Aventura, Avion, Membership Rewards, World of Hyatt, and any future program are not treated as interchangeable.

## 8. Point valuation architecture

Issuer earning rules and SwipeWise estimated point values are separate layers.

`engine/pointValuations.js` currently exports an empty `productionPointValuations` object. A future valuation record must identify a reward currency, `centsPerPoint`, estimate/methodology status, source, and as-of date. It is injected into the engine; it is not copied into `reward_rules` as an issuer fact.

When a valuation exists:

- `estimatedEquivalentPercent = points_per_dollar × cents_per_point`.
- Estimated reward dollars can be shown and labeled as SwipeWise-estimated.

When none exists:

- original multiplier is still shown,
- `POINT_VALUE_UNAVAILABLE` is emitted,
- different unvalued point currencies are marked `INCOMPARABLE_REWARD_CURRENCIES`,
- no fake cash value is created.

## 9. User reward preferences

### Cashback

Actual cashback cards are favored first; cashback percentages determine order among them. Unvalued points are not silently converted to cash.

### Travel Points

Point-earning cards are favored. Same-currency points can be compared by multiplier. Different currencies use supplied valuations if available; otherwise merchant/category rule specificity, relevant benefit tie-break, uncertainty, and stable slug fallback provide deterministic ordering while warning that currencies are incomparable.

### Maximum Overall Value

Known comparable monetary/equivalent percentages are compared. If two comparable values are within **0.25 percentage points**, a context-relevant benefit priority may break the near-tie. This is an ordinal product policy, not a dollar valuation of insurance. When one candidate has a known monetary value and another has unvalued points, the known value wins provisionally and the missing valuation is disclosed.

## 10. Caps and thresholds

Supported behavior:

- card-specific caps,
- shared `cap_group`,
- post-cap rates,
- exact pre-cap/post-cap split for a transaction crossing a known cap,
- threshold boundary handling,
- monthly and calendar-year period derivation from logged purchases,
- externally supplied authoritative cap usage for annual/cardmember/statement/other periods.

For `ANNUAL` rules whose issuer reset date cannot be safely inferred, SwipeWise does not guess the period from local logs. The result gets `CAP_PERIOD_UNRESOLVED` / `CAP_PROGRESS_UNKNOWN` and uses a conservative post-cap/fallback rate where available.

SwipeWise purchase logs are voluntary, so they prove only **minimum known spend**. They are never treated as authoritative proof that an issuer cap is unused. For `ALL_ACCOUNT_NET_PURCHASES`, every eligible logged purchase on that card can count toward the minimum; for `CATEGORY_GROUP_SPEND`, only purchases that can be definitely matched to a rule in that cap group count.

## 11. Benefit handling

Benefits are filtered by verified status and effective dates, then mapped to the current purchase context:

- electronics/mobile device → purchase protection, extended warranty, mobile-device insurance,
- flight/travel → trip cancellation/interruption, delay, baggage, medical/accident where present,
- rental car → rental vehicle coverage,
- general purchase → purchase protection/extended warranty.

Benefits carry an **ordinal relevance priority only**. Coverage limits are never converted to reward dollars. In Maximum Overall Value, a relevant benefit can break/override only a small comparable reward gap (≤0.25 percentage points). Benefit `key_conditions` are retained and the UI labels conditional benefits as “conditions apply”; the recommendation does not guarantee coverage.

## 12. Acceptance handling

Known network rejection excludes a card before ranking and emits `NETWORK_NOT_ACCEPTED`. Known acceptance produces `NETWORK_ACCEPTANCE`. If merchant acceptance data is unavailable, the card remains eligible but `ACCEPTANCE_UNKNOWN` is surfaced.

The engine accepts normalized `acceptedNetworks` and explicit card exclusions. Real merchant/network acceptance data remains a Chat 07 input; it is not fabricated in Chat 06.

## 13. Effective-date / lifecycle / verification handling

- `VERIFIED` + active + effective → normal use.
- `STALE` → may participate with warning and lower verification confidence.
- `UNCERTAIN` / demo / draft → excluded from normal recommendations.
- `TEMPORARY_PROMOTION` → only in its date window **and** only when material conditions can be established.
- Welcome/acquisition/signup/personalized/targeted offer lifecycle → excluded from normal checkout.
- Owned `LEGACY`/`RETIRED` exact products may be evaluated if their current rules are verified; warning is shown. New wallet additions remain limited to active verified products.
- Future rules do not activate early; expired rules cannot win.

The ambiguous legacy `cibc-aventura` remains unsuitable because its product identity/rules are uncertain; this engine policy does not resurrect it.

## 14. Deterministic tie-breaking

Order is stable and reproducible:

1. acceptance certainty,
2. financial reference verification confidence,
3. selected user reward preference,
4. reward value/multiplier where legitimately comparable,
5. merchant/category specificity,
6. fewer unresolved warnings/conditions,
7. stable card slug fallback.

Maximum Overall Value has the documented near-tie benefit rule before later specificity fallback. No randomness is used.

## 15. Missing-data behavior

- missing merchant/category rule → lower-precedence verified rule/base if available,
- missing required merchant classification → do not award accelerated category rate; warn,
- missing base rule → card becomes ineligible for this context (`NO_VERIFIED_RULE`),
- missing point valuation → keep point multiplier, no cash conversion, warn,
- unknown cap progress → conservative post-cap/fallback, warn,
- stale data → warn/lower verification confidence,
- uncertain data → exclude,
- missing acceptance → keep but warn,
- missing amount → only request if amount can actually change winner under known state,
- missing material promotion/account condition → do not silently award the conditional rule.

## 16. Engine output contract

Top-level result:

```js
{
  recommended_card_id,
  recommended_card_slug,
  recommended_card_name,
  ranked_cards,
  ineligible_cards,
  amount_required,
  data_confidence,
  reason_codes,
  warning_codes,
  rule_ids_used,
  source_urls,
  verified_at,
  reference_cache_fetched_at
}
```

Each ranked card includes product identity/network, acceptance, reward kind/currency/rate, points multiplier, estimated reward units/value/equivalent percent when valid, benefit highlights, reason/warning codes, data confidence, primary rule, rule IDs, source URLs, verification date, cap state, amount sensitivity, and rule specificity.

## 17. Why This Card reason codes

Core reason codes:

`MERCHANT_BONUS`, `CATEGORY_BONUS`, `BASE_REWARD`, `HIGHEST_CASHBACK`, `HIGHEST_ESTIMATED_POINT_VALUE`, `TRAVEL_POINTS_PREFERENCE`, `CASHBACK_PREFERENCE`, `MAXIMUM_VALUE`, `RELEVANT_EXTENDED_WARRANTY`, `PURCHASE_PROTECTION`, `MOBILE_DEVICE_PROTECTION`, `RENTAL_COVERAGE`, `TRAVEL_PROTECTION`, `NETWORK_ACCEPTANCE`, `NETWORK_NOT_ACCEPTED`, `THRESHOLD_NOT_MET`, `CAP_REACHED`, `POST_CAP_RATE_USED`, `SHARED_CAP`, `AMOUNT_REQUIRED`, `POINT_VALUE_UNAVAILABLE`, `STALE_DATA_WARNING`, `UNCERTAIN_DATA_WARNING`, `BENEFIT_TIE_BREAK`, `LEGACY_PRODUCT`.

Warnings additionally include `ACCEPTANCE_UNKNOWN`, `PRODUCT_NOT_ELIGIBLE`, `NO_VERIFIED_RULE`, `RULE_NOT_EFFECTIVE`, `THRESHOLD_SCOPE_UNKNOWN`, `CAP_PROGRESS_UNKNOWN`, `CAP_PERIOD_UNRESOLVED`, `MERCHANT_CLASSIFICATION_REQUIRED`, `RULE_CONDITIONS_NOT_MET`, `RULE_CONDITIONS_UNKNOWN`, `TEMPORARY_PROMOTION`, `CACHE_STALE`, `INCOMPARABLE_REWARD_CURRENCIES`, `LOGGED_PURCHASES_ONLY`, and `BENEFIT_CONDITIONS_APPLY`.

## 18. Deterministic test suite

All 28 scenarios below passed. The exact machine-readable run is saved in `tests/recommendationEngine.results.json`.

| Test | Input | Expected winner | Expected alternative order | Rule(s) used | Reason codes | Warnings | Amount required |
|---|---|---|---|---|---|---|---|
| 1 Costco warehouse | in_store / Costco / Warehouse Purchase / $100 | cibc-costco | cibc-costco | costco-base | NETWORK_ACCEPTANCE, BASE_REWARD, RELEVANT_EXTENDED_WARRANTY, PURCHASE_PROTECTION, CASHBACK_PREFERENCE, HIGHEST_CASHBACK | MERCHANT_CLASSIFICATION_REQUIRED, NETWORK_NOT_ACCEPTED | NO |
| 2 Costco gas | in_store / Costco / Costco Gas / $50 | cibc-costco | cibc-costco | costco-gas | NETWORK_ACCEPTANCE, MERCHANT_BONUS, SHARED_CAP, RELEVANT_EXTENDED_WARRANTY, PURCHASE_PROTECTION, CASHBACK_PREFERENCE, HIGHEST_CASHBACK | MERCHANT_CLASSIFICATION_REQUIRED, SHARED_CAP, NETWORK_NOT_ACCEPTED | NO |
| 3 generic grocery | in_store / Example Merchant / Groceries / $100 | cibc-aventura-visa-infinite-privilege | cibc-aventura-visa-infinite-privilege → cibc-aventura-gold-visa → cibc-aventura-visa-infinite → cibc-aventura-visa | av-vip-grocery | NETWORK_ACCEPTANCE, CATEGORY_BONUS, SHARED_CAP, POINT_VALUE_UNAVAILABLE, TRAVEL_POINTS_PREFERENCE | SHARED_CAP, POINT_VALUE_UNAVAILABLE | NO |
| 4 restaurant dining | in_store / Example Merchant / Dining / Restaurants / $100 | amex-cobalt | amex-cobalt → cibc-costco | amex-dining | NETWORK_ACCEPTANCE, CATEGORY_BONUS, SHARED_CAP, PURCHASE_PROTECTION, MAXIMUM_VALUE, HIGHEST_ESTIMATED_POINT_VALUE | SHARED_CAP | NO |
| 5 generic gas | in_store / Example Merchant / Gas / $100 | cibc-costco | cibc-costco → amex-cobalt → td-aeroplan | costco-generic-gas | NETWORK_ACCEPTANCE, CATEGORY_BONUS, SHARED_CAP, RELEVANT_EXTENDED_WARRANTY, PURCHASE_PROTECTION, CASHBACK_PREFERENCE, HIGHEST_CASHBACK | SHARED_CAP, INCOMPARABLE_REWARD_CURRENCIES, POINT_VALUE_UNAVAILABLE | NO |
| 6 electronics | in_store / Example Merchant / Electronics / $100 | cibc-costco | cibc-costco → amex-cobalt | costco-base | NETWORK_ACCEPTANCE, BASE_REWARD, RELEVANT_EXTENDED_WARRANTY, MOBILE_DEVICE_PROTECTION, PURCHASE_PROTECTION, MAXIMUM_VALUE | MERCHANT_CLASSIFICATION_REQUIRED, POINT_VALUE_UNAVAILABLE | NO |
| 7 Air Canada flight | in_store / Air Canada / Flight Ticket / $600 | td-aeroplan | td-aeroplan → rbc-avion | td-aircanada | NETWORK_ACCEPTANCE, MERCHANT_BONUS, SHARED_CAP, POINT_VALUE_UNAVAILABLE, TRAVEL_POINTS_PREFERENCE | MERCHANT_CLASSIFICATION_REQUIRED, SHARED_CAP, POINT_VALUE_UNAVAILABLE, INCOMPARABLE_REWARD_CURRENCIES | NO |
| 8 rental car | in_store / Rental Company / Rental Car / $100 | rbc-avion | rbc-avion → cibc-aventura-visa-infinite | rbc-travel | NETWORK_ACCEPTANCE, CATEGORY_BONUS, POINT_VALUE_UNAVAILABLE, RENTAL_COVERAGE, TRAVEL_POINTS_PREFERENCE | POINT_VALUE_UNAVAILABLE, INCOMPARABLE_REWARD_CURRENCIES | NO |
| 9 online streaming | online / Eligible Streamer / Streaming / $100 | amex-cobalt | amex-cobalt → cibc-costco | amex-streaming | NETWORK_ACCEPTANCE, CATEGORY_BONUS, POINT_VALUE_UNAVAILABLE, PURCHASE_PROTECTION, TRAVEL_POINTS_PREFERENCE | POINT_VALUE_UNAVAILABLE | NO |
| 10 in-store blocks online rule | in_store / Eligible Streamer / Streaming / $100 | cibc-costco | cibc-costco → amex-cobalt | costco-base | NETWORK_ACCEPTANCE, BASE_REWARD, RELEVANT_EXTENDED_WARRANTY, PURCHASE_PROTECTION, CASHBACK_PREFERENCE, HIGHEST_CASHBACK | POINT_VALUE_UNAVAILABLE | NO |
| 11 purchase no amount | in_store / Example Merchant / Other | cibc-costco | cibc-costco | costco-base | NETWORK_ACCEPTANCE, BASE_REWARD, RELEVANT_EXTENDED_WARRANTY, PURCHASE_PROTECTION, CASHBACK_PREFERENCE, HIGHEST_CASHBACK | MERCHANT_CLASSIFICATION_REQUIRED | NO |
| 12 amount-dependent winner | in_store / Example Merchant / Dining / Restaurants | amex-cobalt | amex-cobalt → cibc-costco | amex-dining | NETWORK_ACCEPTANCE, CATEGORY_BONUS, SHARED_CAP, PURCHASE_PROTECTION, AMOUNT_REQUIRED, MAXIMUM_VALUE, HIGHEST_ESTIMATED_POINT_VALUE | SHARED_CAP | YES |
| 13 threshold boundary below | in_store / Example Merchant / Other / $99.99 | cibc-costco | cibc-costco → cibc-aventura-visa | costco-base | NETWORK_ACCEPTANCE, BASE_REWARD, RELEVANT_EXTENDED_WARRANTY, PURCHASE_PROTECTION, CASHBACK_PREFERENCE, HIGHEST_CASHBACK | MERCHANT_CLASSIFICATION_REQUIRED, THRESHOLD_NOT_MET | NO |
| 14 threshold boundary met | in_store / Example Merchant / Other / $100 | cibc-aventura-visa | cibc-aventura-visa → cibc-costco | test-threshold | NETWORK_ACCEPTANCE, BASE_REWARD, CASHBACK_PREFERENCE, HIGHEST_CASHBACK | MERCHANT_CLASSIFICATION_REQUIRED | NO |
| 15 cap before limit | in_store / Example Merchant / Dining / Restaurants / $100 | amex-cobalt | amex-cobalt → cibc-costco | amex-dining | NETWORK_ACCEPTANCE, CATEGORY_BONUS, SHARED_CAP, PURCHASE_PROTECTION, MAXIMUM_VALUE, HIGHEST_ESTIMATED_POINT_VALUE | SHARED_CAP | NO |
| 16 exact cap boundary | in_store / Example Merchant / Dining / Restaurants / $1 | amex-cobalt | amex-cobalt | amex-dining | NETWORK_ACCEPTANCE, CATEGORY_BONUS, SHARED_CAP, POINT_VALUE_UNAVAILABLE, PURCHASE_PROTECTION, TRAVEL_POINTS_PREFERENCE | SHARED_CAP, POINT_VALUE_UNAVAILABLE | NO |
| 17 cap exceeded | in_store / Example Merchant / Dining / Restaurants / $10 | amex-cobalt | amex-cobalt | amex-dining | NETWORK_ACCEPTANCE, CATEGORY_BONUS, SHARED_CAP, CAP_REACHED, POST_CAP_RATE_USED, POINT_VALUE_UNAVAILABLE, PURCHASE_PROTECTION, TRAVEL_POINTS_PREFERENCE | SHARED_CAP, CAP_REACHED, POST_CAP_RATE_USED, POINT_VALUE_UNAVAILABLE | NO |
| 18 post-cap earning split | in_store / Example Merchant / Dining / Restaurants / $20 | amex-cobalt | amex-cobalt | amex-dining | NETWORK_ACCEPTANCE, CATEGORY_BONUS, SHARED_CAP, CAP_REACHED, POST_CAP_RATE_USED, POINT_VALUE_UNAVAILABLE, PURCHASE_PROTECTION, TRAVEL_POINTS_PREFERENCE | SHARED_CAP, CAP_REACHED, POST_CAP_RATE_USED, POINT_VALUE_UNAVAILABLE | NO |
| 19 shared cap group | in_store / Example Merchant / Groceries / $10 | amex-cobalt | amex-cobalt | amex-grocery | NETWORK_ACCEPTANCE, CATEGORY_BONUS, SHARED_CAP, CAP_REACHED, POST_CAP_RATE_USED, POINT_VALUE_UNAVAILABLE, PURCHASE_PROTECTION, TRAVEL_POINTS_PREFERENCE | SHARED_CAP, CAP_REACHED, POST_CAP_RATE_USED, POINT_VALUE_UNAVAILABLE | NO |
| 20 unsupported network | in_store / Example Merchant / Other / $100 | cibc-costco | cibc-costco | costco-base | NETWORK_ACCEPTANCE, BASE_REWARD, RELEVANT_EXTENDED_WARRANTY, PURCHASE_PROTECTION, MAXIMUM_VALUE | MERCHANT_CLASSIFICATION_REQUIRED, NETWORK_NOT_ACCEPTED | NO |
| 21 stale data | in_store / Example Merchant / Other / $100 | td-aeroplan | td-aeroplan → cibc-costco | td-base | NETWORK_ACCEPTANCE, BASE_REWARD, POINT_VALUE_UNAVAILABLE | MERCHANT_CLASSIFICATION_REQUIRED, POINT_VALUE_UNAVAILABLE, STALE_DATA_WARNING | NO |
| 22 uncertain data excluded | in_store / Example Merchant / Other / $100 | td-aeroplan | td-aeroplan | td-base | NETWORK_ACCEPTANCE, BASE_REWARD, POINT_VALUE_UNAVAILABLE | MERCHANT_CLASSIFICATION_REQUIRED, POINT_VALUE_UNAVAILABLE, UNCERTAIN_DATA_WARNING | NO |
| 23 expired rule | in_store / Example Merchant / Other / $100 | td-aeroplan | td-aeroplan | td-base | NETWORK_ACCEPTANCE, BASE_REWARD, POINT_VALUE_UNAVAILABLE | MERCHANT_CLASSIFICATION_REQUIRED, POINT_VALUE_UNAVAILABLE, RULE_NOT_EFFECTIVE, NO_VERIFIED_RULE | NO |
| 24 future rule | in_store / Example Merchant / Other / $100 | td-aeroplan | td-aeroplan | td-base | NETWORK_ACCEPTANCE, BASE_REWARD, POINT_VALUE_UNAVAILABLE | MERCHANT_CLASSIFICATION_REQUIRED, POINT_VALUE_UNAVAILABLE, RULE_NOT_EFFECTIVE, NO_VERIFIED_RULE | NO |
| 25 point valuation unavailable | in_store / Example Merchant / Other / $100 | rbc-avion | rbc-avion → td-aeroplan | rbc-base | NETWORK_ACCEPTANCE, BASE_REWARD, POINT_VALUE_UNAVAILABLE, MAXIMUM_VALUE | MERCHANT_CLASSIFICATION_REQUIRED, POINT_VALUE_UNAVAILABLE, INCOMPARABLE_REWARD_CURRENCIES | NO |
| 26 tied cards | in_store / Example Merchant / Other / $100 | cibc-aventura-gold-visa | cibc-aventura-gold-visa → cibc-aventura-visa-infinite | av-gold-base | NETWORK_ACCEPTANCE, BASE_REWARD, POINT_VALUE_UNAVAILABLE, TRAVEL_POINTS_PREFERENCE | MERCHANT_CLASSIFICATION_REQUIRED, POINT_VALUE_UNAVAILABLE | NO |
| 27 legacy verified owned product | in_store / Example Merchant / Other / $100 | cibc-aventura-visa | cibc-aventura-visa → cibc-costco | av-visa-base | NETWORK_ACCEPTANCE, BASE_REWARD, POINT_VALUE_UNAVAILABLE, TRAVEL_POINTS_PREFERENCE | LEGACY_PRODUCT, MERCHANT_CLASSIFICATION_REQUIRED, POINT_VALUE_UNAVAILABLE | NO |
| 28 unknown cap uses conservative rate | in_store / Example Merchant / Dining / Restaurants / $100 | cibc-costco | cibc-costco → amex-cobalt | costco-dining | NETWORK_ACCEPTANCE, CATEGORY_BONUS, RELEVANT_EXTENDED_WARRANTY, PURCHASE_PROTECTION, MAXIMUM_VALUE | SHARED_CAP, CAP_PROGRESS_UNKNOWN, LOGGED_PURCHASES_ONLY, POST_CAP_RATE_USED | NO |

The two threshold tests use a **synthetic threshold rule only to exercise threshold mechanics**, because the initial Chat 05 verified card set does not currently include a normal `min_spend` checkout earning rule. It is not production financial data.

## 19. Supabase integration and caching

`services/cardReferenceService.js`:

- fetches only active, `data_status='verified'` products for the addable/current reference catalog,
- fetches verified reward and benefit rows for those product IDs,
- normalizes numeric values,
- groups rules/benefits under each exact product,
- caches only public/reference financial data in AsyncStorage and memory,
- TTL = 1 hour,
- on refresh failure, uses the prior cache if available and marks `cacheStale=true`.

`App.js` loads this reference catalog independently of user private data. The signed-in wallet comes from `user_cards`, and MainApp derives checkout candidates by filtering the verified catalog to the user's selected slugs.

No service-role/secret key is introduced.

## 20. Files modified / added / database changes

### Modified

- `App.js`
- `README.md`
- `SUPABASE_SETUP.md`
- `TESTING_CHECKLIST.md`
- `package.json`
- `services/walletService.js`
- `services/purchaseService.js`
- `backend/demo_seed.sql` (warning header only)
- `backend/supabase_schema.sql` (historical/live-schema note only)

### Added

- `engine/recommendationEngine.js`
- `engine/pointValuations.js`
- `services/cardReferenceService.js`
- `tests/recommendationEngine.test.js`
- `tests/recommendationEngine.results.json`
- `docs/RECOMMENDATION_ENGINE_V1.md`
- `docs/CHAT08_SECURITY_HANDOFF.md`
- `docs/CHAT10_QA_HANDOFF.md`

### Database changes in Chat 06

**None.** No migration was created or run. Chat 06 consumes the schema/data already established by Chat 05.

## 21. Remaining limitations

1. Merchant discovery/MCC normalization and real acceptance are not yet production-connected; Chat 07 must provide that context. Until then the engine deliberately declines category bonuses that require classification it cannot prove.
2. Optional SwipeWise purchase logs cannot establish authoritative issuer cap progress. A future trusted cap-state source or carefully defined user-maintained cap state is needed for exact pre-cap recommendations across all capped programs.
3. Some annual reset rules in the verified dataset are not sufficiently exact to derive from purchase dates; the engine refuses to guess.
4. Production monetary point valuations are intentionally absent.
5. Benefit conditions are surfaced but not fully adjudicated against personal eligibility/certificate details; coverage is never guaranteed.
6. `purchaseService` persists estimated monetary reward but not native point-unit/currency detail yet. Point rewards without a valuation therefore save no fake dollar value, but richer points-history storage belongs in a later data/Insights milestone.
7. The current reference loader reads active verified products. The pure engine supports an owned verified legacy product, but a future exact grandfathered legacy-card data path would need the wallet/reference service and RLS policy to return that specific owned product safely. The ambiguous `cibc-aventura` should remain excluded.
8. Live authenticated Expo/Supabase smoke testing was not possible inside this artifact build because project secrets are intentionally absent; local deterministic engine tests passed.

**SwipeWise Recommendation Engine v1 — VERIFIED DATA INTEGRATION: COMPLETE**
