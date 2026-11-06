// Stores files on this server's disk, for local development and until object storage is set up.
// There is no storage service to upload to, so the phone sends the file to this API instead.
import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpError } from '../utils/errors.js';

function byteLimit(maxBytes) {
  let received = 0;
  return new Transform({
    transform(chunk, _encoding, done) {
      received += chunk.length;
      if (received > maxBytes) done(new HttpError(413, 'This video is too large.'));
      else done(null, chunk);
    },
  });
}

export function localStorage(rootDir) {
  const fileFor = (key) => path.join(rootDir, key);

  return {
    driver: 'local',

    async createUpload({ mime, localUrl }) {
      return { method: 'PUT', url: localUrl, headers: { 'content-type': mime } };
    },

    // Writes to a temporary name first, so a broken upload never looks like a finished file.
    async receive(key, stream, maxBytes) {
      const file = fileFor(key);
      const partial = `${file}.part`;
      await fs.promises.mkdir(path.dirname(file), { recursive: true });
      try {
        await pipeline(stream, byteLimit(maxBytes), fs.createWriteStream(partial));
        await fs.promises.rename(partial, file);
      } catch (err) {
        await fs.promises.rm(partial, { force: true });
        throw err;
      }
    },

    // Files are already on disk, so there is nothing to clean up.
    toLocalFile: async (key) => ({ path: fileFor(key), cleanup: async () => {} }),

    async stat(key) {
      const info = await fs.promises.stat(fileFor(key)).catch(() => null);
      return info && { size: info.size };
    },

    remove: (key) => fs.promises.rm(fileFor(key), { force: true }),
  };
}
