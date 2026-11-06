// Background listing generation: video frames -> voice transcript -> AI copy.
// Runs inside the server process; progress is written to listing.step so clients can poll it.
import path from 'node:path';
import { config } from '../config/index.js';
import { store } from '../db/index.js';
import { LISTING_STATUS } from '../config/constants.js';
import { extractVideoFrames, generateContent, transcribeAudio } from './ai/index.js';
import { hydrate, listingDir } from './media.service.js';
import { findListing, updateListing } from './listing.repository.js';
import { getUserSettings } from './settings.service.js';
import { log } from '../utils/logger.js';

// Generation runs inside the server process, so a restart or deploy in the middle of one would leave the
// listing stuck on "generating". Called at startup to run those again.
export async function resumeInterruptedGenerations() {
  const stuck = await store.listListingsByStatus(LISTING_STATUS.GENERATING);
  for (const l of stuck) {
    log.info('generation', 'Resuming after a restart', { listingId: l.id });
    startGeneration(l.userId, l.id);
  }
  return stuck.length;
}

// Fire and forget. Errors are recorded on the listing by runGeneration, so this only logs the unexpected.
export function startGeneration(userId, listingId) {
  runGeneration(userId, listingId).catch((err) => log.error('generation', 'Generation failed', { listingId, err }));
}

async function readFrames(video, outDir, warnings) {
  if (!video) return [];
  try {
    const frames = await extractVideoFrames(video.absolutePath, outDir);
    if (!frames.length) warnings.push('No frames could be read from the video. Try a different clip or add a photo.');
    return frames;
  } catch (err) {
    log.warn('generation', 'Frame extraction failed', { err });
    warnings.push('Could not read frames from the video. Make sure ffmpeg is installed on the server.');
    return [];
  }
}

async function readTranscript(voice, warnings) {
  if (!voice) return null;
  if (!config.openai.apiKey) {
    warnings.push('Voice note saved. Add OPENAI_API_KEY to transcribe it automatically.');
    return null;
  }
  try {
    return await transcribeAudio(voice.absolutePath, voice.filename, voice.mime);
  } catch (err) {
    warnings.push(`Voice note could not be transcribed: ${err.message}`);
    return null;
  }
}

// finalAttempt: false when a queue will retry this job on failure. The listing then stays on
// "generating" and the error is re-thrown so BullMQ schedules the retry.
export async function runGeneration(userId, listingId, { finalAttempt = true } = {}) {
  const progress = (step) => updateListing(userId, listingId, (l) => { l.step = step; });

  try {
    const settings = await getUserSettings(userId);
    const listing = await findListing(userId, listingId);
    if (!listing) return;
    const hydrated = hydrate(listing);
    const video = hydrated.media.find((m) => m.kind === 'video');
    const voice = hydrated.media.find((m) => m.kind === 'voice');
    const warnings = [];

    if (video) await progress('Extracting key frames from your video');
    const frames = await readFrames(video, path.join(listingDir(userId, listingId), 'frames'), warnings);

    if (voice && config.openai.apiKey) await progress('Transcribing your voice note');
    const transcript = await readTranscript(voice, warnings);

    await progress('Writing your listing');
    const result = await generateContent({ listing: hydrated, settings, frames, transcript });

    const allWarnings = [...warnings, ...result.analysis.warnings];
    log.info('generation', 'Listing written', {
      listingId,
      writer: result.analysis.source === 'ai' ? result.analysis.provider : 'template',
      warnings: allWarnings.length ? allWarnings : undefined,
    });
    await updateListing(userId, listingId, (l) => {
      l.content = result.content;
      l.analysis = {
        ...result.analysis,
        transcript,
        frameCount: frames.length,
        warnings: allWarnings,
      };
      l.status = LISTING_STATUS.DRAFT;
      l.step = null;
      l.error = null;
    });
  } catch (err) {
    log.error('generation', finalAttempt ? 'Generation failed' : 'Generation failed, will retry', { listingId, err });
    if (!finalAttempt) {
      await updateListing(userId, listingId, (l) => { l.step = 'Had a problem, trying again shortly'; }).catch(() => {});
      throw err;
    }
    await updateListing(userId, listingId, (l) => {
      l.status = LISTING_STATUS.FAILED;
      l.step = null;
      l.error = `Generation failed: ${err.message}`;
    });
  }
}
