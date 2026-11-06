// A haul is one video showing many products. This file covers its upload; turning a queued haul into
// draft listings is the job of the haul worker.
//   POST /api/hauls               creates the haul and returns where to upload the video
//   PUT  <upload.url>             the phone sends the file
//   POST /api/hauls/:id/complete  the server checks the file arrived and queues the haul
import { randomUUID } from 'node:crypto';
import { HAUL_STATUS, HAUL_UPLOAD_TTL_MS, MAX_HAUL_VIDEO_BYTES, VIDEO_MIME } from '../config/constants.js';
import { store } from '../db/index.js';
import { storage } from '../storage/index.js';
import { HttpError, badRequest, conflict, notFound } from '../utils/errors.js';
import { now } from '../utils/parse.js';
import { createSessionToken, readTokenData } from '../utils/session.js';

const TOO_LARGE = `The video must be ${MAX_HAUL_VIDEO_BYTES / (1024 * 1024)} MB or smaller.`;
const uploadPurpose = (haulId) => `haul-upload:${haulId}`;

// The storage location stays on the server.
const toPublicHaul = ({ sourceKey, ...haul }) => haul;

async function getHaulOrThrow(userId, haulId) {
  const haul = await store.getHaul(userId, haulId);
  if (!haul) throw notFound('That haul could not be found.');
  return haul;
}

async function saveHaul(haul) {
  haul.updatedAt = now();
  await store.saveHaul(haul);
  return haul;
}

export async function createHaul({ user, mime, size, origin }) {
  const extension = VIDEO_MIME[mime];
  if (!extension) throw badRequest('The video must be MP4, MOV, WEBM or MKV.');
  if (size > MAX_HAUL_VIDEO_BYTES) throw new HttpError(413, TOO_LARGE);

  const id = randomUUID();
  const createdAt = now();
  const haul = {
    id,
    userId: user.id,
    status: HAUL_STATUS.UPLOADING,
    step: null,
    error: null,
    sourceKey: `${user.id}/hauls/${id}/source${extension}`,
    sourceMime: mime,
    sourceSize: null,
    itemCount: 0,
    createdAt,
    updatedAt: createdAt,
  };
  await store.saveHaul(haul);

  const ticket = createSessionToken(user.id, { ttlMs: HAUL_UPLOAD_TTL_MS, purpose: uploadPurpose(id) });
  const upload = await storage.createUpload({
    key: haul.sourceKey,
    mime,
    localUrl: `${origin}/api/hauls/${id}/upload?ticket=${encodeURIComponent(ticket)}`,
  });
  return { haul: toPublicHaul(haul), upload };
}

// Local storage only. The ticket in the URL replaces the sign-in header and works for this haul alone.
export async function receiveUpload({ haulId, ticket, stream }) {
  const data = readTokenData(String(ticket || ''));
  if (storage.driver !== 'local' || data?.purpose !== uploadPurpose(haulId)) {
    throw new HttpError(401, 'This upload link has expired. Start the upload again.');
  }
  const haul = await getHaulOrThrow(data.uid, haulId);
  if (haul.status !== HAUL_STATUS.UPLOADING) throw conflict('This video has already been uploaded.');
  await storage.receive(haul.sourceKey, stream, MAX_HAUL_VIDEO_BYTES);
}

// Safe to call twice: a phone that lost the first response can simply try again.
export async function completeUpload(userId, haulId) {
  const haul = await getHaulOrThrow(userId, haulId);
  if (haul.status !== HAUL_STATUS.UPLOADING) return toPublicHaul(haul);

  const file = await storage.stat(haul.sourceKey);
  if (!file) throw conflict('The video has not finished uploading yet.');
  // A signed URL cannot limit file size, so it is checked here once the file exists.
  if (file.size > MAX_HAUL_VIDEO_BYTES) {
    await storage.remove(haul.sourceKey);
    haul.status = HAUL_STATUS.FAILED;
    haul.error = TOO_LARGE;
    await saveHaul(haul);
    throw new HttpError(413, TOO_LARGE);
  }
  haul.status = HAUL_STATUS.QUEUED;
  haul.sourceSize = file.size;
  return toPublicHaul(await saveHaul(haul));
}

export const getHaul = async (userId, haulId) => toPublicHaul(await getHaulOrThrow(userId, haulId));

export const listHauls = async (userId) => (await store.listHauls(userId)).map(toPublicHaul);

// Listings already made from this haul stay; they just lose the link back to it.
export async function deleteHaul(userId, haulId) {
  const haul = await getHaulOrThrow(userId, haulId);
  await storage.remove(haul.sourceKey);
  await store.deleteHaul(userId, haulId);
}
