import { getVerify } from '../../configs/twilio.js';
import { getRedis } from '../../configs/redis.js';
import { privateKey, randomUUID } from '../../utils/crypto.js';
import User from '../../models/User.js';
import ApiError from '../../utils/ApiError.js';
import { issueTokens } from './token.service.js';
export const publicUser = u => ({ id: String(u._id), phoneNumber: u.phoneNumber, role: u.role, name: u.name, board: u.board, classLevel: u.classLevel, medium: u.medium, preferences: u.preferences, lastLoginAt: u.lastLoginAt });
export const unlockScript = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end; return 0`;
export async function sendOtp(phoneNumber) {
  try {
    const verification = await getVerify().verifications.create({ to: phoneNumber, channel: 'sms' });
    await getRedis().set(`otp-pending:${privateKey(phoneNumber)}`, verification.sid, 'EX', 600);
    return { status: 'pending' };
  } catch (error) {
    if (error.status === 429 || error.code === 60203) throw new ApiError(429, 'OTP request limit reached', 'OTP_RATE_LIMITED');
    throw new ApiError(503, 'OTP service temporarily unavailable', 'DEPENDENCY_UNAVAILABLE');
  }
}
export async function verifyOtp(phoneNumber, code) {
  const key = privateKey(phoneNumber), lock = `otp-lock:${key}`, nonce = randomUUID();
  if (!await getRedis().set(lock, nonce, 'NX', 'EX', 30)) throw new ApiError(429, 'Verification already in progress', 'OTP_RATE_LIMITED');
  try {
    const sid = await getRedis().get(`otp-pending:${key}`);
    if (!sid) throw new ApiError(400, 'Invalid or expired OTP', 'INVALID_OTP');
    let check;
    try { check = await getVerify().verificationChecks.create({ verificationSid: sid, code }); }
    catch (e) { if (e.status === 404 || e.code === 60202) throw new ApiError(400, 'Invalid or expired OTP', 'INVALID_OTP'); throw new ApiError(503, 'OTP service temporarily unavailable', 'DEPENDENCY_UNAVAILABLE'); }
    if (check.status !== 'approved') throw new ApiError(400, 'Invalid or expired OTP', 'INVALID_OTP');
    await getRedis().del(`otp-pending:${key}`);
    const user = await User.findOneAndUpdate({ phoneNumber }, { $set: { lastLoginAt: new Date() }, $setOnInsert: { role: 'student' } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    if (!user.isActive) throw new ApiError(403, 'Account disabled', 'FORBIDDEN');
    return { user: publicUser(user), ...await issueTokens(user) };
  } finally { await getRedis().eval(unlockScript, 1, lock, nonce); }
}
