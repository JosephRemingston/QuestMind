import { Queue } from 'bullmq';
import { createRedis } from '../configs/redis.js';
import { env } from '../configs/env.js';
const queues = new Map(); const connections = [];
export const queueOptions = { attempts: env.JOB_ATTEMPTS, backoff: { type: 'exponential', delay: env.JOB_BACKOFF_MS }, removeOnComplete: { age: 86400, count: env.QUEUE_KEEP_COMPLETED }, removeOnFail: { age: env.JOB_RETENTION_DAYS * 86400, count: env.QUEUE_KEEP_FAILED } };
export function getQueue(name) {
  if (!queues.has(name)) { const connection = createRedis(); connections.push(connection); queues.set(name, new Queue(name, { connection, defaultJobOptions: queueOptions })); }
  return queues.get(name);
}
export async function closeQueues() { await Promise.all([...queues.values()].map(q => q.close())); await Promise.all(connections.map(c => c.quit())); queues.clear(); connections.length = 0; }
