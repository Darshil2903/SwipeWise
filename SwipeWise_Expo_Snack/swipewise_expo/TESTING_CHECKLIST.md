# SwipeWise Backend Milestone Test Checklist

Use this after `supabase_schema.sql`, `demo_seed.sql`, `.env`, `npm install`, and `npx expo start` are complete.

- [ ] Start SwipeWise in Expo Go.
- [ ] Create Test User A.
- [ ] Supabase Dashboard → Authentication → Users shows User A.
- [ ] Table Editor → `profiles` has User A's UUID and display name.
- [ ] Table Editor → `user_settings` has User A's UUID.
- [ ] Complete onboarding and add at least one demo card product.
- [ ] Table Editor → `user_cards` has User A's wallet row(s).
- [ ] Close Expo Go completely, reopen SwipeWise, and confirm User A is still signed in.
- [ ] Run Quick Swipe and log a test purchase.
- [ ] Table Editor → `purchases` has the new row.
- [ ] Open SwipeWise History and confirm the purchase loads from Supabase.
- [ ] Sign out.
- [ ] Create Test User B.
- [ ] Confirm User B's wallet and History do not show User A's data.
- [ ] Add a different card/purchase for User B and confirm only User B sees it.
- [ ] Sign out and sign back in as User A.
- [ ] Confirm User A's original wallet and purchase history return.

If any step fails, record the exact screen, error message, and which Supabase table did or did not change before troubleshooting.
