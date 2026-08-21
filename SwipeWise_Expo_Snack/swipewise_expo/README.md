# SwipeWise — Expo / Snack conversion

This folder is a React Native / Expo conversion of the uploaded SwiftUI/Xcode v0.1 project.

## Fastest way to run in Chrome with Snack

1. Open https://snack.expo.dev in Chrome.
2. Create a new blank Snack.
3. Open this folder's `App.js`.
4. Copy all of `App.js` and replace the code in Snack's `App.js`.
5. Click **Web** in Snack's preview panel.
6. For iPhone testing, install **Expo Go** on the iPhone and use Snack's QR / device option.

This converted version deliberately uses only React + React Native APIs so there are no extra Snack dependencies to configure.

## What was converted

- Splash screen
- Full onboarding flow
- Manual card selection
- Reward preference
- Dark and light UI
- Home dashboard
- Wallet + card details + add/remove cards
- Quick Swipe: In Store / Online
- Merchant and category selection
- Conditional amount entry
- Recommendation ranking logic from the Swift project
- Why This Card comparison
- Override card selection
- Purchase logging + history
- Insights: overview, spending, rewards, impact, recommendations
- Settings screens
- Original demo Canadian card catalog / reward rules
- Original Supabase schema copied into `backend/`

## Native-only items not available inside Snack

The original Swift project's App Intents / iPhone Action Button integration cannot run in Snack because those are native iOS APIs. They can be added back when the Expo project is moved to an EAS/native iOS build.

## Important

Reward rates in this prototype are demo values carried over from the original project and are not intended for real financial decisions.
