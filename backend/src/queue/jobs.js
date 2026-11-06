// Background work: listing generation and the cross-delist sync.
//
// With REDIS_URL set, both run on BullMQ queues:
//   - generation: one job per listing, survives restarts and deploys, retried up to 3 times with backoff,
//     at most GENERATION_CONCURRENCY at a time;
//   - haul: one job per haul video, one at a time per server because ffmpeg is heavy;
//   - sync: a scheduled job every SYNC_INTERVAL_MINUTES. Only one runs at a time, even with several servers.
// Without Redis, the same work runs inside the server process (fine for local development).
import { Queue, Worker } from 'bullmq';
import { config } from '../config/index.js';
import { HAUL_STATUS, LISTING_STATUS } from '../config/constants.js';
import { store } from '../db/index.js';
import { resumeInterruptedGenerations, runGeneration, startGeneration } from '../services/generation.service.js';
import { resumeInterruptedHauls, runHaul, startHaul } from '../services/haulPipeline.js';
import { runSync, startSyncLoop } from '../services/marketplace.service.js';
import { redis, redisEnabled } from './redis.js';
import { log } from '../utils/logger.js';

const GENERATION = 'velista-generation';
const HAUL = 'velista-haul';
const SYNC = 'velista-sync';
const GENERATION_ATTEMPTS = 3;
const HAUL_ATTEMPTS = 2;

const queues = {};
const workers = [];

function queue(name) {
  queues[name] ||= new Queue(name, { connection: redis(), prefix: config.queuePrefix });
  return queues[name];
}

// ---------- generation ----------

async function addGenerationJob(userId, listingId) {
  await queue(GENERATION).add('generate', { userId, listingId }, {
    jobId: `${listingId}-${Date.now()}`, // listing id first, so recovery can tell which listings have a job
    attempts: GENERATION_ATTEMPTS,
    backoff: { type: 'exponential', delay: 15_000 }, // 15 s, then 30 s
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  });
}

// Starts writing a listing in the background. Never throws: if Redis is unreachable, the listing is
// written in-process instead, so a Redis outage does not block sellers.
export async function enqueueGeneration(userId, listingId) {
  if (!redisEnabled()) return startGeneration(userId, listingId);
  try {
    await addGenerationJob(userId, listingId);
  } catch (err) {
    log.error('queue', 'Could not queue the job, running it in-process', { listingId, err });
    startGeneration(userId, listingId);
  }
}

// Listings still marked "generating" without a queued or running job (for example from before Redis
// was added) are queued again.
async function requeueOrphanedGenerations() {
  const jobs = await queue(GENERATION).getJobs(['waiting', 'active', 'delayed', 'prioritized', 'waiting-children']);
  const queued = new Set(jobs.map((j) => j?.data?.listingId).filter(Boolean));
  const stuck = (await store.listListingsByStatus(LISTING_STATUS.GENERATING)).filter((l) => !queued.has(l.id));
  for (const l of stuck) await addGenerationJob(l.userId, l.id);
  if (stuck.length) log.info('queue', `Re-queued ${stuck.length} listing(s) stuck on generating`);
}

// ---------- hauls ----------

async function addHaulJob(userId, haulId) {
  await queue(HAUL).add('process', { userId, haulId }, {
    jobId: `${haulId}-${Date.now()}`,
    attempts: HAUL_ATTEMPTS,
    backoff: { type: 'fixed', delay: 15_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 200 },
  });
}

// Never throws: if Redis is unreachable, the haul runs in-process instead.
export async function enqueueHaul(userId, haulId) {
  if (!redisEnabled()) return startHaul(userId, haulId);
  try {
    await addHaulJob(userId, haulId);
  } catch (err) {
    log.error('queue', 'Could not queue the haul, running it in-process', { haulId, err });
    startHaul(userId, haulId);
  }
}

async function requeueOrphanedHauls() {
  const jobs = await queue(HAUL).getJobs(['waiting', 'active', 'delayed', 'prioritized', 'waiting-children']);
  const queued = new Set(jobs.map((j) => j?.data?.haulId).filter(Boolean));
  const stuck = [
    ...await store.listHaulsByStatus(HAUL_STATUS.QUEUED),
    ...await store.listHaulsByStatus(HAUL_STATUS.PROCESSING),
  ].filter((h) => !queued.has(h.id));
  for (const h of stuck) await addHaulJob(h.userId, h.id);
  if (stuck.length) log.info('queue', `Re-queued ${stuck.length} interrupted haul(s)`);
}

// ---------- start / stop ----------

function startWorkers() {
  const generation = new Worker(GENERATION, async (job) => {
    const { userId, listingId } = job.data;
    await runGeneration(userId, listingId, { finalAttempt: job.attemptsMade + 1 >= (job.opts.attempts || 1) });
  }, { connection: redis(), prefix: config.queuePrefix, concurrency: config.generationConcurrency });

  const haul = new Worker(HAUL, async (job) => {
    const { userId, haulId } = job.data;
    await runHaul(userId, haulId, { finalAttempt: job.attemptsMade + 1 >= (job.opts.attempts || 1) });
  }, { connection: redis(), prefix: config.queuePrefix, concurrency: 1 });

  const sync = new Worker(SYNC, async () => runSync(), { connection: redis(), prefix: config.queuePrefix, concurrency: 1 });

  for (const w of [generation, haul, sync]) {
    w.on('failed', (job, err) => log.error('queue', 'Job failed', { queue: w.name, jobId: job?.id, attempt: job?.attemptsMade, err }));
    w.on('error', (err) => log.error('queue', 'Worker error', { queue: w.name, err }));
    workers.push(w);
  }
}

// Called once at startup. Returns 'bullmq' or 'in-process'.
export async function startBackgroundJobs() {
  if (!redisEnabled()) {
    await resumeInterruptedGenerations().catch((err) => log.error('generation', 'Resume failed', { err }));
    await resumeInterruptedHauls().catch((err) => log.error('haul', 'Resume failed', { err }));
    startSyncLoop();
    return 'in-process';
  }
  startWorkers();
  if (config.syncIntervalMs) {
    await queue(SYNC).upsertJobScheduler('cross-delist', { every: config.syncIntervalMs }, {
      name: 'sync',
      opts: { removeOnComplete: { count: 50 }, removeOnFail: { count: 50 } },
    });
    log.info('queue', `Cross-delist check every ${Math.round(config.syncIntervalMs / 60000)} min (BullMQ)`);
  } else {
    await queue(SYNC).removeJobScheduler('cross-delist');
  }
  await requeueOrphanedGenerations().catch((err) => log.error('queue', 'Recovery failed', { err }));
  await requeueOrphanedHauls().catch((err) => log.error('queue', 'Haul recovery failed', { err }));
  return 'bullmq';
}

// Graceful shutdown (deploys send SIGTERM): stop taking jobs and give running ones a few seconds.
// Jobs cut off anyway are marked stalled by BullMQ and run again on the next server.
export async function stopBackgroundJobs({ timeoutMs = 10_000 } = {}) {
  const closing = Promise.all([...workers.map((w) => w.close()), ...Object.values(queues).map((q) => q.close())]);
  await Promise.race([closing, new Promise((r) => setTimeout(r, timeoutMs))]);
}
