// Turns a queued haul into draft listings: sample frames -> find the products -> save the best
// frames of each product -> write each listing. Runs in the background; progress is on haul.step.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import { HAUL_SAMPLE_FRAMES, HAUL_STATUS } from '../config/constants.js';
import { store } from '../db/index.js';
import { storage } from '../storage/index.js';
import { log } from '../utils/logger.js';
import { now } from '../utils/parse.js';
import { detectHaulItems, extractAudio, grabFullFrame, sampleVideoFrames, transcribeAudio } from './ai/index.js';
import { createHaulListing, deleteListing } from './listing.service.js';
import { listingDir, toMediaRecord } from './media.service.js';
import { getUserSettings } from './settings.service.js';

// Shown to the seller, so it stays in plain language.
const NO_ITEMS = 'We could not find any products in this video. Try again with each item in clear view.';
const FAILED = 'We could not read this video. Please try filming it again.';

class HaulProblem extends Error {}

async function updateHaul(userId, haulId, change) {
  const haul = await store.getHaul(userId, haulId);
  if (!haul) return null;
  change(haul);
  haul.updatedAt = now();
  await store.saveHaul(haul);
  return haul;
}

// Nothing is said out loud, or no transcription key is set: the haul still works from the pictures.
async function readSpeech(videoPath, workDir) {
  if (!config.openai.apiKey) return null;
  try {
    const audio = await extractAudio(videoPath, path.join(workDir, 'speech.mp3'));
    return audio ? await transcribeAudio(audio, 'speech.mp3', 'audio/mpeg') : null;
  } catch (err) {
    log.warn('haul', 'Could not read the speech in a video', { err });
    return null;
  }
}

// Saves the item's chosen moments at full quality, using the small sampled frame if that fails.
async function savePhotos({ userId, listingId, item, videoPath, frames }) {
  const dir = listingDir(userId, listingId);
  await fs.mkdir(dir, { recursive: true });
  const media = [];
  for (const index of item.frames) {
    const frame = frames[index];
    const filePath = path.join(dir, `${randomUUID()}.jpg`);
    if (!(await grabFullFrame(videoPath, frame.seconds, filePath).catch(() => false))) await fs.copyFile(frame.path, filePath);
    const { size } = await fs.stat(filePath);
    media.push(toMediaRecord({ originalname: `${item.name}.jpg`, mimetype: 'image/jpeg', size }, { kind: 'image', filePath }));
  }
  return media;
}

async function createListings({ userId, haul, items, videoPath, frames }) {
  const settings = await getUserSettings(userId);
  for (const item of items) {
    const id = randomUUID();
    await createHaulListing({
      id, userId, haulId: haul.id, settings, origins: item.origins,
      media: await savePhotos({ userId, listingId: id, item, videoPath, frames }),
      product: {
        name: item.name, type: item.type, colors: item.colors, materials: item.materials,
        brand: item.brand, dimensions: item.dimensions, notes: item.notes,
      },
    });
  }
}

// A job that restarts must not leave two sets of listings behind.
async function removePreviousAttempt(userId, haulId) {
  const rows = await store.listListingSummariesByHaul(userId, haulId);
  await Promise.all(rows.map((row) => deleteListing(userId, row.id)));
}

// The video is only needed here, and removing it keeps disk use and stored footage small.
const removeVideo = (haul) => storage.remove(haul.sourceKey)
  .catch((err) => log.warn('haul', 'Could not remove a processed video', { haulId: haul.id, err }));

// finalAttempt: false when a queue will retry on failure, so the error is passed back to it.
export async function runHaul(userId, haulId, { finalAttempt = true, detect = detectHaulItems } = {}) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'velista-haul-'));
  const setStep = (step) => updateHaul(userId, haulId, (h) => { h.status = HAUL_STATUS.PROCESSING; h.step = step; });
  let source;
  try {
    const haul = await setStep('Getting your video ready');
    if (!haul) return;
    await removePreviousAttempt(userId, haulId);
    source = await storage.toLocalFile(haul.sourceKey);

    await setStep('Watching your video');
    const frames = await sampleVideoFrames(source.path, path.join(workDir, 'frames'), HAUL_SAMPLE_FRAMES);
    if (!frames.length) throw new HaulProblem(FAILED);
    const transcript = await readSpeech(source.path, workDir);

    await setStep('Finding your products');
    const items = await detect(frames.map((f) => f.path), { transcript });
    if (!items?.length) throw new HaulProblem(NO_ITEMS);

    await setStep(`Found ${items.length} item${items.length === 1 ? '' : 's'}, preparing drafts`);
    await createListings({ userId, haul, items, videoPath: source.path, frames });

    await updateHaul(userId, haulId, (h) => {
      h.status = HAUL_STATUS.REVIEW;
      h.step = null;
      h.error = null;
      h.itemCount = items.length;
    });
    await removeVideo(haul);
    log.info('haul', 'Haul ready for review', { haulId, items: items.length, frames: frames.length, speech: Boolean(transcript) });
  } catch (err) {
    const known = err instanceof HaulProblem;
    if (!finalAttempt && !known) {
      log.error('haul', 'Haul failed, will retry', { haulId, err });
      await updateHaul(userId, haulId, (h) => { h.step = 'Had a problem, trying again shortly'; }).catch(() => {});
      throw err;
    }
    log.error('haul', 'Haul failed', { haulId, err });
    const haul = await updateHaul(userId, haulId, (h) => {
      h.status = HAUL_STATUS.FAILED;
      h.step = null;
      h.error = known ? err.message : FAILED;
    });
    if (haul) await removeVideo(haul);
  } finally {
    await source?.cleanup();
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Fire and forget. runHaul records failures on the haul, so this only logs the unexpected.
export function startHaul(userId, haulId) {
  runHaul(userId, haulId).catch((err) => log.error('haul', 'Haul crashed', { haulId, err }));
}

// Without a queue, a restart would leave hauls waiting forever, so they start again here.
export async function resumeInterruptedHauls() {
  const stuck = [
    ...await store.listHaulsByStatus(HAUL_STATUS.QUEUED),
    ...await store.listHaulsByStatus(HAUL_STATUS.PROCESSING),
  ];
  for (const haul of stuck) startHaul(haul.userId, haul.id);
}
