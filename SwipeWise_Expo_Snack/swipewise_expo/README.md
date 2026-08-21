# SwipeWise — Expo + Supabase backend milestone

This is the existing SwipeWise Expo/React Native prototype upgraded to use a real Supabase development backend without redesigning the existing UI or replacing the deterministic recommendation engine.

## What is real now

- Supabase email/password authentication
- Persistent mobile auth sessions
- Auto-created `profiles` and `user_settings` rows
- Supabase-backed wallet (`user_cards`)
- Supabase-backed purchase history (`purchases`)
- Reward preference and appearance persistence
- RLS user isolation
- Public/reference card-data tables prepared for future verified Canadian card data

## What is still demo / deferred

- Canadian reward percentages and point values in `App.js` are still DEMO ONLY
- Nearby merchants are still demo data
- Recommendation engine remains the existing deterministic local engine
- Action Button/App Intents remain a later native-build task
- Safari extension, Apple Pay and App Store work are not part of this milestone

## First setup

Read `SUPABASE_SETUP.md` and follow it in order.

The two SQL files are:

1. `backend/supabase_schema.sql`
2. `backend/demo_seed.sql`

The app expects these project-root environment variables:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Never put a Supabase `service_role` key, `sb_secret_*` key, database password, or any other server secret in this Expo app.
