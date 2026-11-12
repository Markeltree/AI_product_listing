// Request schemas (zod). Each one checks types and size limits at the edge, before a controller runs,
// and strips keys it does not know. Business rules (Etsy's limits, defaults) stay in the sanitizers.
import { z } from "zod";
import {
  DESCRIPTION_MAX,
  EBAY_CONDITIONS,
  MAX_LISTINGS_PAGE,
} from "../config/constants.js";

const text = (max) => z.string().max(max, `Keep this under ${max} characters.`);
const optionalId = z
  .union([z.number().int().positive(), z.string().max(20), z.null()])
  .optional();

// ---------- auth ----------

export const signupBody = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(80, "Use at most 80 characters for your name."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(8, "Use at least 8 characters for your password.")
    .max(128, "Use at most 128 characters for your password."),
});

export const loginBody = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter your email and password.")
    .max(254),
  password: z.string().min(1, "Enter your email and password.").max(128),
});

// ---------- settings ----------

export const settingsBody = z.object({
  defaultTone: text(40).optional(),
  defaultLanguage: text(40).optional(),
  defaultWhoMade: text(40).optional(),
  defaultWhenMade: text(40).optional(),
  defaultIsSupply: z.boolean().optional(),
  defaultQuantity: z.union([z.number(), z.string().max(10)]).optional(),
  defaultTaxonomyId: optionalId,
  defaultShippingProfileId: optionalId,
  defaultReadinessStateId: optionalId,
});

// ---------- listings ----------

export const listingParams = z.object({
  id: z.uuid("That listing could not be found."),
  mediaId: z.uuid("That photo could not be found.").optional(),
});

const productValue = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(200)).max(50),
]);

export const listingUpdateBody = z.object({
  product: z.record(z.string().max(40), productValue).optional(),
  content: z
    .object({
      title: text(500),
      description: text(DESCRIPTION_MAX + 500),
      tags: z.union([
        z.array(z.string().max(100)).max(50),
        z.string().max(2000),
      ]),
      category: text(300),
      attributes: z
        .array(z.object({ name: text(100), value: text(500) }))
        .max(50),
      altTexts: z.array(text(500)).max(20),
      suggestedPrice: z.union([z.number(), z.string().max(20), z.null()]),
      pricingNote: text(500),
    })
    .partial()
    .optional(),
  mediaOrder: z.array(z.uuid()).max(20).optional(),
});

export const publishBody = z.object({
  state: z.enum(["active", "draft"]).optional(),
});
export const delistBody = z.object({
  // A marketplace id or "all"; the delist service checks it against the marketplaces it knows.
  channel: z.string().trim().min(1).max(30).optional(),
});

// ---------- marketplaces ----------

export const connectUrlBody = z.object({ returnTo: text(300).optional() });
export const searchQuery = z.object({ q: text(100).optional() });

export const listingPageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LISTINGS_PAGE).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const policyId = z.string().max(64).nullable().optional();
export const ebayPrefsBody = z.object({
  fulfillmentPolicyId: policyId,
  paymentPolicyId: policyId,
  returnPolicyId: policyId,
  merchantLocationKey: policyId,
  condition: z.enum(EBAY_CONDITIONS).optional(),
  newLocation: z
    .object({
      postalCode: z.string().trim().min(2, "Enter a postal code.").max(20),
      country: z
        .string()
        .trim()
        .length(2, "Use a 2-letter country code, such as US."),
    })
    .optional(),
});

export const pushTokenBody = z.object({
  token: z
    .string()
    .max(200)
    .regex(
      /^Expo(nent)?PushToken\[[^\]]+\]$/,
      "This is not a valid device token.",
    ),
  platform: z.enum(["ios", "android"]),
});
