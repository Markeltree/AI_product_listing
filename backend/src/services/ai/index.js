// AI pipeline entry point: listing generation with Anthropic Claude or OpenAI vision.
// Falls back to a template listing if no provider is configured or a provider call fails.
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config/index.js';
import { MAX_FRAMES, MAX_HAUL_ITEMS, MAX_IMAGES } from '../../config/constants.js';
import { sanitizeContent, sanitizeHaulItems, sanitizeSuggestions } from '../../validators/listing.sanitizer.js';
import { buildAnalyzePrompt, buildHaulPrompt, buildUserPrompt } from './prompts.js';
import { callAnthropic, callOpenAI } from './providers.js';
import { templateContent } from './template.js';

export { extractAudio, extractVideoFrames, grabFullFrame, sampleVideoFrames } from './video.js';
export { transcribeAudio } from './providers.js';

const MIME_BY_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

export function aiStatus() {
  if (config.anthropic.apiKey) return { provider: 'anthropic', model: config.anthropic.model };
  if (config.openai.apiKey) return { provider: 'openai', model: config.openai.model };
  return { provider: 'template', model: null };
}

// The AI providers reject an image whose declared type does not match its bytes, and file names
// from phones are not reliable, so the type is read from the file's signature first.
function sniffImageType(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 4).toString('hex') === '89504e47') return 'image/png';
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

async function readImage(filePath) {
  const buf = await fs.readFile(filePath);
  const mediaType = sniffImageType(buf) || MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'image/jpeg';
  return { mediaType, data: buf.toString('base64') };
}

// Models sometimes wrap the JSON in prose or code fences; take the outermost object.
function parseJsonLoose(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('The AI response was not JSON.');
  return JSON.parse(text.slice(start, end + 1));
}

const templateResult = (template, ai, warnings) => ({
  content: template,
  analysis: { source: 'template', provider: ai.provider === 'template' ? null : ai.provider, model: ai.model, detected: {}, warnings },
});

// Reads product facts from photos and video frames to prefill the details form. Returns null when no AI provider is set up.
// Throws if the provider call fails, so the caller can tell the user.
export async function analyzeProduct(imagePaths, { language = 'English', frames = [] } = {}) {
  const ai = aiStatus();
  if (ai.provider === 'template') return null;
  const photoPaths = imagePaths.slice(0, MAX_IMAGES);
  const framePaths = frames.slice(0, MAX_FRAMES);
  const images = await Promise.all([...photoPaths, ...framePaths].map(readImage));
  if (!images.length) throw new Error('No images to analyse.');
  const prompt = buildAnalyzePrompt({ photoCount: photoPaths.length, frameCount: framePaths.length, language });
  const call = ai.provider === 'anthropic' ? callAnthropic : callOpenAI;
  return sanitizeSuggestions(parseJsonLoose(await call(prompt, images)));
}

// Finds the separate products in frames from one haul video. Returns null when no AI provider is set up.
export async function detectHaulItems(framePaths, { transcript = null } = {}) {
  const ai = aiStatus();
  if (ai.provider === 'template') return null;
  const images = await Promise.all(framePaths.map(readImage));
  const prompt = buildHaulPrompt({ frameCount: images.length, maxItems: MAX_HAUL_ITEMS, transcript });
  const call = ai.provider === 'anthropic' ? callAnthropic : callOpenAI;
  return sanitizeHaulItems(parseJsonLoose(await call(prompt, images, { maxTokens: 6000 })), images.length);
}

// Text-only JSON question for the configured provider. Returns null when no AI is set up.
export async function askAiJson(prompt) {
  const ai = aiStatus();
  if (ai.provider === 'template') return null;
  const call = ai.provider === 'anthropic' ? callAnthropic : callOpenAI;
  return parseJsonLoose(await call(prompt, []));
}

// `listing` must be hydrated (media items carry absolutePath). Returns { content, analysis }; never throws.
export async function generateContent({ listing, settings = {}, frames = [], transcript = null }) {
  const warnings = [];
  const ai = aiStatus();
  const template = templateContent(listing);
  if (ai.provider === 'template') return templateResult(template, ai, warnings);

  try {
    const photoPaths = (listing.media || [])
      .filter((m) => m.kind === 'image')
      .slice(0, MAX_IMAGES)
      .map((m) => m.absolutePath);
    const usedFrames = frames.slice(0, MAX_FRAMES);
    const images = await Promise.all([...photoPaths, ...usedFrames].map(readImage));
    if (!images.length && !transcript) throw new Error('No images or voice note to analyse.');

    const prompt = buildUserPrompt({ listing, settings, transcript, frameCount: usedFrames.length });
    const call = ai.provider === 'anthropic' ? callAnthropic : callOpenAI;
    const parsed = parseJsonLoose(await call(prompt, images));

    const content = sanitizeContent(parsed, template);
    // Keep the seller's own price authoritative when they already set one.
    if (listing.product?.price) content.suggestedPrice = null;
    if (!content.altTexts.length) content.altTexts = template.altTexts;

    return {
      content,
      analysis: {
        source: 'ai',
        provider: ai.provider,
        model: ai.model,
        detected: parsed.detected && typeof parsed.detected === 'object' ? parsed.detected : {},
        warnings,
      },
    };
  } catch (err) {
    warnings.push(`AI generation failed, so a template listing was written instead: ${err.message}`);
    return templateResult(template, ai, warnings);
  }
}
