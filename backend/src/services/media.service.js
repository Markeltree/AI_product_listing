// Listing media (photos, video, voice note). Records store a path relative to the uploads folder,
// so the data stays portable; hydrate() adds the absolute path for code that reads the files.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import { IMAGE_MIME, VIDEO_MIME } from '../config/constants.js';

const KIND_BY_FIELD = { images: 'image', video: 'video', voice: 'voice' };

// Extension -> MIME type, for clients that send files without a specific type (application/octet-stream).
const MIME_BY_EXT = {
  ...Object.fromEntries(Object.entries({ ...IMAGE_MIME, ...VIDEO_MIME }).map(([mime, ext]) => [ext, mime])),
  '.jpeg': 'image/jpeg', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
};
const GENERIC_MIME = new Set(['', 'application/octet-stream', 'text/plain']);

function mimeOf(file, filePath) {
  if (!GENERIC_MIME.has(file.mimetype || '')) return file.mimetype;
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] || file.mimetype;
}

export const listingDir = (userId, listingId) => path.join(config.uploadDir, userId, listingId);

export const absPath = (media) => path.join(config.uploadDir, media.path);

// Builds a media record from a file written by multer (or moved to `filePath`).
export function toMediaRecord(file, { kind = KIND_BY_FIELD[file.fieldname], filePath = file.path } = {}) {
  return {
    id: randomUUID(),
    kind,
    filename: file.originalname,
    path: path.relative(config.uploadDir, filePath),
    mime: mimeOf(file, filePath),
    size: file.size,
    alt: '',
  };
}

// multer's { field: [files] } -> flat list of media records.
export const mediaFromUploads = (files = {}) =>
  Object.values(files).flatMap((list) => list.map((f) => toMediaRecord(f)));

export const imagesOf = (listing) => (listing.media || []).filter((m) => m.kind === 'image');

export const hydrate = (listing) => ({
  ...listing,
  media: (listing.media || []).map((m) => ({ ...m, absolutePath: absPath(m) })),
});

export const dehydrate = (listing) => ({
  ...listing,
  media: (listing.media || []).map(({ absolutePath, ...m }) => m),
});

// Puts photos in the given order. Unknown IDs are ignored; photos not listed keep their place at the end.
export function reorderImages(media, order) {
  const images = media.filter((m) => m.kind === 'image');
  const rest = media.filter((m) => m.kind !== 'image');
  const byId = new Map(images.map((m) => [m.id, m]));
  const reordered = order.map((id) => byId.get(id)).filter(Boolean);
  const missing = images.filter((m) => !order.includes(m.id));
  return [...reordered, ...missing, ...rest];
}

// Resolves a media file path, refusing anything outside the uploads folder.
export function safeMediaPath(media) {
  const file = path.resolve(absPath(media));
  return file.startsWith(config.uploadDir + path.sep) ? file : null;
}

export const removeFile = (media) => fs.rm(absPath(media), { force: true });
