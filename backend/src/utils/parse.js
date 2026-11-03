// Small input parsers shared by request sanitizers.
import { badRequest } from './errors.js';

export const now = () => new Date().toISOString();

// Empty input becomes null; anything that is not a number becomes null too.
export function toNumberOrNull(value) {
  if (value === '' || value == null) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

// Empty input becomes null. Non-integers return `invalid` (null by default), so callers can tell
// "cleared" apart from "bad value" when they need to. Check empty first: Number(null) is 0.
export function toIntOrNull(value, invalid = null) {
  if (value === '' || value == null) return null;
  return Number.isInteger(Number(value)) ? Number(value) : invalid;
}

export function parseJsonField(raw, errorMessage) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw badRequest(errorMessage);
  }
}
