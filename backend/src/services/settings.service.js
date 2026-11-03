import { DEFAULT_SETTINGS } from '../config/constants.js';
import { store } from '../db/index.js';
import { mergeSettings } from '../validators/settings.validator.js';

// Stored settings may predate newer keys, so always layer them over the defaults.
export const withDefaults = (settings) => ({ ...DEFAULT_SETTINGS, ...(settings || {}) });

export async function getUserSettings(userId) {
  const user = await store.findUserById(userId);
  return withDefaults(user?.settings);
}

export async function updateUserSettings(userId, body) {
  const next = mergeSettings(await getUserSettings(userId), body);
  await store.updateUserSettings(userId, next);
  return next;
}
