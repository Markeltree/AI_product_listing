import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import {
  AUDIO_EXT, IMAGE_MIME, MAX_BULK_IMAGES, MAX_IMAGE_BYTES, MAX_IMAGES, MAX_VIDEO_BYTES, MAX_VOICE_BYTES, VIDEO_MIME,
} from '../config/constants.js';
import { listingDir } from '../services/media.service.js';

const IMAGE_EXT = new Set(Object.values(IMAGE_MIME));
const VIDEO_EXT = new Set(Object.values(VIDEO_MIME));
const MAX_BYTES = { images: MAX_IMAGE_BYTES, video: MAX_VIDEO_BYTES, voice: MAX_VOICE_BYTES };

const extOf = (file) => path.extname(file.originalname).toLowerCase();
const isImage = (file) => Boolean(IMAGE_MIME[file.mimetype]) || IMAGE_EXT.has(extOf(file));
const isVideo = (file) => Boolean(VIDEO_MIME[file.mimetype]) || VIDEO_EXT.has(extOf(file));
const isAudio = (file) => file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm' || AUDIO_EXT.includes(extOf(file));

const FIELD_RULES = {
  images: { accepts: isImage, error: 'Photos must be JPG, PNG, WEBP or GIF.' },
  video: { accepts: isVideo, error: 'The product video must be MP4, MOV, WEBM or MKV.' },
  voice: { accepts: isAudio, error: 'The voice note must be an audio file.' },
};

function extensionFor(file) {
  const ext = extOf(file);
  if (file.fieldname === 'images') return IMAGE_EXT.has(ext) ? ext : (IMAGE_MIME[file.mimetype] || '.jpg');
  if (file.fieldname === 'video') return VIDEO_EXT.has(ext) ? ext : (VIDEO_MIME[file.mimetype] || '.mp4');
  return AUDIO_EXT.includes(ext) ? ext : '.webm';
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const dir = listingDir(req.user.id, req.listingId);
      fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    filename(_req, file, cb) {
      cb(null, `${randomUUID()}${extensionFor(file)}`);
    },
  }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: Math.max(MAX_IMAGES + 2, MAX_BULK_IMAGES), fieldSize: 64 * 1024, fields: 10 },
  fileFilter(_req, file, cb) {
    const rule = FIELD_RULES[file.fieldname];
    if (rule?.accepts(file)) return cb(null, true);
    const err = new Error(rule?.error || 'Unexpected file field.');
    err.status = 400;
    cb(err);
  },
});

// New listing: photos, an optional video and an optional voice note.
export const uploadListingFiles = upload.fields([
  { name: 'images', maxCount: MAX_IMAGES },
  { name: 'video', maxCount: 1 },
  { name: 'voice', maxCount: 1 },
]);

// Bulk upload: one listing per photo.
export const uploadBulkImages = upload.fields([{ name: 'images', maxCount: MAX_BULK_IMAGES }]);

// Wizard analysis: photos and/or a video (frames are read from it).
export const uploadAnalyzeFiles = upload.fields([
  { name: 'images', maxCount: MAX_IMAGES },
  { name: 'video', maxCount: 1 },
]);

// Extra photos for an existing listing.
export const uploadPhotos = upload.fields([{ name: 'images', maxCount: MAX_IMAGES }]);

// Gives the request a fresh folder id for its uploads.
export function assignNewListingId(req, _res, next) {
  req.listingId = randomUUID();
  next();
}

// ---------- helpers for controllers ----------

export function removeUploadedFiles(files = {}) {
  for (const list of Object.values(files)) for (const f of list) fs.rm(f.path, { force: true }, () => {});
}

export function removeUploadFolder(userId, listingId) {
  fs.rm(listingDir(userId, listingId), { recursive: true, force: true }, () => {});
}

// Returns a user-facing message for the first file over its field's limit, or null.
export function checkSizes(files = {}) {
  for (const [field, list] of Object.entries(files)) {
    const limit = MAX_BYTES[field];
    const tooBig = list.find((f) => f.size > limit);
    if (tooBig) return `${tooBig.originalname} is larger than ${limit / (1024 * 1024)} MB.`;
  }
  return null;
}
