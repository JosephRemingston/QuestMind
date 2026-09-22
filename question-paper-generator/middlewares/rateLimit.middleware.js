import { getRedis } from '../configs/redis.js';
import { privateKey } from '../utils/crypto.js';
import ApiError from '../utils/ApiError.js';
export const limitScript = `local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return {count, redis.call('TTL', KEYS[1])}`;
export async function consumeLimit(scope, identity, { limit, seconds }) {
  const [count, ttl] = await getRedis().eval(limitScript, 1, `rl:${scope}:${privateKey(String(identity))}`, seconds);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfter: Math.max(1, ttl) };
}
export const rateLimit = (scope, identify, options, errorCode = 'RATE_LIMITED') => async (req, res, next) => {
  try {
    const result = await consumeLimit(scope, identify(req), options);
    res.setHeader('RateLimit-Limit', options.limit); res.setHeader('RateLimit-Remaining', result.remaining);
    if (!result.allowed) { res.setHeader('Retry-After', result.retryAfter); throw new ApiError(429, 'Too many requests; try again later', errorCode); }
    next();
  } catch (error) { next(error instanceof ApiError ? error : new ApiError(503, 'Rate limiting temporarily unavailable', 'DEPENDENCY_UNAVAILABLE')); }
};
