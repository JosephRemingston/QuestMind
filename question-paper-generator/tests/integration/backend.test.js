import { jest, beforeAll, afterAll, beforeEach, test, expect } from '@jest/globals';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import PDFDocument from 'pdfkit';
import request from 'supertest';
process.env.REDIS_URL = `redis://127.0.0.1:${21000 + Math.floor(Math.random() * 30000)}`;
const objects = new Map();
const send = jest.fn(async () => ({ sid: 'VE_mock', status: 'pending' }));
const check = jest.fn(async () => ({ status: 'approved' }));
jest.unstable_mockModule('../../configs/twilio.js', () => ({ getVerify: () => ({ verifications: { create: send }, verificationChecks: { create: check } }) }));
jest.unstable_mockModule('../../services/storage/s3.service.js', () => ({ putObject: jest.fn(async (key, bytes) => { objects.set(key, Buffer.from(bytes)); return key; }), getObject: jest.fn(async key => { if (!objects.has(key)) throw new Error('Missing test object'); return objects.get(key); }), deleteObject: jest.fn(async key => objects.delete(key)), downloadUrl: jest.fn(async key => `https://private.test/${key}?signed=test`) }));
const { env } = await import('../../configs/env.js');
const { createApp } = await import('../../app.js');
const { setRedisForTest } = await import('../../configs/redis.js');
const { issueTokens } = await import('../../services/auth/token.service.js');
const { closeQueues } = await import('../../queues/base.queue.js');
const { dispatchOutbox } = await import('../../services/operations/outbox.service.js');
const { generationQueue } = await import('../../queues/generation.queue.js');
const { processGeneration } = await import('../../services/papers/generation.service.js');
const { processPdf } = await import('../../services/papers/pdfProcessing.service.js');
const { processTextbook } = await import('../../services/textbooks/textbookProcessing.service.js');
const { analyzeSample } = await import('../../services/patterns/samplePaperAnalyzer.service.js');
const { registerLLMProvider } = await import('../../services/ai/llm.service.js');
const { registerEmbeddingProvider, embeddingIdentity } = await import('../../services/ai/embedding.service.js');
const { recordFinalFailure } = await import('../../services/operations/failure.service.js');
const { Worker } = await import('bullmq');
const models = {};
for (const filename of await readdir(new URL('../../models/', import.meta.url))) if (filename.endsWith('.js') && filename !== 'shared.js') { const Model = (await import(`../../models/${filename}`)).default; models[Model.modelName] = Model; }
const { User, Textbook, Chapter, BookChunk, QuestionPattern, GenerationJob, QuestionPaper, Question, SamplePaper, RefreshToken, Outbox, StorageObject } = models;
const parseBoundary = (prompt, name) => JSON.parse(prompt.split(`<${name}>\n`)[1].split(`\n</${name}>`)[0].replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
let llmCalls = 0;
registerLLMProvider('disabled', { generateStructuredOutput: async ({ schema, userPrompt }) => {
  llmCalls++;
  if (schema.properties.supported) return { supported: true, correct: true, uniqueAnswer: true, difficultyAppropriate: true, duplicate: false, safe: true, reason: 'Supported by the triangle source.' };
  if (schema.properties.chapters) return { chapters: [] };
  if (schema.properties.sections) return { name: 'Sample Unit Test', totalMarks: 4, sections: [{ name: 'Section A', questionType: 'mcq', count: 2, marksEach: 1, totalMarks: 2, instructions: '', choiceCount: 0 }, { name: 'Section B', questionType: 'short_answer', count: 1, marksEach: 2, totalMarks: 2, instructions: '', choiceCount: 0 }], difficultySignals: 'Recall and application', numbering: 'Continuous', caseStudyStructure: 'None', unsupportedStructure: false };
  const spec = parseBoundary(userPrompt, 'USER_REQUIREMENTS'), context = parseBoundary(userPrompt, 'BOOK_CONTENT'), source = context[0];
  return { questionNumber: spec.questionNumber, sectionIndex: spec.sectionIndex, type: spec.type, marks: spec.marks, difficulty: spec.difficulty, question: spec.questionNumber === 1 ? 'How many sides does a triangle have?' : 'What defines an equilateral triangle?', options: spec.questionNumber === 1 ? ['Two', 'Three', 'Four', 'Five'] : ['Three equal sides', 'Two equal sides', 'No equal sides', 'Four equal sides'], correctAnswer: spec.questionNumber === 1 ? 'Three' : 'Three equal sides', explanation: spec.questionNumber === 1 ? 'A triangle has three sides.' : 'An equilateral triangle has three equal sides.', concept: spec.questionNumber === 1 ? 'Triangle sides' : 'Equilateral definition', evidence: spec.questionNumber === 1 ? 'A triangle has three sides.' : 'An equilateral triangle has three equal sides.', source: { chapterId: source.chapterId, page: source.page, chunkIds: [source.chunkId] } };
} });
registerEmbeddingProvider('disabled', { embedTexts: async texts => texts.map(() => [1, 0.2, 0.1]) });
let mongo, redis, redisProcess, app, user, stranger, token, book, chapter;
const auth = () => ({ Authorization: `Bearer ${token.accessToken}` });
const body = () => ({ textbookId: book.id, chapterIds: [chapter.id], pattern: { sections: [{ type: 'mcq', count: 2, marksEach: 1 }] }, difficulty: 'medium', durationMinutes: 60 });
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri(), { dbName: 'questmind-tests' });
  await Promise.all(Object.values(models).map(m => m.init()));
  const port = new URL(env.REDIS_URL).port;
  redisProcess = spawn('redis-server', ['--bind', '127.0.0.1', '--port', port, '--save', '', '--appendonly', 'no'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { redisProcess.once('error', reject); redisProcess.once('exit', code => { if (code) reject(new Error('Test Redis failed to start')); }); redisProcess.stdout.on('data', data => { if (data.toString().includes('Ready to accept connections')) resolve(); }); });
  redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 }); await redis.ping(); setRedisForTest(redis); app = createApp();
});
afterAll(async () => { await closeQueues(); if (redis) await redis.quit(); if (redisProcess) { redisProcess.kill('SIGTERM'); await once(redisProcess, 'exit'); } await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => {
  await closeQueues(); await redis.flushdb(); await Promise.all(Object.values(models).map(m => m.deleteMany({})));
  objects.clear(); send.mockReset().mockResolvedValue({ sid: 'VE_mock', status: 'pending' }); check.mockReset().mockResolvedValue({ status: 'approved' }); llmCalls = 0;
  user = await User.create({ phoneNumber: '+919876543210', role: 'student', board: 'CBSE', classLevel: '10', medium: 'English' });
  stranger = await User.create({ phoneNumber: '+919876543211', role: 'teacher' }); token = await issueTokens(user);
  book = await Textbook.create({ source: 'licensed', externalId: 'original-triangles', title: 'Geometry Foundations', board: 'CBSE', classLevel: '10', medium: 'English', subject: 'Mathematics', publisher: 'QuestMind', contentStatus: 'ready', contentAccessMethod: 'licensed_content', permissions: { metadata_available: true, content_available: true, content_download_allowed: true, content_processing_allowed: true, commercial_use_allowed: true, authorizationReference: 'Original test fixture' } });
  chapter = await Chapter.create({ textbookId: book.id, externalId: 'triangles', title: 'Triangles', chapterNumber: 1, order: 1, contentStatus: 'ready', pageRange: { start: 1, end: 1 }, dialCode: 'LOCAL42' });
  book.chapters = [chapter._id]; await book.save();
  await BookChunk.create({ textbookId: book.id, chapterId: chapter.id, text: 'A triangle has three sides. An equilateral triangle has three equal sides. The sum of the interior angles of a triangle is 180 degrees.', pageNumber: 1, chunkIndex: 0, embedding: [1, 0.2, 0.1], embeddingModel: embeddingIdentity() });
});
test('phone login uses Twilio, creates tokens and exposes safe profile', async () => {
  await request(app).post('/api/v1/auth/send-otp').send({ phoneNumber: user.phoneNumber }).expect(200);
  const response = await request(app).post('/api/v1/auth/verify-otp').send({ phoneNumber: user.phoneNumber, code: '123456' }).expect(200);
  expect(send).toHaveBeenCalledWith({ to: user.phoneNumber, channel: 'sms' }); expect(check).toHaveBeenCalledWith({ verificationSid: 'VE_mock', code: '123456' }); expect(response.body.data.accessToken).toBeTruthy();
  const profile = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${response.body.data.accessToken}`).expect(200);
  expect(profile.body.data.role).toBe('student'); expect(profile.body.data.activeGenerations).toBeUndefined();
  expect((await RefreshToken.find().select('+tokenHash')).every(t => !t.tokenHash.includes(response.body.data.refreshToken))).toBe(true);
});
test('invalid, expired and reused OTP cannot log in', async () => {
  const payload = { phoneNumber: user.phoneNumber, code: '123456' };
  await request(app).post('/api/v1/auth/verify-otp').send(payload).expect(400);
  await request(app).post('/api/v1/auth/send-otp').send({ phoneNumber: user.phoneNumber }).expect(200);
  check.mockResolvedValueOnce({ status: 'pending' }); await request(app).post('/api/v1/auth/verify-otp').send(payload).expect(400);
  check.mockRejectedValueOnce({ status: 404 }); await request(app).post('/api/v1/auth/verify-otp').send(payload).expect(400);
  await request(app).post('/api/v1/auth/verify-otp').send(payload).expect(200);
  await request(app).post('/api/v1/auth/verify-otp').send(payload).expect(400);
});
test('Redis phone OTP rate limit is enforced', async () => { for (let i = 0; i < 5; i++) await request(app).post('/api/v1/auth/send-otp').send({ phoneNumber: user.phoneNumber }).expect(200); const r = await request(app).post('/api/v1/auth/send-otp').send({ phoneNumber: user.phoneNumber }).expect(429); expect(r.body.errorCode).toBe('OTP_RATE_LIMITED'); expect(r.headers['retry-after']).toBeTruthy(); expect(send).toHaveBeenCalledTimes(5); });
test('refresh rotates and replay revokes the entire session', async () => {
  const rotated = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token.refreshToken }).expect(200);
  await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${rotated.body.data.accessToken}`).expect(200);
  await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token.refreshToken }).expect(401);
  await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${rotated.body.data.accessToken}`).expect(401);
});
test('logout immediately invalidates access and refresh', async () => { await request(app).post('/api/v1/auth/logout').set(auth()).send({}).expect(200); await request(app).get('/api/v1/auth/me').set(auth()).expect(401); await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token.refreshToken }).expect(401); });
test('catalog filtering, search, chapter details, QR and recommendations', async () => {
  const books = await request(app).get('/api/v1/textbooks?board=CBSE&classLevel=10&search=Geometry').set(auth()).expect(200); expect(books.body.data.books).toHaveLength(1); expect(books.body.data.books[0].contentAvailable).toBe(true); expect(books.body.data.books[0].permissions).toBeUndefined();
  await request(app).get(`/api/v1/textbooks/${book.id}/chapters`).set(auth()).expect(200).expect(r => expect(r.body.data.chapters[0].id).toBe(chapter.id));
  await request(app).get(`/api/v1/chapters/${chapter.id}`).set(auth()).expect(200);
  await request(app).post('/api/v1/textbooks/resolve-qr').set(auth()).send({ code: 'LOCAL42' }).expect(200).expect(r => expect(r.body.data.chapter.id).toBe(chapter.id));
  await request(app).get('/api/v1/textbooks/recommended').set(auth()).expect(200).expect(r => expect(r.body.data.books).toHaveLength(1));
});
test('private books and chapters cannot be accessed by another user', async () => { book.userId = stranger.id; await book.save(); chapter.userId = stranger.id; await chapter.save(); await request(app).get(`/api/v1/textbooks/${book.id}`).set(auth()).expect(404); await request(app).get(`/api/v1/chapters/${chapter.id}`).set(auth()).expect(404); await request(app).get('/api/v1/textbooks').set(auth()).expect(200).expect(r => expect(r.body.data.books).toHaveLength(0)); });
test('metadata-only textbook cannot queue generation', async () => { book.contentStatus = 'metadata_only'; await book.save(); const response = await request(app).post('/api/v1/question-papers/generate').set(auth()).send(body()).expect(409); expect(response.body.errorCode).toBe('BOOK_CONTENT_NOT_READY'); expect(await GenerationJob.countDocuments()).toBe(0); });
test('wrong-book chapters fail before creating jobs', async () => { const wrong = new mongoose.Types.ObjectId(); await request(app).post('/api/v1/question-papers/generate').set(auth()).send({ ...body(), chapterIds: [String(wrong)] }).expect(404); expect(await Outbox.countDocuments()).toBe(0); });
test('idempotency is atomic under simultaneous requests and survives cache loss', async () => {
  const responses = await Promise.all(Array.from({ length: 4 }, () => request(app).post('/api/v1/question-papers/generate').set(auth()).set('Idempotency-Key', 'same-request').send(body())));
  expect(responses.map(r => r.status)).toEqual([202, 202, 202, 202]); expect(new Set(responses.map(r => r.body.data.jobId)).size).toBe(1);
  expect(await GenerationJob.countDocuments()).toBe(1); expect(await Outbox.countDocuments()).toBe(1); expect((await User.findById(user.id)).activeGenerations).toBe(1);
  await redis.flushdb(); // Restore this session only; Mongo idempotency remains durable.
  token = await issueTokens(user);
  await request(app).post('/api/v1/question-papers/generate').set(auth()).set('Idempotency-Key', 'same-request').send(body()).expect(202);
  await request(app).post('/api/v1/question-papers/generate').set(auth()).set('Idempotency-Key', 'same-request').send({ ...body(), difficulty: 'hard' }).expect(409);
});
test('concurrency reservation cannot exceed configured user maximum', async () => { const responses = await Promise.all(Array.from({ length: 4 }, () => request(app).post('/api/v1/question-papers/generate').set(auth()).send(body()))); expect(responses.filter(r => r.status === 202)).toHaveLength(2); expect(responses.filter(r => r.status === 429)).toHaveLength(2); expect(await GenerationJob.countDocuments()).toBe(2); });
test('generation, actual BullMQ dispatch, validated paper, PDFs, downloads and retry safety', async () => {
  const queued = await request(app).post('/api/v1/question-papers/generate').set(auth()).send(body()).expect(202), jobId = queued.body.data.jobId;
  await dispatchOutbox(); await dispatchOutbox(); expect(await generationQueue().getJob(jobId)).toBeTruthy();
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const worker = new Worker('question-generation', job => processGeneration(job.data.generationJobId), { connection });
  try { await new Promise((resolve, reject) => { worker.on('completed', resolve); worker.on('failed', (_j, err) => reject(err)); worker.on('error', reject); }); }
  finally { await worker.close(); await connection.quit(); }
  const job = await GenerationJob.findById(jobId); expect(job.status).toBe('completed'); expect(job.progress).toBe(100); expect((await User.findById(user.id)).activeGenerations).toBe(0); expect(await Question.countDocuments()).toBe(2);
  const calls = llmCalls; await processGeneration(jobId); expect(llmCalls).toBe(calls); expect(await QuestionPaper.countDocuments()).toBe(1);
  const response = await request(app).get(`/api/v1/question-papers/${job.questionPaperId}`).set(auth()).expect(200); expect(response.body.data.questions[0].correctAnswer).toBeUndefined(); expect(response.body.data.questions[0].evidence).toBeUndefined();
  await request(app).get('/api/v1/question-papers').set(auth()).expect(200).expect(r => { expect(r.body.data.papers).toHaveLength(1); expect(r.body.data.papers[0].questions).toBeUndefined(); });
  await request(app).get(`/api/v1/question-papers/${job.questionPaperId}/answer-key`).set(auth()).expect(200).expect(r => expect(r.body.data.answerKey[0].correctAnswer).toBe('Three'));
  await processPdf(String(job.questionPaperId)); const size = objects.size; await processPdf(String(job.questionPaperId)); expect(objects.size).toBe(size);
  const downloaded = await request(app).get(`/api/v1/question-papers/${job.questionPaperId}/pdf`).set(auth()).expect(200); expect(downloaded.body.data.url).toContain('signed=test');
  await mkdir('tmp/pdfs', { recursive: true });
  for (const [key, bytes] of objects) { expect(bytes.subarray(0, 5).toString()).toBe('%PDF-'); await writeFile(`tmp/pdfs/${key.endsWith('answer-key.pdf') ? 'answer-key' : 'question-paper'}.pdf`, bytes); }
  const other = await issueTokens(stranger);
  for (const suffix of ['', '/answer-key', '/pdf']) await request(app).get(`/api/v1/question-papers/${job.questionPaperId}${suffix}`).set('Authorization', `Bearer ${other.accessToken}`).expect(404);
  await request(app).get(`/api/v1/generation-jobs/${jobId}`).set('Authorization', `Bearer ${other.accessToken}`).expect(404);
  await request(app).delete(`/api/v1/question-papers/${job.questionPaperId}`).set(auth()).expect(200);
  await request(app).get(`/api/v1/question-papers/${job.questionPaperId}/pdf`).set(auth()).expect(404);
});
test('final worker failure releases concurrency exactly once', async () => {
  const r = await request(app).post('/api/v1/question-papers/generate').set(auth()).send(body()).expect(202);
  const fake = { data: { generationJobId: r.body.data.jobId }, opts: { attempts: 3 }, attemptsMade: 3 };
  await recordFinalFailure(fake); await recordFinalFailure(fake);
  expect((await GenerationJob.findById(r.body.data.jobId)).status).toBe('failed'); expect((await User.findById(user.id)).activeGenerations).toBe(0);
});
const fixturePdf = () => new Promise(resolve => { const doc = new PDFDocument(); const buffers = []; doc.on('data', b => buffers.push(b)); doc.on('end', () => resolve(Buffer.concat(buffers))); doc.fontSize(20).text('Chapter 1 Triangles'); doc.fontSize(12).text('A triangle has three sides. An equilateral triangle has three equal sides. The sum of the interior angles of a triangle is 180 degrees. These definitions help classify shapes and solve geometry problems.'); doc.end(); });
test('uploaded PDF extracts, embeds and publishes owned chapters idempotently', async () => {
  const r = await request(app).post('/api/v1/textbooks/upload').set(auth()).field('title', 'My Geometry').field('board', 'CBSE').field('classLevel', '10').field('medium', 'English').field('subject', 'Maths').field('rightsConfirmed', 'true').attach('file', await fixturePdf(), { filename: 'book.pdf', contentType: 'application/pdf' }).expect(202);
  const id = r.body.data.textbook.id; expect(r.body.data.textbook.contentAvailable).toBe(false);
  await processTextbook(id); const n = await BookChunk.countDocuments({ textbookId: id }); expect(n).toBeGreaterThan(0);
  await processTextbook(id); expect(await BookChunk.countDocuments({ textbookId: id })).toBe(n);
  expect((await Textbook.findById(id)).contentStatus).toBe('ready'); expect(String((await Chapter.findOne({ textbookId: id })).userId)).toBe(user.id);
});
test('sample upload is teacher-only and extracts reusable structure', async () => {
  await request(app).post('/api/v1/sample-papers/upload').set(auth()).expect(403);
  const teacher = await issueTokens(stranger);
  const r = await request(app).post('/api/v1/sample-papers/upload').set('Authorization', `Bearer ${teacher.accessToken}`).field('title', 'Unit Exam').attach('file', await fixturePdf(), { filename: 'sample.pdf', contentType: 'application/pdf' }).expect(202);
  await analyzeSample(r.body.data.samplePaperId); await analyzeSample(r.body.data.samplePaperId);
  const sample = await SamplePaper.findById(r.body.data.samplePaperId); expect(sample.processingStatus).toBe('ready'); expect(await QuestionPattern.countDocuments({ samplePaperId: sample.id })).toBe(1); expect(sample.analyzedPattern.totalMarks).toBe(4);
  await request(app).get(`/api/v1/sample-papers/${sample.id}`).set(auth()).expect(404);
});
test('role escalation, unowned patterns and invalid input are rejected', async () => {
  await request(app).patch('/api/v1/users/me').set(auth()).send({ role: 'admin' }).expect(400);
  await request(app).post('/api/v1/admin/textbooks').set(auth()).send({}).expect(403);
  await request(app).get('/api/v1/textbooks').expect(401);
  await request(app).get('/api/v1/textbooks?limit=101').set(auth()).expect(400);
  await request(app).get('/api/v1/textbooks?board[$ne]=CBSE').set(auth()).expect(400);
  const pattern = await QuestionPattern.create({ userId: stranger.id, name: 'Private', sections: [{ type: 'mcq', count: 1, marksEach: 1 }], totalMarks: 1, totalQuestions: 1 });
  await request(app).get(`/api/v1/patterns/${pattern.id}`).set(auth()).expect(404);
});
test('readiness checks real Mongo and Redis', async () => { await request(app).get('/api/v1/health').expect(200); const response = await request(app).get('/api/v1/health/ready').expect(200); expect(response.body.data.checks).toEqual({ mongodb: 'up', redis: 'up' }); });
test('admin can curate and ingest authorized content while users cannot grant permissions', async () => {
  user.role = 'admin'; await user.save();
  const meta = { source: 'licensed', externalId: 'approved-new-edition', title: 'Approved Geometry', board: 'CBSE', classLevel: '10', medium: 'English', subject: 'Mathematics' };
  const created = await request(app).post('/api/v1/admin/textbooks').set(auth()).send(meta).expect(201), id = created.body.data.id;
  const file = await fixturePdf();
  await request(app).post(`/api/v1/admin/textbooks/${id}/content`).set(auth()).attach('file', file, { filename: 'book.pdf', contentType: 'application/pdf' }).expect(409);
  await request(app).patch(`/api/v1/admin/textbooks/${id}`).set(auth()).send({ permissions: { metadata_available: true, content_available: false, content_download_allowed: true, content_processing_allowed: true, commercial_use_allowed: true, authorizationReference: 'School permission record #123' } }).expect(200);
  await request(app).post(`/api/v1/admin/textbooks/${id}/content`).set(auth()).attach('file', file, { filename: 'book.pdf', contentType: 'application/pdf' }).expect(202);
  await processTextbook(id); expect((await Textbook.findById(id)).contentStatus).toBe('ready');
  await request(app).post(`/api/v1/admin/textbooks/${id}/content`).set(auth()).attach('file', file, { filename: 'book.pdf', contentType: 'application/pdf' }).expect(409);
});
test('parent profiles stay owned and cannot impersonate another user', async () => {
  await request(app).post('/api/v1/users/students').set(auth()).send({}).expect(403);
  user.role = 'parent'; await user.save();
  const profile = await request(app).post('/api/v1/users/students').set(auth()).send({ name: 'Learner', board: 'CBSE', classLevel: '7', medium: 'English' }).expect(201);
  expect(profile.body.data.userId).toBe(user.id);
  stranger.role = 'parent'; await stranger.save(); const other = await issueTokens(stranger);
  await request(app).patch(`/api/v1/users/students/${profile.body.data.id}`).set('Authorization', `Bearer ${other.accessToken}`).send({ classLevel: '8' }).expect(404);
  await request(app).get('/api/v1/users/students').set(auth()).expect(200).expect(r => expect(r.body.data.items).toHaveLength(1));
  await request(app).delete(`/api/v1/users/students/${profile.body.data.id}`).set(auth()).expect(200);
});
test('metrics collect worker snapshots without exposing source content', async () => {
  user.role = 'admin'; await user.save();
  const r = await request(app).post('/api/v1/question-papers/generate').set(auth()).send(body()).expect(202); await processGeneration(r.body.data.jobId);
  const metrics = await request(app).get('/api/v1/metrics').set(auth()).expect(200);
  expect(metrics.text).toContain('questmind_operation_seconds'); expect(metrics.text).not.toContain('triangle');
  const other = await issueTokens(stranger); await request(app).get('/api/v1/metrics').set('Authorization', `Bearer ${other.accessToken}`).expect(403);
});
test('teacher patterns have server-computed marks and can be selected for generation', async () => {
  user.role = 'teacher'; await user.save();
  const r = await request(app).post('/api/v1/patterns').set(auth()).send({ name: 'Teacher Pattern', sections: [{ type: 'mcq', count: 2, marksEach: 1 }] }).expect(201);
  expect(r.body.data.totalMarks).toBe(2);
  const { pattern, ...spec } = body(); await request(app).post('/api/v1/question-papers/generate').set(auth()).send({ ...spec, patternId: r.body.data.id }).expect(202);
  await request(app).patch(`/api/v1/patterns/${r.body.data.id}`).set(auth()).send({ name: 'Revised', sections: [{ type: 'mcq', count: 3, marksEach: 2 }], totalMarks: 7 }).expect(400);
  await request(app).delete(`/api/v1/patterns/${r.body.data.id}`).set(auth()).expect(200);
});
test('generation transaction rolls back reservation when outbox persistence fails', async () => {
  const original = Outbox.updateOne; Outbox.updateOne = jest.fn(() => { throw new Error('Injected storage failure'); });
  try { const result = await request(app).post('/api/v1/question-papers/generate').set(auth()).send(body()); expect({ status: result.status, body: result.body }).toMatchObject({ status: 500, body: { errorCode: 'INTERNAL_ERROR' } }); }
  finally { Outbox.updateOne = original; }
  expect(await GenerationJob.countDocuments()).toBe(0); expect((await User.findById(user.id)).activeGenerations).toBe(0);
});
test('provider content authorization revocation blocks generation', async () => { book.permissions.commercial_use_allowed = false; await book.save(); await request(app).post('/api/v1/question-papers/generate').set(auth()).send(body()).expect(409); });
test('OTP verification limit applies before provider checks', async () => {
  for (let i = 0; i < 10; i++) await request(app).post('/api/v1/auth/verify-otp').send({ phoneNumber: user.phoneNumber, code: '000000' }).expect(400);
  await request(app).post('/api/v1/auth/verify-otp').send({ phoneNumber: user.phoneNumber, code: '000000' }).expect(429);
  expect(check).not.toHaveBeenCalled();
});
test('outbox remains pending on queue failure and recovers without duplicate jobs', async () => {
  const response = await request(app).post('/api/v1/question-papers/generate').set(auth()).send(body()).expect(202);
  const queue = generationQueue(), original = queue.add; queue.add = jest.fn(async () => { throw new Error('Injected Redis interruption'); });
  try { await dispatchOutbox(); } finally { queue.add = original; }
  expect((await Outbox.findOne({ jobId: response.body.data.jobId })).dispatchedAt).toBeUndefined();
  await dispatchOutbox(); await dispatchOutbox(); expect(await queue.getWaitingCount()).toBe(1);
});
