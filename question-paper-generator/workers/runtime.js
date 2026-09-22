import connectDB from '../configs/database.js';
import { connectRedis } from '../configs/redis.js';
import { env } from '../configs/env.js';
import logger from '../utils/logger.js';
let ready;
export async function sandboxJob(job, processJob) {
  ready ??= Promise.all([connectDB(), connectRedis()]); await ready;
  const start = performance.now(), controller = new AbortController();
  // BullMQ does not enforce a timeout option. The sandbox is a disposable child
  // process: terminate it on deadline so extraction/LLM work cannot continue later.
  const timeout = setTimeout(() => { controller.abort(); logger.error({ jobId: job.id, status: 'timeout' }, 'Worker deadline exceeded'); process.exit(1); }, env.JOB_TIMEOUT_MS);
  let status = 'completed';
  try { return await processJob(job, controller.signal); }
  catch (error) { status = 'failed'; logger.warn({ jobId: job.id, errorCode: error.errorCode ?? 'PROCESSING_FAILED' }, 'Worker attempt failed'); throw new Error(error.errorCode ?? 'PROCESSING_FAILED'); }
  finally {
    clearTimeout(timeout);
    logger.info({ jobId: job.id, userId: job.data.userId, textbookId: job.data.textbookId, status, attempt: job.attemptsMade + 1, duration: Math.round(performance.now() - start) }, 'Worker attempt finished');
  }
}
