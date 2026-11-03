import { randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS } from '../config/constants.js';
import { store } from '../db/index.js';
import { HttpError, conflict } from '../utils/errors.js';
import { now } from '../utils/parse.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { withDefaults } from './settings.service.js';

// The user object sent to clients. Never includes the password hash.
export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, settings: withDefaults(u.settings) });

export async function signup({ name, email, password }) {
  if (await store.findUserByEmail(email)) {
    throw conflict('An account with this email already exists. Sign in instead.');
  }
  return store.createUser({
    id: randomUUID(),
    email,
    name,
    passwordHash: hashPassword(password),
    settings: { ...DEFAULT_SETTINGS },
    createdAt: now(),
  });
}

export async function login({ email, password }) {
  const user = email ? await store.findUserByEmail(email) : null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  return user;
}
