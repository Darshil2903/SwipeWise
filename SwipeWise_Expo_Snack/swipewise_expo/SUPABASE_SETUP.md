# SwipeWise Supabase Setup — Windows + VS Code + iPhone

Follow this file in order. The app will show a "Connect Supabase" screen until `.env` contains your real development-project values.

## 1. Create the Supabase development project

1. Open the Supabase Dashboard and create a new project.
2. Recommended project name: `SwipeWise Development`.
3. Choose a strong database password and save it in your password manager. It does **not** go into the Expo app.
4. Choose the region closest to you for development.
5. Wait until the database is ready.

## 2. Run the SwipeWise database SQL

In Supabase Dashboard:

1. Open **SQL Editor**.
2. Create a new query.
3. In VS Code, open `backend/supabase_schema.sql`.
4. Copy the entire file into the Supabase SQL Editor.
5. Click **Run**.
6. Create another new SQL query.
7. Open `backend/demo_seed.sql` in VS Code.
8. Copy the entire file into the SQL Editor.
9. Click **Run**.

The demo seed only creates the five demo card-product identities required for the current wallet prototype. It does not insert demo reward percentages into Supabase.

## 3. Development email-confirmation setting

Hosted Supabase projects normally require email confirmation before a new user receives a session. For this first development milestone, you may temporarily disable **Confirm Email** in the Email Auth provider settings so Create Account signs in immediately.

Turn confirmation back on later when SwipeWise implements the production email deep-link flow.

## 4. Get the client-safe Supabase values

In the Supabase project, open the **Connect** dialog or **Project Settings → API Keys**.

Copy only:

- **Project URL** — looks like `https://xxxxxxxx.supabase.co`
- **Publishable key** — normally starts with `sb_publishable_`

Do not copy a secret key, `sb_secret_*`, legacy `service_role`, database password, or JWT signing secret into Expo.

## 5. Open the project in VS Code

1. Extract the SwipeWise ZIP to a normal folder on your Windows computer.
2. Open VS Code.
3. Click **File → Open Folder**.
4. Choose the extracted `swipewise_expo` folder — the folder containing `App.js`, `package.json`, and `app.json`.

## 6. Install dependencies

In VS Code:

**Terminal → New Terminal**

Make sure the terminal path ends in your `swipewise_expo` project folder, then run:

```bash
npm install
```

After that finishes, run this in the same VS Code terminal:

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

The second command lets Expo verify/install compatible versions of the Supabase React Native dependencies for the project's Expo SDK. This project is pinned to Expo SDK 54 for the simplest physical-iPhone Expo Go test from the Apple App Store at this milestone.

## 7. Create `.env`

In the VS Code Explorer, in the same folder as `App.js` and `package.json`:

1. Create a new file named exactly `.env`.
2. Paste:

```text
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY_HERE
```

3. Replace the URL with your Supabase Project URL.
4. Replace the key with your Supabase Publishable key.
5. Save the file.

`.env` is already ignored by `.gitignore`.

## 8. Start SwipeWise

In VS Code:

**Terminal → New Terminal**

Run this from the `swipewise_expo` project folder:

```bash
npx expo start
```

If you changed `.env` while Expo was already running, stop Expo with `Ctrl+C` and run `npx expo start` again.

## 9. Open on iPhone

1. Install/open **Expo Go** on your iPhone.
2. Keep the Windows PC and iPhone on the same network when possible.
3. Use the QR code shown by Expo CLI to open SwipeWise in Expo Go.
4. If LAN discovery does not work, return to **VS Code → Terminal → New Terminal** in the `swipewise_expo` folder and run:

```bash
npm i -g @expo/ngrok
```

Then run, in that same terminal and same project folder:

```bash
npx expo start --tunnel
```

Scan the new QR code.

## 10. Verify data in Supabase

Use these Dashboard areas:

- **Authentication → Users**: confirms account creation.
- **Table Editor → profiles**: confirms the profile trigger worked.
- **Table Editor → user_settings**: confirms default settings were created.
- **Table Editor → user_cards**: confirms wallet selections were saved.
- **Table Editor → purchases**: confirms purchase logging worked.

## 11. First security test

Create User A, add a card and log a purchase. Sign out. Create User B.

User B's SwipeWise wallet/history should be empty. Then sign back in as User A and User A's wallet/history should return.

That behavior is enforced by Supabase Row Level Security, not by simply hiding rows in the UI. Note: **Supabase Table Editor is an admin view**, so it can show rows for both users. The isolation test is that User B's authenticated app session cannot query User A's rows.
