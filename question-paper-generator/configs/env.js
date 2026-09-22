import 'dotenv/config';
import { z } from 'zod';
const int = (fallback, max = 100000000) => z.coerce.number().int().positive().max(max).default(fallback);
const bool = (fallback) => z.enum(['true', 'false']).default(String(fallback)).transform(v => v === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'), PORT: int(8080, 65535),
  MONGO_URI: z.string().default(''), MONGO_DB_NAME: z.string().default('questmind'), REDIS_URL: z.string().default(''),
  JWT_ACCESS_SECRET: z.string().default(''), JWT_REFRESH_SECRET: z.string().default(''),
  JWT_ACCESS_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default('15m'), JWT_REFRESH_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default('30d'),
  JWT_ISSUER: z.string().default('questmind'), JWT_AUDIENCE: z.string().default('questmind-client'),
  TWILIO_ACCOUNT_SID: z.string().default(''), TWILIO_AUTH_TOKEN: z.string().default(''), TWILIO_VERIFY_SERVICE_SID: z.string().default(''),
  SUPPORTED_COUNTRIES: z.string().default('IN'), AWS_REGION: z.string().default('ap-south-1'), AWS_S3_BUCKET: z.string().default(''),
  AWS_S3_ENDPOINT: z.string().default(''), AWS_S3_FORCE_PATH_STYLE: bool(false), S3_URL_TTL_SECONDS: int(300, 3600),
  LLM_PROVIDER: z.enum(['openai', 'disabled']).default('disabled'), LLM_MODEL: z.string().default(''), LLM_API_KEY: z.string().default(''),
  EMBEDDING_PROVIDER: z.enum(['openai', 'disabled']).default('disabled'), EMBEDDING_MODEL: z.string().default(''), EMBEDDING_API_KEY: z.string().default(''),
  LLM_TIMEOUT_MS: int(60000), LLM_MAX_OUTPUT_TOKENS: int(6000),
  DIKSHA_ENABLED: bool(false), DIKSHA_API_BASE_URL: z.string().default(''), DIKSHA_API_KEY: z.string().default(''),
  NCERT_ENABLED: bool(true), LICENSED_ENABLED: bool(false), COMMERCIAL_MODE: bool(true),
  MAX_BOOK_SIZE_MB: int(100, 500), MAX_SAMPLE_PAPER_SIZE_MB: int(20, 100), MAX_EXTRACTED_CHARACTERS: int(1000000, 3000000), MAX_BOOK_PAGES: int(1500, 3000),
  MAX_ARCHIVE_ENTRIES: int(3000), MAX_ARCHIVE_EXPANDED_MB: int(150, 500), MAX_CHUNKS_PER_BOOK: int(2500, 4000),
  MAX_QUESTIONS_PER_PAPER: int(100, 100), MAX_CHAPTERS_PER_GENERATION: int(10, 30), MAX_CONTEXT_TOKENS: int(6000, 20000),
  RETRIEVAL_TOP_K: int(6, 20), MAX_RETRIEVAL_CANDIDATES: int(2500, 5000), MAX_QUESTION_RETRIES: int(3, 5),
  MAX_GENERATIONS_PER_HOUR: int(10), GENERATION_RATE_LIMIT: int(10), MAX_CONCURRENT_GENERATIONS: int(2, 20), UPLOAD_RATE_LIMIT: int(10),
  OTP_MAX_ATTEMPTS: int(10), OTP_SEND_LIMIT: int(5), OTP_RATE_LIMIT_WINDOW: int(900), OTP_IP_LIMIT: int(20), OTP_IP_WINDOW: int(3600),
  API_RATE_LIMIT: int(300), API_RATE_WINDOW: int(60), IDEMPOTENCY_TTL_SECONDS: int(86400),
  JOB_ATTEMPTS: int(3, 10), JOB_BACKOFF_MS: int(5000), JOB_TIMEOUT_MS: int(900000), WORKER_CONCURRENCY: int(2, 10),
  QUEUE_KEEP_COMPLETED: int(1000), QUEUE_KEEP_FAILED: int(5000), JOB_RETENTION_DAYS: int(30), CLEANUP_INTERVAL_MS: int(3600000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'), TRUST_PROXY: z.string().default(''), LOG_LEVEL: z.string().default('info'),
  PDF_FONT_PATH: z.string().default(''), PDF_BOLD_FONT_PATH: z.string().default(''), PDF_TITLE: z.string().max(100).default('QuestMind'),
  PDF_FONTS_JSON: z.string().default('{}'), UPLOAD_TEMP_DIR: z.string().default('/tmp/questmind-uploads'),
});
export const env = Object.freeze(schema.parse(process.env));
export function validateRuntimeEnv() {
  for (const key of ['MONGO_URI', 'REDIS_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID', 'AWS_S3_BUCKET']) {
    if (!env[key]) throw new Error(`Missing required environment variable: ${key}`);
  }
  if (env.JWT_ACCESS_SECRET.length < 32 || env.JWT_REFRESH_SECRET.length < 32 || env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) throw new Error('JWT secrets must be distinct and at least 32 characters');
  if (env.LLM_PROVIDER === 'openai' && (!env.LLM_MODEL || !env.LLM_API_KEY)) throw new Error('Configure LLM_MODEL and LLM_API_KEY');
  if (env.EMBEDDING_PROVIDER === 'openai' && (!env.EMBEDDING_MODEL || !env.EMBEDDING_API_KEY)) throw new Error('Configure EMBEDDING_MODEL and EMBEDDING_API_KEY');
  if (env.NODE_ENV === 'production' && (env.LLM_PROVIDER === 'disabled' || env.EMBEDDING_PROVIDER === 'disabled')) throw new Error('Production requires AI and embedding providers');
  if (env.NODE_ENV === 'production' && env.CORS_ORIGIN.split(',').some(v => !v.trim().startsWith('https://'))) throw new Error('Production CORS origins must use HTTPS');
}
