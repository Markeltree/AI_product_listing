// AES-256-GCM encryption for marketplace tokens stored in the database. Tokens saved before the key was
// set stay readable, and are encrypted the next time they are saved.
import crypto from 'node:crypto';
import { HttpError } from './errors.js';

const PREFIX = 'enc:v1:';
const deriveKey = (key) => crypto.createHash('sha256').update(key).digest();

export function encryptSecret(value, key) {
  if (!key || !value) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `${PREFIX}${[iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join(':')}`;
}

export function decryptSecret(value, key) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  if (!key) throw new HttpError(503, 'TOKEN_ENCRYPTION_KEY is not set, so stored marketplace tokens cannot be read.');
  const [iv, tag, encrypted] = value.slice(PREFIX.length).split(':').map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(key), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    throw new HttpError(503, 'TOKEN_ENCRYPTION_KEY does not match the key these marketplace tokens were saved with.');
  }
}
