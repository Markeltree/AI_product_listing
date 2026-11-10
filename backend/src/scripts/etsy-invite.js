// Creates a link that a shop owner (for example a beta tester) opens to connect their Etsy shop to a
// Velista account. They do not need a Velista login.
//
//   npm run etsy:invite -- team@example.com            (link valid for 48 hours)
//   npm run etsy:invite -- team@example.com 24         (custom hours, 1-168)
//
// The shop is connected to the Velista account with that email, so whoever signs in to that account
// in the app can publish to the shop. Send the link privately: anyone who opens it before it expires
// can connect an Etsy shop to that account.
import { config } from "../config/index.js";
import { initStore, store } from "../db/index.js";
import { etsyConfigured } from "../services/etsy/index.js";
import { createInviteUrl } from "../services/etsyConnection.service.js";

const [email, hoursArg] = process.argv.slice(2);
const hours = Math.min(168, Math.max(1, Number(hoursArg) || 48));
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

if (!email)
  fail(
    "Pass the email of the Velista account the shop should connect to: npm run etsy:invite -- you@example.com",
  );
if (!etsyConfigured()) fail("ETSY_API_KEY is empty in .env.");

const app = new URL(config.appUrl);
if (app.protocol !== "https:" || /^(localhost|127\.)/.test(app.hostname)) {
  fail(
    `APP_URL is ${config.appUrl}. The shop owner's browser must reach this server, so APP_URL has to be a public HTTPS address ` +
      "(an ngrok tunnel or your deployed URL). Set it in .env, add APP_URL + /api/etsy/callback to your Etsy app, restart the server, then run this again.",
  );
}

await initStore();
const user = await store.findUserByEmail(String(email).trim().toLowerCase());
if (!user)
  fail(
    `No Velista account uses ${email}. Sign up in the app first, then run this again.`,
  );

const url = createInviteUrl(user.id, hours);
console.log(`
Etsy connect link for ${user.email} (valid ${hours} hours):

${url}

Before sending it, make sure:
  1. The server is running and reachable at ${config.appUrl}
  2. Your Etsy app (etsy.com/developers/your-apps) lists this callback: ${config.etsy.redirectUri}
`);
process.exit(0);
