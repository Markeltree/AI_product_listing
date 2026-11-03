# Velista Mobile (Expo)

The phone app for Velista Listing AI. It talks to the Velista API in `../backend`, so start that first.

## What it does

- **Sign in and sign up.** The session token is kept in the device's secure storage.
- **Listings.** Search, status filters, pull to refresh, live progress for listings still being written, delete with confirmation.
- **New listing.** Pick up to 5 photos, add a video, record a voice note with the phone's microphone, then fill in product details and review.
- **Editor.** Edit the title, description, tags, category (searched against Etsy's category tree), attributes, price, quantity, who made it, when made, craft supply, shipping profile, and readiness state. Reorder photos, edit alt text, add or remove photos, and regenerate the copy. A readiness checklist and a preview show what will go live.
- **Publish.** Save a draft to Etsy or publish live. Problems are shown before anything is sent.
- **Bulk upload.** One listing per photo, with shared details.
- **Settings.** Connect Etsy through the system browser, refresh the shop, disconnect, set listing defaults, and sign out.

## Run it

```bash
npm install
npx expo start
```

Expo Router reads routes from `src/app/`. Shared code lives in `src/lib`, reusable UI in `src/components`, and the design tokens in `src/theme.ts`.

Use a development build for the native modules (camera roll, audio recording, secure storage):

```bash
npx expo run:ios            # local, needs Xcode (macOS)
npx expo run:android        # local, needs Android Studio
npx eas-cli@latest build --profile development --platform all   # cloud build, no local tooling
```

## Checks

```bash
npm run typecheck           # TypeScript, strict mode
npx eslint .                # lint (Expo ESLint config)
npm run export:web          # bundles the web preview to make sure everything resolves
```

## Connecting to the server

- **Development:** no setup needed. The app uses the computer that runs Expo (Metro's address, port 3000); the Android emulator falls back to `http://10.0.2.2:3000`. The server listens on all network interfaces, so a phone on the same Wi-Fi can reach it. If Windows Firewall asks, allow Node on private networks.
- **Override or production:** set `EXPO_PUBLIC_API_URL` in `mobile/.env` (see `.env.example`) and restart Expo. The app allows local-network HTTP on iOS. Android 9+ blocks cleartext HTTP by default, so use an HTTPS tunnel (for example `cloudflared` or `ngrok`) if the Android build can't reach the server.
- **Etsy connect:** Etsy redirects to the server, which then opens `velista://settings` on the phone. The `velista` scheme is set in `app.json`. The server's `APP_URL` and `ETSY_REDIRECT_URI` must be reachable from Etsy, so the server needs a public address for real Etsy testing.
- **Web preview:** start the server with `CORS_ORIGINS=http://localhost:8090`, then `npm run export:web` with `EXPO_PUBLIC_API_URL` set, and serve `dist/` with SPA fallback.

## Not covered by automated tests

- Native pickers, microphone recording, secure storage, and the Etsy in-app browser flow need a development build on a device.
- `Alert` dialogs (delete, discard, sign out) are native-only; React Native Web does not show them.
