# SwipeWise Recommendation Engine v1 + Backend Test Checklist

## Automated deterministic engine tests

- [ ] Run `npm run test:engine`.
- [ ] Confirm all 28 scenarios pass.
- [ ] Review `tests/recommendationEngine.results.json` for exact ranked order, rules, reasons, warnings, and amount requirement.

## Supabase reference-data integration

- [ ] App loads active verified exact card products from `card_products`.
- [ ] App loads verified reward rows from `reward_rules`.
- [ ] App loads verified benefits from `card_benefits`.
- [ ] Old ambiguous `cibc-aventura` does not appear as an addable verified product.
- [ ] Wallet onboarding/add-card uses canonical exact product names.
- [ ] Best Card evaluates only products present in the signed-in user's `user_cards`.
- [ ] Removing a wallet card removes it from checkout candidates.
- [ ] A reference refresh failure with an existing cache shows stale-cache warning behavior.

## Quick Swipe regression

- [ ] In Store and Online remain explicit first choices.
- [ ] Online-only reward rule does not apply to an In Store purchase.
- [ ] Merchant-specific verified rule beats category/base rules when applicable.
- [ ] Category rule does not apply when required merchant/MCC classification is unavailable; warning is shown instead.
- [ ] Amount screen appears only when a known amount-dependent rule can change the winner.
- [ ] Unknown cap progress does not pretend the cap is unused.
- [ ] Post-cap rate is used when the cap is known reached.
- [ ] Shared cap groups are treated as one cap.
- [ ] Expired/future rules do not apply.
- [ ] Temporary rules apply only inside their effective dates and when all material conditions are known.
- [ ] Unsupported networks cannot win.
- [ ] Unknown acceptance is warned, not silently asserted.
- [ ] Point currencies stay separate.
- [ ] No point cash-equivalent is displayed unless a separate SwipeWise valuation exists.
- [ ] Insurance coverage limits are never added as reward dollars.
- [ ] `Why This Card` uses deterministic reason/warning codes and verified source metadata.

## Persistence / RLS regression

- [ ] Create Test User A; add cards; log a purchase.
- [ ] Confirm `user_cards` and `purchases` rows exist for User A.
- [ ] Close/reopen Expo Go and confirm session/wallet/history persist.
- [ ] Sign out and create Test User B.
- [ ] Confirm User B cannot see User A wallet/history.
- [ ] Sign back in as User A and confirm original data returns.

If a test fails, record exact input context, owned card slugs, expected winner, actual winner, rule IDs, reason codes, warning codes, and the relevant Supabase rows before changing logic.

---

## Chat 07 regression

Automated:

```bash
npm run test:engine
npm run test:merchant
```

Expected: engine 28/28 and merchant context 15/15.

Physical-iPhone/live-provider cases are documented in `docs/CHAT10_MERCHANT_LOCATION_QA.md` and must not be marked passed based on unit tests alone.
