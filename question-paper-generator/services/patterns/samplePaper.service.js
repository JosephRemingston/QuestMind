import mongoose from 'mongoose';
import { basename } from 'node:path';
import SamplePaper from '../../models/SamplePaper.js';
import StorageObject from '../../models/StorageObject.js';
import { transaction } from '../../configs/database.js';
import { validateFile } from '../storage/file.service.js';
import { putObject } from '../storage/s3.service.js';
import { enqueue } from '../operations/outbox.service.js';
import { listPage } from '../../utils/pagination.js';
import ApiError from '../../utils/ApiError.js';
export async function uploadSample(userId, title, file) {
  const validated = await validateFile(file, 'sample'), id = new mongoose.Types.ObjectId(), key = `sample-papers/${userId}/${id}/original.pdf`;
  await StorageObject.create({ userId, key, resourceId: String(id), kind: 'sample' });
  await putObject(key, validated.buffer, validated.mimeType);
  await transaction(async session => {
    await SamplePaper.create([{ _id: id, userId, title, s3Key: key, originalFilename: basename(file.originalname).slice(0, 255), mimeType: validated.mimeType, size: file.size }], { session });
    await StorageObject.updateOne({ key }, { $set: { committed: true } }, { session });
    await enqueue('textbook-processing', 'ANALYZE_SAMPLE', `sample-${id}`, { samplePaperId: String(id), userId }, session);
  }); return { samplePaperId: String(id), jobId: `sample-${id}`, status: 'queued' };
}
export const listSamples = (userId, query) => listPage(SamplePaper, { userId }, query);
export async function getSample(id, userId) { const s = await SamplePaper.findOne({ _id: id, userId }); if (!s) throw new ApiError(404, 'Sample paper not found', 'RESOURCE_NOT_FOUND'); return s; }
