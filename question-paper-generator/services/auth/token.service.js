import bcrypt from 'bcrypt';
import { getRedis } from '../../configs/redis.js';
import { signToken, verifyToken, refreshTtl } from '../../configs/jwt.js';
import { randomUUID, sha256 } from '../../utils/crypto.js';
import ApiError from '../../utils/ApiError.js';
import RefreshToken from '../../models/RefreshToken.js';
import User from '../../models/User.js';
import { readSession, saveSession, revokeSession, sessionKey, rotateScript } from './session.service.js';
const invalid = () => new ApiError(401, 'Session expired or invalid; sign in again', 'AUTH_REQUIRED');
function pair(userId, sid, jti) { return { accessToken: signToken(userId, sid, 'access', randomUUID()), refreshToken: signToken(userId, sid, 'refresh', jti), tokenType: 'Bearer' }; }
export async function issueTokens(user) {
  const sid = randomUUID(), jti = randomUUID(), tokens = pair(user.id, sid, jti);
  const tokenHash = await bcrypt.hash(sha256(tokens.refreshToken), 10);
  await RefreshToken.create({ userId: user.id, sid, jti, tokenHash, expiresAt: new Date(Date.now() + refreshTtl * 1000) });
  try { await saveSession(sid, { userId: user.id, jti, tokenHash }); } catch (e) { await RefreshToken.deleteOne({ sid }); throw e; }
  return tokens;
}
export async function refreshTokens(token) {
  let claims; try { claims = verifyToken(token, 'refresh'); } catch { throw invalid(); }
  const current = await readSession(claims.sid);
  if (!current || current.userId !== claims.sub) throw invalid();
  if (current.jti !== claims.jti || !await bcrypt.compare(sha256(token), current.tokenHash)) { await revokeSession(claims.sid); throw invalid(); }
  const user = await User.findOne({ _id: claims.sub, isActive: true });
  if (!user) { await revokeSession(claims.sid); throw invalid(); }
  const jti = randomUUID(), tokens = pair(user.id, claims.sid, jti), tokenHash = await bcrypt.hash(sha256(tokens.refreshToken), 10);
  const rotated = await getRedis().eval(rotateScript, 1, sessionKey(claims.sid), claims.jti, JSON.stringify({ userId: user.id, jti, tokenHash }), refreshTtl);
  if (rotated !== 1) { await revokeSession(claims.sid); throw invalid(); }
  try { await RefreshToken.updateOne({ sid: claims.sid }, { $set: { jti, tokenHash, expiresAt: new Date(Date.now() + refreshTtl * 1000) } }); } catch (error) { await revokeSession(claims.sid); throw error; }
  return tokens;
}
