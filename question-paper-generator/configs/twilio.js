import twilio from 'twilio';
import { env } from './env.js';
let client;
export const getVerify = () => { client ??= twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, { timeout: 10000, autoRetry: false }); return client.verify.v2.services(env.TWILIO_VERIFY_SERVICE_SID); };
