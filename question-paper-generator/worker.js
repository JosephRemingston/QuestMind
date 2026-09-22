import { Worker } from 'bullmq';
import { env, validateRuntimeEnv } from './configs/env.js';
import connectDB, { closeDB } from './configs/database.js';
import { createRedis, connectRedis, closeRedis } from './configs/redis.js';
import { closeQueues } from './queues/base.queue.js';
import { dispatchOutbox } from './services/operations/outbox.service.js';
import { cleanup } from './services/operations/cleanup.service.js';
import { recordFinalFailure } from './services/operations/failure.service.js';
import logger from './utils/logger.js';
validateRuntimeEnv(); await connectDB(); await connectRedis();
const connections = [], workers = [];
for (const [queue, file] of [['textbook-processing', 'textbook'], ['question-generation', 'generation'], ['pdf-generation', 'pdf']]) {
  const connection = createRedis(true); connections.push(connection);
  const worker = new Worker(queue, new URL(`./workers/${file}.worker.js`, import.meta.url), { connection, concurrency: env.WORKER_CONCURRENCY, maxStalledCount: 2, lockDuration: 60000 });
  worker.on('error', () => logger.error({ queue }, 'Worker connection error'));
  worker.on('failed', (job) => recordFinalFailure(job).catch(() => logger.error({ jobId: job?.id }, 'Failure state will be reconciled')));
  workers.push(worker);
}
const timers = [setInterval(() => dispatchOutbox().catch(() => logger.error('Outbox dispatch failed')), 2000), setInterval(() => cleanup().catch(() => logger.error('Cleanup failed; will retry')), env.CLEANUP_INTERVAL_MS)];
await dispatchOutbox();
logger.info('Workers started');
let closing = false;
async function shutdown() {
  if (closing) return; closing = true; timers.forEach(clearInterval);
  const deadline = setTimeout(() => process.exit(1), env.JOB_TIMEOUT_MS + 10000).unref();
  await Promise.all(workers.map(w => w.close())); await Promise.all(connections.map(c => c.quit()));
  await closeQueues(); await closeRedis(); await closeDB(); clearTimeout(deadline);
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => shutdown().catch(() => process.exit(1)));
