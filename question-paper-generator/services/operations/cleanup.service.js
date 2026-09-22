import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../configs/env.js';
import RefreshToken from '../../models/RefreshToken.js';
import StorageObject from '../../models/StorageObject.js';
import Textbook from '../../models/Textbook.js';
import SamplePaper from '../../models/SamplePaper.js';
import QuestionPaper from '../../models/QuestionPaper.js';
import GenerationJob from '../../models/GenerationJob.js';
import Outbox from '../../models/Outbox.js';
import { deleteObject } from '../storage/s3.service.js';
import { getQueue } from '../../queues/base.queue.js';
import { recordFinalFailure } from './failure.service.js';
import { transaction } from '../../configs/database.js';
import { releaseSlot } from '../papers/generation.service.js';
export async function cleanup() {
  const dayAgo = new Date(Date.now() - 86400000), cutoff = new Date(Date.now() - env.JOB_RETENTION_DAYS * 86400000);
  await RefreshToken.deleteMany({ expiresAt: { $lt: new Date() } });
  for (const object of await StorageObject.find({ committed: false, createdAt: { $lt: dayAgo } }).limit(100)) {
    const Model = { textbook: Textbook, sample: SamplePaper, paper: QuestionPaper }[object.kind];
    if (Model && await Model.exists({ _id: object.resourceId })) continue;
    await deleteObject(object.key); await StorageObject.deleteOne({ _id: object._id });
  }
  for (const name of await readdir(env.UPLOAD_TEMP_DIR).catch(() => [])) {
    if (!/^[a-f0-9-]{36}$/.test(name)) continue;
    const file = path.join(env.UPLOAD_TEMP_DIR, name), info = await stat(file).catch(() => null);
    if (info?.isFile() && info.mtime < dayAgo) await unlink(file).catch(() => {});
  }
  for (const name of ['textbook-processing', 'question-generation', 'pdf-generation']) {
    const queue = getQueue(name);
    for (const job of await queue.getJobs(['failed'], 0, 199)) await recordFinalFailure(job);
    await queue.clean(env.JOB_RETENTION_DAYS * 86400000, 1000, 'completed');
    await queue.clean(env.JOB_RETENTION_DAYS * 86400000, 1000, 'failed');
  }
  // Expire stuck generation reservations only after checking there is no active queue job.
  for (const job of await GenerationJob.find({ status: { $in: ['queued', 'processing', 'validating'] }, createdAt: { $lt: cutoff } }).limit(100)) {
    const queued = await getQueue('question-generation').getJob(job.id);
    if (queued && ['active', 'waiting', 'delayed'].includes(await queued.getState())) continue;
    await transaction(async session => { await GenerationJob.updateOne({ _id: job.id }, { $set: { status: 'failed', completedAt: new Date(), error: { errorCode: 'GENERATION_FAILED', message: 'Generation expired' } } }, { session }); await releaseSlot(job.id, session); });
  }
  await Outbox.deleteMany({ dispatchedAt: { $lt: cutoff } });
}
