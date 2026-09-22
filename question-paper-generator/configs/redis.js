import Redis from 'ioredis';
import { env } from './env.js';
import logger from '../utils/logger.js';
let client;
export function createRedis(worker = false) {
  const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: worker ? null : 1, enableOfflineQueue: worker, connectTimeout: 5000, retryStrategy: times => Math.min(times * 250, 3000) });
  redis.on('error', () => logger.error({ dependency: 'redis' }, 'Redis connection error'));
  return redis;
}
export const getRedis = () => { if (!client) throw new Error('Redis not initialized'); return client; };
export async function connectRedis() { if (!client) { client = createRedis(); await client.connect(); } await client.ping(); return client; }
export const setRedisForTest = value => { if (env.NODE_ENV !== 'test') throw new Error('Test only'); client = value; };
export async function closeRedis() { if (client) { await client.quit(); client = undefined; } }
