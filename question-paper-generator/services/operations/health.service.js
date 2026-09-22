import mongoose from 'mongoose';
import { getRedis } from '../../configs/redis.js';
export const health = () => ({ status: 'up', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
export async function readiness() {
  const checks = await Promise.allSettled([mongoose.connection.readyState === 1 ? mongoose.connection.db.admin().ping({ maxTimeMS: 2000 }) : Promise.reject(), getRedis().ping()]);
  const mongo = checks[0].status === 'fulfilled', redis = checks[1].status === 'fulfilled';
  return { ready: mongo && redis, checks: { mongodb: mongo ? 'up' : 'down', redis: redis ? 'up' : 'down' } };
}
