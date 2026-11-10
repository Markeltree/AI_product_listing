import * as listingService from '../services/listing.service.js';
import { getListingOrThrow } from '../services/listing.repository.js';
import { listingDir, safeMediaPath } from '../services/media.service.js';
import { publishListing } from '../services/publish.service.js';
import { delistListing, publishToEbay, runSync } from '../services/marketplace.service.js';
import path from 'node:path';
import { analyzeProduct, extractVideoFrames } from '../services/ai/index.js';
import { getUserSettings } from '../services/settings.service.js';
import { checkSizes, removeUploadedFiles, removeUploadFolder } from '../middleware/upload.js';
import { HttpError, badRequest, notFound } from '../utils/errors.js';
import { parseJsonField } from '../utils/parse.js';
import { validateListing } from '../validators/listing.validator.js';
import { log } from '../utils/logger.js';

// Every endpoint that returns a full listing also returns its current validation issues.
const withIssues = (listing) => ({ listing, issues: validateListing(listing) });

// Runs `check`; if it throws, the uploaded files are deleted before the error goes on.
function withUploadCleanup(files, check) {
  try {
    return check();
  } catch (err) {
    removeUploadedFiles(files);
    throw err;
  }
}

function assertSizes(files) {
  const message = checkSizes(files);
  if (message) throw new HttpError(413, message);
}

export async function list(req, res) {
  res.json(await listingService.listSummaries(req.user.id, req.query));
}

export async function get(req, res) {
  res.json(withIssues(await getListingOrThrow(req.user.id, req.params.id)));
}

export async function create(req, res) {
  const files = req.files || {};
  const product = withUploadCleanup(files, () => {
    assertSizes(files);
    if (!files.images?.length && !files.video?.length) throw badRequest('Add at least one product photo or a product video.');
    const input = parseJsonField(req.body.product, 'The product details could not be read. Please try again.');
    if (!String(input.name || '').trim() || !String(input.type || '').trim()) throw badRequest('Add a product name and type to continue.');
    return input;
  });
  const listing = await listingService.createListing({ id: req.listingId, user: req.user, product, files });
  res.status(202).json({ listing });
}

// One video of a product, and nothing else: the AI reads the details and photos are taken from the video.
export async function scan(req, res) {
  const files = req.files || {};
  withUploadCleanup(files, () => {
    assertSizes(files);
    if (!files.video?.length) throw badRequest('Add a video of your product.');
  });
  const listing = await listingService.createListing({ id: req.listingId, user: req.user, product: {}, files });
  res.status(202).json({ listing });
}

// Bulk: each photo becomes its own listing. Shared details apply to all of them.
// Photos land in a temporary folder (req.listingId) and are moved into their own listings.
export async function createBulk(req, res) {
  const files = req.files?.images || [];
  try {
    if (!files.length) throw badRequest('Choose at least one photo for the bulk upload.');
    assertSizes({ images: files });
    const defaults = parseJsonField(req.body.defaults, 'The shared details could not be read. Please try again.');
    const listings = await listingService.createBulkListings({ user: req.user, files, defaults });
    res.status(202).json({ listings: listings.map((l) => ({ id: l.id, title: l.product.name })) });
  } finally {
    removeUploadFolder(req.user.id, req.listingId);
  }
}

// Reads the photos (and frames from the video) with AI and returns suggested details for the wizard.
// Nothing is saved: the files are deleted right after, and uploaded again with the listing.
export async function analyze(req, res) {
  const images = req.files?.images || [];
  const video = req.files?.video?.[0];
  try {
    if (!images.length && !video) throw badRequest('Add at least one photo or a video to analyse.');
    assertSizes(req.files || {});
    const settings = await getUserSettings(req.user.id);
    let frames = [];
    if (video) {
      try {
        frames = await extractVideoFrames(video.path, path.join(listingDir(req.user.id, req.listingId), 'frames'));
      } catch (err) {
        log.warn('analyze', 'Frame extraction failed', { err });
      }
      if (!frames.length && !images.length) throw new HttpError(422, 'Could not read frames from your video. Try another clip or add a photo.');
    }
    let suggestions;
    try {
      suggestions = await analyzeProduct(images.map((f) => f.path), {
        language: req.body.language || settings.defaultLanguage,
        frames,
      });
    } catch (err) {
      throw new HttpError(502, `Could not read your media: ${err.message}`);
    }
    if (!suggestions) throw new HttpError(503, 'Photo analysis needs an AI key on the server (ANTHROPIC_API_KEY or OPENAI_API_KEY).');
    res.json({ suggestions });
  } finally {
    removeUploadFolder(req.user.id, req.listingId);
  }
}

export async function update(req, res) {
  const listing = await listingService.updateListing(req.user.id, req.params.id, req.body || {});
  res.json(withIssues(listing));
}

export async function regenerate(req, res) {
  const listing = await listingService.startRegeneration(req.user.id, req.params.id);
  res.status(202).json({ listing });
}

export async function remove(req, res) {
  await listingService.deleteListing(req.user.id, req.params.id);
  res.status(204).end();
}

export async function publish(req, res) {
  const state = req.body?.state === 'active' ? 'active' : 'draft';
  res.json(await publishListing(req.user.id, req.params.id, { state }));
}

export async function publishEbay(req, res) {
  const state = req.body?.state === 'active' ? 'active' : 'draft';
  res.json(await publishToEbay(req.user.id, req.params.id, { state }));
}

export async function delist(req, res) {
  res.json(await delistListing(req.user.id, req.params.id, { channel: req.body?.channel || 'all' }));
}

// Runs the cross-delist check for this user's listings now, instead of waiting for the timer.
export async function sync(req, res) {
  res.json(await runSync({ userId: req.user.id }));
}

// ---------- media ----------

export async function getMedia(req, res) {
  const media = await listingService.getMedia(req.user.id, req.params.id, req.params.mediaId);
  const file = media && safeMediaPath(media);
  if (!file) throw notFound();
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(file, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'That listing could not be found.' });
  });
}

// Runs before the upload so files are only written for a listing that can take them.
export async function prepareAddPhotos(req, _res, next) {
  const listing = await listingService.assertCanAddPhotos(req.user.id, req.params.id);
  req.listingId = listing.id;
  next();
}

export async function addPhotos(req, res) {
  const files = req.files?.images || [];
  try {
    assertSizes({ images: files });
    const listing = await listingService.addPhotos(req.user.id, req.params.id, files);
    res.status(201).json(withIssues(listing));
  } catch (err) {
    removeUploadedFiles(req.files);
    throw err;
  }
}

export async function removeMedia(req, res) {
  const listing = await listingService.removeMedia(req.user.id, req.params.id, req.params.mediaId);
  res.json(withIssues(listing));
}
