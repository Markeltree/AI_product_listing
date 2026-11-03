import { badRequest } from '../utils/errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

// Returns clean signup fields or throws a 400 with a message for the form.
export function validateSignup(body = {}) {
  const name = String(body.name || '').trim().slice(0, 80);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (name.length < 2) throw badRequest('Enter your name.');
  if (!EMAIL_RE.test(email)) throw badRequest('Enter a valid email address.');
  if (password.length < 8) throw badRequest('Use at least 8 characters for your password.');
  return { name, email, password };
}

export function readLogin(body = {}) {
  return { email: normalizeEmail(body.email), password: String(body.password || '') };
}
