import {
  LANGUAGES,
  MAX_QUANTITY,
  TONES,
  WHEN_MADE,
  WHO_MADE,
} from "../config/constants.js";
import { badRequest } from "../utils/errors.js";
import { toIntOrNull } from "../utils/parse.js";

const INVALID = Symbol("invalid");

// Merges a settings update into the current settings. Unknown or invalid values keep the current value;
// an empty string clears the optional Etsy IDs.
export function mergeSettings(current, body = {}) {
  const pick = (allowed, key) =>
    allowed.includes(body[key]) ? body[key] : current[key];
  const optionalId = (key) => {
    const value = toIntOrNull(body[key], INVALID);
    return value === INVALID || body[key] === undefined ? current[key] : value;
  };
  const quantity = toIntOrNull(body.defaultQuantity, INVALID);

  const next = {
    defaultTone: pick(TONES, "defaultTone"),
    defaultLanguage: pick(LANGUAGES, "defaultLanguage"),
    defaultWhoMade: pick(WHO_MADE, "defaultWhoMade"),
    defaultWhenMade: pick(WHEN_MADE, "defaultWhenMade"),
    defaultIsSupply:
      typeof body.defaultIsSupply === "boolean"
        ? body.defaultIsSupply
        : current.defaultIsSupply,
    defaultQuantity:
      quantity === INVALID || quantity === null
        ? current.defaultQuantity
        : quantity,
    defaultTaxonomyId: optionalId("defaultTaxonomyId"),
    defaultShippingProfileId: optionalId("defaultShippingProfileId"),
    defaultReadinessStateId: optionalId("defaultReadinessStateId"),
  };
  if (next.defaultQuantity < 1 || next.defaultQuantity > MAX_QUANTITY) {
    throw badRequest(`Default quantity must be between 1 and ${MAX_QUANTITY}.`);
  }
  return next;
}
