import pino from 'pino';
import { env } from '../configs/env.js';
export default pino({ level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL, redact: { paths: ['phoneNumber', 'token', 'refreshToken', 'accessToken', 'otp', 'code', 'password', 'authorization', 'req.headers', 'body', 'text', 'embedding', 'apiKey', 'credentials', 'err'], censor: '[REDACTED]' } });
