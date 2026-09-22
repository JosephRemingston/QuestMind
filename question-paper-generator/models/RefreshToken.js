import { model, ref, requiredText } from './shared.js';
export default model('RefreshToken', { userId: ref('User', true), sid: requiredText, jti: requiredText, tokenHash: { ...requiredText, select: false }, expiresAt: { type: Date, required: true }, revokedAt: Date }, [[{ sid: 1 }, { unique: true }], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }], [{ userId: 1 }, {}]]);
