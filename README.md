# Velista

The reselling companion that lists your stuff once and sells everywhere. Film or photograph a product, Velista's AI drafts the listing, and you publish it to Etsy and eBay from your phone. When the item sells on one marketplace, Velista ends it on the other.

## Repository layout

```
backend/   Node.js API (Express). AI listing generation, Etsy and eBay integrations,
           cross-delist sync, Supabase or SQLite storage. Deployed to Railway.
mobile/    Expo (React Native) app for iOS and Android. Talks to the backend API.
```

## Quick start

```bash
# 1. API
cd backend
npm install
cp .env.example .env      # fill in your keys
npm run dev               # http://localhost:3000

# 2. App (second terminal)
cd mobile
npm install
npx expo start
```

On a phone, the app finds the API on your computer automatically during development. Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to use a deployed backend instead.

- Backend setup, marketplaces, deployment and tests: [backend/README.md](backend/README.md)
- App setup and builds: [mobile/README.md](mobile/README.md)
