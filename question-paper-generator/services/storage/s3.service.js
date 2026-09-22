import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3 } from '../../configs/s3.js';
import { env } from '../../configs/env.js';
import ApiError from '../../utils/ApiError.js';
export async function putObject(key, body, contentType, signal) {
  await s3.send(new PutObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: 'AES256' }), { abortSignal: signal }); return key;
}
export async function getObject(key, maxBytes = env.MAX_BOOK_SIZE_MB * 1024 * 1024, signal) {
  const response = await s3.send(new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }), { abortSignal: signal });
  if (response.ContentLength > maxBytes) { response.Body.destroy(); throw new ApiError(413, 'Stored file exceeds size limit', 'FILE_TOO_LARGE'); }
  const buffers = []; let size = 0;
  for await (const chunk of response.Body) { size += chunk.length; if (size > maxBytes) { response.Body.destroy(); throw new ApiError(413, 'Stored file exceeds size limit', 'FILE_TOO_LARGE'); } buffers.push(chunk); }
  return Buffer.concat(buffers);
}
export const deleteObject = key => s3.send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }));
export const downloadUrl = (key, name) => getSignedUrl(s3, new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key, ResponseContentDisposition: `attachment; filename="${name}"`, ResponseContentType: 'application/pdf' }), { expiresIn: env.S3_URL_TTL_SECONDS });
