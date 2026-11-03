# Velista backend

API for the Velista app: turns product photos, a short video or a voice note into a listing, publishes it to Etsy and eBay, and ends it on one marketplace when it sells or ends on the other.

## What it does

| Feature | Notes |
|---|---|
| Accounts | Email and password. The app sends a signed Bearer token. |
| Photo, video and voice to listing | Up to 5 photos; 3 key frames pulled from a video with ffmpeg (bundled); voice notes transcribed with OpenAI Whisper. |
| AI copy | Anthropic Claude or OpenAI vision. Falls back to a template that only uses facts the seller entered. |
| Etsy | OAuth 2.0 with PKCE, token refresh, shop and shipping profiles, category search, draft and publish. |
| eBay | OAuth, business policies and ship-from location setup, photo upload, category and required item specifics, publish through the Inventory API. |
| Cross-delist sync | Every few minutes, listings live on both marketplaces are checked. A sale or end on one ends the other; partial sales lower the other's quantity. |
| Invite links | `npm run etsy:invite -- you@example.com` makes a 48-hour link a shop owner opens to connect their Etsy shop, no Velista login needed. |

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env      # then fill in your keys
npm run dev               # http://localhost:3000, restarts on file changes
```

With no keys it still runs: local SQLite in `data/`, template-written listings, and no marketplaces.

To try everything offline against fake Etsy and eBay APIs: `npm run dev:mock`.

## Configuration

All settings are environment variables. `.env.example` lists them with instructions. The important ones:

| Variable | Purpose |
|---|---|
| `APP_URL` | Public URL of this server. Marketplaces send sellers back to `APP_URL/api/etsy/callback` and `APP_URL/api/ebay/callback`, so it must be HTTPS and reachable from a phone (your Railway URL, or an ngrok tunnel locally). |
| `SESSION_SECRET` | Signs login tokens. Keep it the same across deploys or everyone is signed out. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Production database. Leave blank to use local SQLite. |
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | Listing AI. `OPENAI_API_KEY` also enables voice transcription. |
| `ETSY_API_KEY`, `ETSY_SHARED_SECRET` | From etsy.com/developers/your-apps. |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RUNAME`, `EBAY_ENV` | From developer.ebay.com. `EBAY_ENV=sandbox` for testing. |
| `SYNC_INTERVAL_MINUTES` | Cross-delist check interval (default 3, 0 turns it off). |
| `DATA_DIR`, `UPLOAD_DIR` | Where SQLite and uploaded media live. Point them at a persistent volume in production. |

## Connecting marketplaces

**Etsy**
1. Create an app at https://www.etsy.com/developers/your-apps.
2. Add `APP_URL/api/etsy/callback` as a redirect URI.
3. Set `ETSY_API_KEY` (keystring) and `ETSY_SHARED_SECRET`.

New Etsy apps have personal access, which allows a handful of connected shops (Etsy documents up to 5). Request Commercial Access before opening Velista to more sellers.

**eBay**
1. Create a keyset at https://developer.ebay.com/my/keys (Sandbox to test, Production to sell).
2. Under User Tokens, add a RuName. Set its auth accepted and declined URLs to `APP_URL/api/ebay/callback` (HTTPS).
3. Set `EBAY_CLIENT_ID` (App ID), `EBAY_CLIENT_SECRET` (Cert ID) and `EBAY_RUNAME`.
4. In the app's Settings, connect eBay and choose shipping, payment and return policies and a ship-from location.

## Database (Supabase)

Run `supabase/schema.sql` in the Supabase SQL editor. It is safe to run again after updates, and it must be re-run when new tables are added (for example `ebay_connections`).

## Deploy to Railway

1. New project, then Deploy from GitHub repo, then pick this repository.
2. Service Settings: **Root Directory** `backend`, **Start Command** `npm start`, **Healthcheck Path** `/api/health`. (Railway no longer accepts config files for new services, so set these in the dashboard.)
3. Add a **Volume** mounted at `/data`, and set `DATA_DIR=/data` and `UPLOAD_DIR=/data/uploads`. Without it, uploaded photos are lost on every deploy.
4. Copy the variables from your `.env` into Railway's Variables. Set `APP_URL` to the Railway domain (Settings, Networking, Generate Domain). Railway sets `PORT` itself.
5. Keep **one replica**, and use a paid plan with **serverless off**. Generation and the cross-delist sync run inside the server process, so a sleeping service stops ending sold listings.
6. Update the Etsy redirect URI and the eBay RuName URLs to the Railway domain.

## Layout

```
src/
  index.js            Entry point: folders, database, sync loop, listen
  app.js              Express app: middleware, /api routes, error handler
  config/             Environment config and shared listing rules
  routes/             URL to controller mapping, one file per area
  controllers/        Read the request, call a service, send the response
  services/
    listing.service.js           Create, edit, regenerate, delete listings and media
    generation.service.js        Background generation: video frames, transcript, AI copy
    publish.service.js           Etsy draft and publish
    marketplace.service.js       eBay publish, ending listings, cross-delist sync
    etsyConnection.service.js    Etsy OAuth, invite links, shop status
    ebayConnection.service.js    eBay OAuth, policies and location setup
    connectLinks.js              Shared OAuth tickets, return targets, reachability checks
    ai/                          Claude/OpenAI calls, prompts, ffmpeg frames, template fallback
    etsy/                        Etsy API client
    ebay/                        eBay API client, listing builder, item specifics
  validators/         Input checks and sanitizers
  middleware/         Auth, uploads, CORS, rate limiting, errors
  db/                 Supabase or SQLite behind one interface
  scripts/            Command-line tools (etsy-invite)
  utils/              Errors, tokens, passwords, text helpers
supabase/schema.sql   Database schema
test/
  unit.test.js        npm test
  crosslist-e2e.mjs   npm run test:crosslist: connect, publish to both, simulate sales, sync
  mock-etsy/, mock-ebay/   Local stand-ins for the marketplace APIs
```

## Security

| Layer | Where | What it does |
|---|---|---|
| Secure headers | `src/middleware/security.js` | Helmet: CSP `default-src 'none'`, HSTS, nosniff, frame and referrer protection; API responses are `Cache-Control: no-store`. |
| Rate limits | `src/middleware/rateLimit.js` | Whole API 1000/min per IP; failed sign-ins 10 per 15 min per IP and email; sign-ups 5/hour per IP; AI calls 60/hour per user; Etsy/eBay actions 60 per 10 min per user; "Check sales now" 6/min. Uses the real client IP behind Railway (`TRUST_PROXY`). |
| Input validation | `src/validators/schemas.js`, `src/middleware/validate.js` | zod schemas for every JSON body, query and URL id: types, lengths, allowed values; unknown keys dropped. Bad ids return 404 before touching the database. |
| XSS | `src/utils/text.js` | HTML tags, script blocks and control characters are stripped from all stored text; eBay HTML descriptions are escaped; the one HTML page escapes everything it prints. |

## Tests

```bash
npm test                  # unit tests + security tests (headers, validation, XSS, rate limits)
npm run test:crosslist    # end-to-end Etsy + eBay flow against the mocks, in a throwaway database
```

## Before going live

- **Signups.** Anyone who can reach the API can create an account and spend AI credits. Limit signups before sharing the URL publicly.
- **Files.** Media is stored on disk (`UPLOAD_DIR`). For more than one server, move it to object storage such as S3.
- **Background work.** Generation and sync run in-process. Fine for one instance; use a queue for more.
- **Costs.** Each listing makes one vision request (up to 8 images) plus one transcription when a voice note is attached. Each active Etsy listing costs the seller Etsy's listing fee.
