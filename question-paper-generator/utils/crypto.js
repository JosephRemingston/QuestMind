import { createHash, randomUUID, createHmac } from 'node:crypto';
import { env } from '../configs/env.js';
export { randomUUID };
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const privateKey = value => createHmac('sha256', env.JWT_REFRESH_SECRET).update(value).digest('hex');
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
