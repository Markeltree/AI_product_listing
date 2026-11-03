// Runs the app against the mock Etsy and mock eBay in one command: npm run dev:mock
// Works on any shell (no inline env vars). Real Etsy keys in .env are ignored for this run.
const MOCK = `http://localhost:${process.env.MOCK_ETSY_PORT || 4010}`;
process.env.ETSY_API_KEY = 'testkey';
process.env.ETSY_SHARED_SECRET = 'testsecret';
process.env.ETSY_API_BASE = `${MOCK}/v3`;
process.env.ETSY_AUTHORIZE_URL = `${MOCK}/oauth/connect`;
process.env.ETSY_TOKEN_URL = `${MOCK}/v3/public/oauth/token`;

// eBay mock (test/mock-ebay): every eBay host points at it.
const EBAY = `http://localhost:${process.env.MOCK_EBAY_PORT || 4020}`;
process.env.EBAY_ENV = 'sandbox';
process.env.EBAY_CLIENT_ID = 'mock-client';
process.env.EBAY_CLIENT_SECRET = 'mock-secret';
process.env.EBAY_RUNAME = 'Velista-Mock-RuName';
for (const k of ['EBAY_API_BASE', 'EBAY_MEDIA_BASE', 'EBAY_IDENTITY_BASE']) process.env[k] = EBAY;
process.env.EBAY_AUTHORIZE_URL = `${EBAY}/oauth2/authorize`;
process.env.EBAY_TOKEN_URL = `${EBAY}/identity/v1/oauth2/token`;
process.env.MOCK_EBAY_ACCEPT_URL ||= `http://localhost:${process.env.PORT || 3000}/api/ebay/callback`;

await import('./server.mjs');
await import('../mock-ebay/server.mjs');
const { start } = await import('../../src/index.js');
await start();
console.log(`Mock Etsy active. Payloads Etsy would receive: ${MOCK}/__state`);
console.log(`Mock eBay active. Payloads eBay would receive: ${EBAY}/__state`);
