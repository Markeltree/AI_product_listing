import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sanitizeTags, sanitizeContent } from '../src/validators/listing.sanitizer.js';
import { validateListing, hasBlockingIssues } from '../src/validators/listing.validator.js';
import { mergeSettings } from '../src/validators/settings.validator.js';
import { templateContent } from '../src/services/ai/template.js';
import { reorderImages } from '../src/services/media.service.js';
import { clean } from '../src/utils/text.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { createSessionToken, readSessionToken } from '../src/utils/session.js';
import { createPkcePair, buildAuthorizeUrl } from '../src/services/etsy/index.js';
import { DEFAULT_SETTINGS, TAG_MAX_COUNT, TAG_MAX_LENGTH, TITLE_MAX } from '../src/config/constants.js';

const baseListing = (overrides = {}) => ({
  content: { title: 'Sage Mug', description: 'A mug.', tags: ['mug'], altTexts: ['Sage mug photo'], ...(overrides.content || {}) },
  product: {
    name: 'Sage Mug', type: 'Mug', price: 24, quantity: 2, whoMade: 'i_did', whenMade: 'made_to_order',
    taxonomyId: 1366, shippingProfileId: 7001, readinessStateId: 18201076875, ...(overrides.product || {}),
  },
  media: overrides.media || [{ id: 'm1', kind: 'image' }],
});

test('sanitizeTags caps count, length, dedupes and strips disallowed characters', () => {
  const tags = sanitizeTags(['Mug!!', 'mug', 'MUG', 'a', 'x'.repeat(40), ...Array.from({ length: 20 }, (_, i) => `tag${i}`)]);
  assert.equal(tags.length, TAG_MAX_COUNT);
  assert.ok(tags.every((t) => t.length <= TAG_MAX_LENGTH));
  assert.ok(tags.includes('Mug'));
  assert.equal(tags.filter((t) => t.toLowerCase() === 'mug').length, 1);
  assert.ok(!tags.some((t) => /[!]/.test(t)));
});

test('sanitizeTags accepts a comma-separated string too', () => {
  assert.deepEqual(sanitizeTags('linen, pouch,  linen'), ['linen', 'pouch']);
});

test('sanitizeContent clamps the title to Etsy limits and keeps fallbacks', () => {
  const c = sanitizeContent({ title: 'T'.repeat(300) }, { description: 'fallback desc' });
  assert.equal(c.title.length, TITLE_MAX);
  assert.equal(c.description, 'fallback desc');
});

test('templateContent never invents materials, colors or sizes that were not supplied', () => {
  const out = templateContent({ product: { name: 'Plain Print', type: 'Print', whoMade: 'i_did' }, media: [] });
  const text = `${out.title} ${out.description}`.toLowerCase();
  assert.ok(!/stoneware|silk|cotton|wood|cm|inch|glaze/.test(text), `unexpected fact in: ${text}`);
  assert.equal(out.attributes.find((a) => a.name === 'Materials'), undefined);
  assert.ok(out.title.length <= TITLE_MAX);
  assert.ok(out.tags.length <= TAG_MAX_COUNT);
});

test('templateContent uses supplied facts', () => {
  const out = templateContent({
    product: { name: 'Sage Mug', type: 'Mug', materials: 'stoneware, glaze', colors: 'sage', dimensions: '350 ml', whoMade: 'i_did' },
    media: [{ kind: 'image' }],
  });
  assert.match(out.title, /stoneware/);
  assert.match(out.description, /Materials: stoneware, glaze/);
  assert.equal(out.altTexts.length, 1);
});

test('draft validation needs category and shipping, not photos', () => {
  const l = baseListing({ media: [] });
  assert.equal(hasBlockingIssues(validateListing(l, { forEtsyDraft: true })), false);
  assert.equal(hasBlockingIssues(validateListing(l, { forPublish: true })), true);
});

test('publish validation reports every blocking field', () => {
  const l = baseListing({ product: { taxonomyId: null, shippingProfileId: null, price: null } });
  const fields = validateListing(l, { forPublish: true }).filter((i) => i.severity === 'error').map((i) => i.field);
  for (const f of ['price', 'taxonomyId', 'shippingProfileId']) assert.ok(fields.includes(f), `missing ${f}`);
});

test('title over 140 characters and too many tags are blocked', () => {
  const l = baseListing({ content: { title: 'x'.repeat(141), tags: Array.from({ length: 14 }, (_, i) => `t${i}`) } });
  const fields = validateListing(l).map((i) => i.field);
  assert.ok(fields.includes('title'));
  assert.ok(fields.includes('tags'));
});

test('minimum price is enforced', () => {
  const issues = validateListing(baseListing({ product: { price: 0.1 } }));
  assert.ok(issues.some((i) => i.field === 'price'));
});

test('password hashing verifies the right password only', () => {
  const hash = hashPassword('correct-horse-battery');
  assert.equal(verifyPassword('correct-horse-battery', hash), true);
  assert.equal(verifyPassword('wrong-password', hash), false);
  assert.notEqual(hashPassword('same'), hashPassword('same'), 'salts must differ');
});

test('session tokens verify, and tampering is rejected', () => {
  const token = createSessionToken('user-123');
  assert.equal(readSessionToken(token), 'user-123');
  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ uid: 'admin', exp: Date.now() + 100000 })).toString('base64url');
  assert.equal(readSessionToken(`${forged}.${sig}`), null);
  assert.equal(readSessionToken(`${payload}.bogus`), null);
  assert.equal(readSessionToken(undefined), null);
});

test('PKCE challenge is the S256 hash of the verifier', () => {
  const { verifier, challenge } = createPkcePair();
  assert.equal(challenge, crypto.createHash('sha256').update(verifier).digest('base64url'));
  assert.ok(verifier.length >= 43 && verifier.length <= 128);
});

test('authorize URL carries the required PKCE and scope parameters', () => {
  const url = new URL(buildAuthorizeUrl({ state: 'st', challenge: 'ch' }));
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), 'ch');
  assert.equal(url.searchParams.get('state'), 'st');
  assert.match(url.searchParams.get('scope'), /listings_w/);
});

test('clean collapses whitespace and trims', () => {
  assert.equal(clean('  a   b\n c  ', 50), 'a b c');
});

test('settings merge keeps current values for missing or invalid input and clears IDs with null', () => {
  const current = { ...DEFAULT_SETTINGS, defaultTaxonomyId: 10, defaultShippingProfileId: 20 };
  const next = mergeSettings(current, { defaultTone: 'nope', defaultQuantity: 'abc', defaultShippingProfileId: null });
  assert.equal(next.defaultTone, current.defaultTone);
  assert.equal(next.defaultQuantity, current.defaultQuantity);
  assert.equal(next.defaultTaxonomyId, 10, 'a missing key must not clear the value');
  assert.equal(next.defaultShippingProfileId, null);
  assert.throws(() => mergeSettings(current, { defaultQuantity: 1000 }), /between 1 and 999/);
});

test('reorderImages applies the order and keeps unlisted photos and other media', () => {
  const media = [{ id: 'a', kind: 'image' }, { id: 'b', kind: 'image' }, { id: 'v', kind: 'video' }, { id: 'c', kind: 'image' }];
  assert.deepEqual(reorderImages(media, ['c', 'x', 'a']).map((m) => m.id), ['c', 'a', 'b', 'v']);
});

test('session tickets with a purpose cannot be used as sessions', () => {
  assert.equal(readSessionToken(createSessionToken('u1', { purpose: 'etsy-connect' })), null);
});
