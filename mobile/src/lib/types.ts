export type ListingStatus = 'generating' | 'draft' | 'published' | 'ended' | 'failed';

export type WhoMade = 'i_did' | 'collective' | 'someone_else';
export type Tone = 'warm' | 'minimal' | 'luxurious' | 'playful' | 'professional';

export interface Product {
  name: string;
  type: string;
  materials: string;
  colors: string;
  dimensions: string;
  brand: string;
  keywords: string;
  notes: string;
  audience: string;
  tone: Tone;
  language: string;
  price: number | null;
  quantity: number | null;
  whoMade: WhoMade;
  whenMade: string;
  isSupply: boolean;
  taxonomyId: number | null;
  taxonomyPath: string | null;
  shippingProfileId: number | null;
  readinessStateId: number | null;
}

export interface Attribute {
  name: string;
  value: string;
}

export interface Content {
  title: string;
  description: string;
  tags: string[];
  category: string;
  attributes: Attribute[];
  altTexts: string[];
  suggestedPrice: number | null;
  pricingNote: string;
}

export interface Media {
  id: string;
  kind: 'image' | 'video' | 'voice';
  filename: string;
  size: number;
  etsyImageId?: number;
}

export interface Analysis {
  source: 'ai' | 'template';
  provider: string | null;
  model: string | null;
  detected: Record<string, unknown>;
  warnings: string[];
  transcript?: string | null;
  frameCount?: number;
}

export interface EtsyInfo {
  listingId: number;
  shopId: number;
  url: string;
  publishedAt: string | null;
  lastError: string | null;
  state?: ChannelState;
  endedAt?: string;
}

export type ChannelState = 'active' | 'draft' | 'ended';

export interface EbayInfo {
  sku: string;
  offerId: string;
  listingId: string | null;
  url: string | null;
  categoryId?: string;
  categoryPath?: string | null;
  missingAspects?: string[];
  state?: ChannelState;
  publishedAt?: string | null;
  lastError?: string | null;
  endedAt?: string;
}

// Cross-delist bookkeeping: last check, synced stock, and why the listing ended.
export interface SyncInfo {
  checkedAt?: string;
  quantity?: number;
  endedAt?: string | null;
  reason?: string | null;
  endedOn?: string | null;
  lastError?: string | null;
}

export interface Listing {
  id: string;
  status: ListingStatus;
  step: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  product: Product;
  content: Content;
  media: Media[];
  analysis: Analysis | null;
  etsy: EtsyInfo | null;
  ebay?: EbayInfo | null;
  sync?: SyncInfo | null;
}

export interface ListingSummary {
  id: string;
  status: ListingStatus;
  step: string | null;
  error: string | null;
  updatedAt: string;
  title: string;
  price: number | null;
  quantity: number | null;
  thumbnailId: string | null;
  mediaCount: number;
  etsyUrl: string | null;
  ebayUrl?: string | null;
  channels?: { etsy: ChannelState | null; ebay: ChannelState | null };
  endedReason?: string | null;
}

export interface Issue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface User {
  id: string;
  name: string;
  email: string;
  settings: Settings;
}

export interface Settings {
  defaultTone: Tone;
  defaultLanguage: string;
  defaultWhoMade: WhoMade;
  defaultWhenMade: string;
  defaultIsSupply: boolean;
  defaultQuantity: number;
  defaultTaxonomyId: number | null;
  defaultShippingProfileId: number | null;
  defaultReadinessStateId: number | null;
}

export interface EtsyStatus {
  configured: boolean;
  connected: boolean;
  hasShop: boolean;
  shopId: number | null;
  shopName: string | null;
}

export interface EbayPrefs {
  fulfillmentPolicyId?: string | null;
  paymentPolicyId?: string | null;
  returnPolicyId?: string | null;
  merchantLocationKey?: string | null;
  condition?: string;
}

export interface EbayStatus {
  configured: boolean;
  connected: boolean;
  username: string | null;
  ready: boolean;
  setupProblem: string | null;
  prefs: EbayPrefs;
  sandbox: boolean;
  callbackUrl: string;
}

export interface EbaySetup {
  prefs: EbayPrefs;
  policies: Record<'fulfillment' | 'payment' | 'return', { id: string; name: string }[]>;
  locations: { key: string; name: string; postalCode: string | null; country: string | null }[];
  conditions: string[];
  marketplaceId: string;
}

export interface ShippingProfile {
  id: number;
  title: string;
  originCountry: string | null;
}

export interface TaxonomyNode {
  id: number;
  name: string;
  path: string;
}

// POST /api/listings/analyze: details the AI read from the photos. Empty string when unknown.
export type ProductSuggestions = {
  name: string;
  type: string;
  materials: string;
  colors: string;
  dimensions: string;
  brand: string;
  keywords: string[];
  audience: string;
};
