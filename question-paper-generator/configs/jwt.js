import jwt from 'jsonwebtoken';
import { env } from './env.js';
export const durationSeconds = value => Number(value.slice(0, -1)) * { s: 1, m: 60, h: 3600, d: 86400 }[value.slice(-1)];
export const refreshTtl = durationSeconds(env.JWT_REFRESH_EXPIRES_IN);
export function signToken(userId, sid, type, jti) {
  return jwt.sign({ sid, type }, type === 'access' ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET, { algorithm: 'HS256', subject: String(userId), jwtid: jti, issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, expiresIn: type === 'access' ? env.JWT_ACCESS_EXPIRES_IN : env.JWT_REFRESH_EXPIRES_IN });
}
export function verifyToken(token, type) {
  const payload = jwt.verify(token, type === 'access' ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET, { algorithms: ['HS256'], issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE });
  if (payload.type !== type || !payload.sub || !payload.sid || !payload.jti) throw new Error('Invalid token claims');
  return payload;
}
