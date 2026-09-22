import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';
export const s3 = new S3Client({ region: env.AWS_REGION, ...(env.AWS_S3_ENDPOINT ? { endpoint: env.AWS_S3_ENDPOINT } : {}), forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE, maxAttempts: 3 });
