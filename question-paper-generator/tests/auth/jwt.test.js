import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '../../configs/jwt.js';
import { env } from '../../configs/env.js';
test('access and refresh token types and secrets are separate', () => { const token = signToken('user1', 'session1', 'access', 'jti1'); expect(verifyToken(token, 'access').sub).toBe('user1'); expect(() => verifyToken(token, 'refresh')).toThrow(); });
test('rejects wrong audience, expired tokens and missing session claims', () => { const expired = jwt.sign({ sid: 's', type: 'access' }, env.JWT_ACCESS_SECRET, { subject: 'u', jwtid: 'j', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, expiresIn: -1 }); expect(() => verifyToken(expired, 'access')).toThrow(); const wrong = jwt.sign({ sub: 'u' }, env.JWT_ACCESS_SECRET); expect(() => verifyToken(wrong, 'access')).toThrow(); });
