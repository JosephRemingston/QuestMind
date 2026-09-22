import mongoose from 'mongoose';
import GenerationJob from '../../models/GenerationJob.js';
import QuestionPaper from '../../models/QuestionPaper.js';
import User from '../../models/User.js';
import { getRedis } from '../../configs/redis.js';
import { env } from '../../configs/env.js';
import { transaction } from '../../configs/database.js';
import { sha256, stableStringify } from '../../utils/crypto.js';
import ApiError from '../../utils/ApiError.js';
import { listPage } from '../../utils/pagination.js';
import { requireReady } from '../textbooks/textbook.service.js';
import { getPattern } from '../patterns/pattern.service.js';
import { parsePattern } from '../patterns/patternParser.service.js';
import { enqueue } from '../operations/outbox.service.js';
import { downloadUrl } from '../storage/s3.service.js';
export const jobView = job => ({ jobId: String(job._id), status: job.status, progress: job.progress, questionsGenerated: job.questionsGenerated, totalQuestions: job.totalQuestions, questionPaperId: job.questionPaperId, error: job.error });
function existingJob(job, requestHash) { if (job.requestHash !== requestHash) throw new ApiError(409, 'Idempotency-Key was already used with a different request', 'IDEMPOTENCY_CONFLICT'); return jobView(job); }
export async function generate(userId, input, idempotencyKey) {
  if (idempotencyKey && !/^[\x21-\x7e]{1,128}$/.test(idempotencyKey)) throw new ApiError(400, 'Idempotency-Key must be 1-128 printable ASCII characters');
  const requestHash = sha256(stableStringify(input)), keyHash = idempotencyKey ? sha256(idempotencyKey) : undefined;
  const redisKey = keyHash ? `idempotency:${userId}:${keyHash}` : null;
  if (redisKey) {
    const cachedId = await getRedis().get(redisKey);
    const existing = cachedId ? await GenerationJob.findOne({ _id: cachedId, userId }) : await GenerationJob.findOne({ userId, idempotencyKeyHash: keyHash });
    if (existing) return existingJob(existing, requestHash);
  }
  await requireReady(input.textbookId, input.chapterIds, userId);
  let pattern, patternId;
  if (input.patternId) {
    const stored = await getPattern(input.patternId, userId); patternId = stored._id;
    pattern = parsePattern({ name: stored.name, sections: stored.sections.map(s => s.toObject()), totalMarks: stored.totalMarks });
  } else pattern = parsePattern(input.pattern);
  if (input.totalMarks !== undefined && input.totalMarks !== pattern.totalMarks) throw new ApiError(400, 'Requested marks do not match pattern', 'INVALID_PATTERN');
  if (input.numberOfQuestions !== undefined && input.numberOfQuestions !== pattern.totalQuestions) throw new ApiError(400, 'Requested question count does not match pattern', 'INVALID_PATTERN');
  if (pattern.totalQuestions < input.chapterIds.length) throw new ApiError(400, 'Select at least one question per selected chapter', 'INVALID_PATTERN');
  const jobId = new mongoose.Types.ObjectId();
  try {
    await transaction(async session => {
      const user = await User.findOneAndUpdate({ _id: userId, isActive: true, activeGenerations: { $lt: env.MAX_CONCURRENT_GENERATIONS } }, { $inc: { activeGenerations: 1 } }, { session, new: true });
      if (!user) throw new ApiError(429, 'Maximum concurrent generations reached', 'GENERATION_LIMIT_REACHED');
      await GenerationJob.create([{ _id: jobId, userId, textbookId: input.textbookId, chapterIds: input.chapterIds, patternId, pattern: { sections: pattern.sections, totalMarks: pattern.totalMarks, totalQuestions: pattern.totalQuestions }, difficulty: input.difficulty, difficultyDistribution: input.difficultyDistribution ?? { easy: 30, medium: 50, hard: 20 }, durationMinutes: input.durationMinutes, title: input.title, totalMarks: pattern.totalMarks, totalQuestions: pattern.totalQuestions, ...(keyHash ? { idempotencyKeyHash: keyHash } : {}), requestHash }], { session });
      await enqueue('question-generation', 'GENERATE', String(jobId), { generationJobId: String(jobId), userId }, session);
    });
  } catch (error) {
    if (keyHash) { const existing = await GenerationJob.findOne({ userId, idempotencyKeyHash: keyHash }); if (existing) return existingJob(existing, requestHash); }
    throw error;
  }
  // MongoDB's unique index is the durable idempotency authority. Redis accelerates repeats.
  if (redisKey) await getRedis().set(redisKey, String(jobId), 'EX', env.IDEMPOTENCY_TTL_SECONDS).catch(() => {});
  return jobView(await GenerationJob.findById(jobId));
}
export async function getJob(id, userId) { const job = await GenerationJob.findOne({ _id: id, userId }); if (!job) throw new ApiError(404, 'Generation job not found', 'RESOURCE_NOT_FOUND'); return jobView(job); }
export async function ownedPaper(id, userId, keys = false) {
  const query = QuestionPaper.findOne({ _id: id, userId, status: { $ne: 'archived' } }); if (keys) query.select('+answerKey +pdfKey +answerPdfKey');
  const paper = await query; if (!paper) throw new ApiError(404, 'Question paper not found', 'RESOURCE_NOT_FOUND'); return paper;
}
export const paperView = paper => {
  const { answerKey, pdfKey, answerPdfKey, ...value } = paper.toObject ? paper.toObject() : paper;
  return { ...value, id: String(value._id), ...(value.questions ? { questions: value.questions.map(({ correctAnswer, explanation, evidence, ...q }) => q) } : {}) };
};
export const getPaper = async (id, userId) => paperView(await ownedPaper(id, userId));
export async function listPapers(userId, query) { const page = await listPage(QuestionPaper, { userId, status: { $ne: 'archived' } }, query, '-questions -answerKey -pdfKey -answerPdfKey'); return { papers: page.items.map(paperView), pagination: page.pagination }; }
export async function archivePaper(id, userId) { await ownedPaper(id, userId); await QuestionPaper.updateOne({ _id: id, userId }, { $set: { status: 'archived' } }); }
export const answerKey = async (id, userId) => (await ownedPaper(id, userId, true)).answerKey;
export async function pdf(id, userId, answer = false) {
  const paper = await ownedPaper(id, userId, true), key = answer ? paper.answerPdfKey : paper.pdfKey;
  if (paper.pdfStatus !== 'ready' || !key) throw new ApiError(409, 'PDF is not ready yet', 'PDF_NOT_READY');
  return { url: await downloadUrl(key, answer ? 'answer-key.pdf' : 'question-paper.pdf'), expiresInSeconds: env.S3_URL_TTL_SECONDS };
}
export async function regenerate(id, userId, idempotencyKey) {
  const paper = await ownedPaper(id, userId);
  const job = await GenerationJob.findOne({ _id: paper.generationJobId, userId });
  return generate(userId, { textbookId: String(job.textbookId), chapterIds: job.chapterIds.map(String), pattern: { sections: job.pattern.sections.map(s => { const { totalMarks, ...value } = s.toObject(); return value; }) }, difficulty: job.difficulty, ...(job.difficulty === 'mixed' ? { difficultyDistribution: job.difficultyDistribution } : {}), durationMinutes: job.durationMinutes, title: job.title }, idempotencyKey);
}
