import { getRedis } from '../../configs/redis.js';
import { refreshTtl } from '../../configs/jwt.js';
import RefreshToken from '../../models/RefreshToken.js';
export const sessionKey = sid => `session:${sid}`;
export const readSession = async sid => { const value = await getRedis().get(sessionKey(sid)); return value ? JSON.parse(value) : null; };
export const saveSession = (sid, value) => getRedis().set(sessionKey(sid), JSON.stringify(value), 'EX', refreshTtl);
export async function revokeSession(sid) { await getRedis().del(sessionKey(sid)); await RefreshToken.updateOne({ sid }, { $set: { revokedAt: new Date() } }); }
export const rotateScript = `local current = redis.call('GET', KEYS[1]); if not current then return 0 end; local value = cjson.decode(current); if value.jti ~= ARGV[1] then redis.call('DEL', KEYS[1]); return -1 end; redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]); return 1`;
