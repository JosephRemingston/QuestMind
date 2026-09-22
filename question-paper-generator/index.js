import { env, validateRuntimeEnv } from './configs/env.js';
import connectDB, { closeDB } from './configs/database.js';
import { connectRedis, closeRedis } from './configs/redis.js';
import { closeQueues } from './queues/base.queue.js';
import { createApp } from './app.js';
import { dispatchOutbox } from './services/operations/outbox.service.js';
import logger from './utils/logger.js';
validateRuntimeEnv();
await connectDB(); await connectRedis();
const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT }, 'API listening'));
server.requestTimeout = 120000; server.headersTimeout = 15000;
const timer = setInterval(() => dispatchOutbox().catch(() => logger.error('Outbox dispatch failed')), 2000);
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return; shuttingDown = true; clearInterval(timer);
  const deadline = setTimeout(() => process.exit(1), 30000).unref();
  await new Promise(resolve => server.close(resolve));
  await closeQueues(); await closeRedis(); await closeDB(); clearTimeout(deadline);
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => shutdown().catch(() => process.exit(1)));
