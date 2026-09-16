# SwipeWise Supabase Setup — Windows + VS Code + iPhone

This project expects the SwipeWise development Supabase backend plus the verified Chat 05 Canadian card-data migration.

## 1. Database state required

For an existing SwipeWise development project, confirm the following are already present:

- Base schema from `backend/supabase_schema.sql`
- Auth/profile/settings/wallet/purchase RLS baseline
- Chat 05 verified migration: `SwipeWise_verified_card_data_v1_2026_08_17.sql`

The verified migration extends `card_products`, `reward_rules`, and `card_benefits` and loads the initial exact verified products/rules/benefits. It was intentionally kept as the Chat 05 source-of-truth migration and is not re-authored by Chat 06.

**Do not run `backend/demo_seed.sql` on a database that already has the verified Chat 05 data.** It is retained only as historical development material.

## 2. Client-safe Supabase values

From Supabase Dashboard copy only:

- Project URL
- Publishable key (`sb_publishable_...`)

Do not copy a secret key, `sb_secret_*`, legacy `service_role`, database password, or JWT signing secret into Expo.

## 3. Create `.env`

At the project root:

```text
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY_HERE
```

`.env` is ignored by `.gitignore`.

## 4. Install and start

```bash
npm install
npx expo start
```

If Expo dependency alignment is needed:

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

For tunnel mode if LAN discovery fails:

```bash
npm i -g @expo/ngrok
npx expo start --tunnel
```

## 5. Verify Recommendation Engine reference access

After signing in, SwipeWise should be able to read active verified reference rows from:

- `card_products`
- `reward_rules`
- `card_benefits`

The app caches this public/reference data for one hour. If refresh fails but a prior cache exists, it can use the stale cache and surfaces a warning.

The wallet itself remains user-specific through `user_cards`; checkout ranking evaluates only wallet products.

## 6. Verify user data

Use Supabase Dashboard to check:

- Authentication → Users
- `profiles`
- `user_settings`
- `user_cards`
- `purchases`

Create User A and User B and verify each authenticated app session can see only its own private rows. The Supabase Table Editor is an admin view and can show rows for both users.

## 7. Development email confirmation

If the existing development project currently has email confirmation disabled for testing, keep that as the previously approved development-only setup. Re-enable/implement the production email verification flow before launch.

---

## Chat 07: merchant-search Edge Function

The TomTom provider key is server-only. Do not add it to Expo `.env` files.

```bash
supabase secrets set TOMTOM_API_KEY=YOUR_TOMTOM_KEY
supabase functions deploy merchant-search
```

`supabase/config.toml` enables JWT verification for this function. The Expo app should contain only the client-safe Supabase URL and publishable key shown in `.env.example`.

No Chat 07 database migration is required.
