# Chat 08 Security Handoff — Recommendation Engine v1

## New/changed data access

- New `services/cardReferenceService.js` reads public/reference `card_products`, `reward_rules`, and `card_benefits` through the existing client-safe Supabase client.
- It never uses a service-role/secret key.
- New reference cache is stored in AsyncStorage under `swipewise.reference-data.v1` and contains public/reference card rules/benefits only, not auth tokens, wallet rows, purchases, coordinates, or payment credentials.
- Cache TTL is one hour. If refresh fails, stale cache can be used with `CACHE_STALE` warning.

## Wallet/private data

- `user_cards` remains the source of which cards a signed-in user owns.
- Checkout ranking receives only the current user's wallet slugs/products from the existing RLS-protected flow.
- `services/walletService.js` now allows new additions/sync only for active verified products.
- No full card number, CVV, PIN, expiry, or other payment credential was added.

## Purchase history / caps

- Recommendation logic can read the already-loaded current user's `purchases` in memory to derive a **minimum known** cap spend.
- It does not issue a new cross-user purchase query.
- Optional purchase logs are explicitly non-authoritative for issuer cap progress; the engine never assumes missing spend is zero.
- Only matching card/rule/cap-group/period purchases can count toward derived minimums.
- A future authoritative cap state, if added, should receive a separate security/privacy review because it may require more complete spending information than V1 currently stores.

## Security-sensitive decisions to review

1. Confirm reference-table RLS exposes only intended public/verified rows to client sessions.
2. Confirm `user_cards` and `purchases` RLS still enforce `auth.uid()` isolation after joins to `card_products`.
3. Review whether reference cache should be cleared on sign-out. It currently holds public data only, so there is no user-data exposure, but clearing behavior can be standardized.
4. Confirm Supabase publishable key only; no elevated key in Expo or cached files.
5. Confirm logs/errors do not serialize full user purchase history or auth session tokens.
6. If future legacy exact products are readable for existing owners, design RLS so ownership can expose only the necessary product reference without reactivating uncertain/retired products globally.

No new database migration or new secret was introduced by Chat 06.
