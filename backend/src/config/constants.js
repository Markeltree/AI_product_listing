// Shared listing rules. Keep these in sync with mobile/src/lib/rules.ts.

export const TITLE_MAX = 140;
export const TAG_MAX_COUNT = 13;
export const TAG_MAX_LENGTH = 20;
export const DESCRIPTION_MAX = 13000;
export const MIN_PRICE = 0.2;
export const MAX_QUANTITY = 999;
export const MAX_IMAGES = 5;
export const MAX_FRAMES = 3;

export const WHO_MADE = ['i_did', 'collective', 'someone_else'];

// Etsy's "when made" enum. Etsy rejects unknown values with a 400, so update this list
// if Etsy changes it.
export const WHEN_MADE = [
  'made_to_order',
  '2020_2025',
  '2010_2019',
  '2000_2009',
  '1990s',
  '1980s',
  '1970s',
  '1960s',
  '1950s',
  '1940s',
  '1930s',
  '1920s',
  '1910s',
  '1900s',
  '1800s',
  '1700s',
  'before_1700',
];

export const TONES = ['warm', 'minimal', 'luxurious', 'playful', 'professional'];
export const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian'];

export const DEFAULT_SETTINGS = {
  defaultTone: 'warm',
  defaultLanguage: 'English',
  defaultWhoMade: 'i_did',
  defaultWhenMade: 'made_to_order',
  defaultIsSupply: false,
  defaultQuantity: 1,
  defaultTaxonomyId: null,
  defaultShippingProfileId: null,
  defaultReadinessStateId: null,
};

export const IMAGE_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const VIDEO_MIME = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
  'video/3gpp': '.3gp',
};

export const AUDIO_EXT = ['.webm', '.mp3', '.m4a', '.mp4', '.wav', '.ogg', '.mpeg', '.mpga', '.flac'];

// ---------- server-only limits ----------

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VOICE_BYTES = 25 * 1024 * 1024;
export const MAX_BULK_IMAGES = 20;

export const MAX_HAUL_VIDEO_BYTES = 500 * 1024 * 1024;
export const HAUL_UPLOAD_TTL_MS = 60 * 60 * 1000;
export const HAUL_STATUS = { UPLOADING: 'uploading', QUEUED: 'queued', FAILED: 'failed' };
export const MAX_LISTINGS_PAGE = 200;

export const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
export const ETSY_CONNECT_TICKET_TTL_MS = 5 * 60 * 1000;

export const LISTING_STATUS = {
  GENERATING: 'generating',
  DRAFT: 'draft',
  PUBLISHED: 'published',
  // Sold or ended on a marketplace, and ended everywhere else by the cross-delist sync.
  ENDED: 'ended',
  FAILED: 'failed',
};

export const EBAY_TITLE_MAX = 80; // Etsy allows 140
// Inventory API condition enums offered in Settings.
export const EBAY_CONDITIONS = ['NEW', 'NEW_OTHER', 'USED_EXCELLENT', 'USED_GOOD'];
