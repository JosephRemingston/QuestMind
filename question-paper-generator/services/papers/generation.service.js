import mongoose from 'mongoose';
import GenerationJob from '../../models/GenerationJob.js';
import QuestionPaper from '../../models/QuestionPaper.js';
import Question from '../../models/Question.js';
import User from '../../models/User.js';
import { transaction } from '../../configs/database.js';
import { requireReady } from '../textbooks/textbook.service.js';
import { retrieve } from '../retrieval/retrieval.service.js';
import { buildContext } from '../retrieval/contextBuilder.service.js';
import { buildSlots, balanceMcqAnswers } from './scoring.service.js';
import { generateQuestion } from '../ai/questionGenerator.service.js';
import { validatePaper, validateQuestion } from '../ai/questionValidator.service.js';
import { buildAnswerKey } from '../ai/answerGenerator.service.js';
import { enqueue } from '../operations/outbox.service.js';
import { measured } from '../operations/metrics.service.js';
export async function releaseSlot(jobId, session) {
  const job = await GenerationJob.findOneAndUpdate({ _id: jobId, slotReleased: false }, { $set: { slotReleased: true } }, { session, new: true });
  if (job) await User.updateOne({ _id: job.userId, activeGenerations: { $gt: 0 } }, { $inc: { activeGenerations: -1 } }, { session });
}
export async function processGeneration(generationJobId, signal) {
  return measured('generation', async () => {
    const job = await GenerationJob.findById(generationJobId);
    if (!job || ['completed', 'cancelled', 'failed'].includes(job.status)) return;
    const { book, chapters } = await requireReady(job.textbookId, job.chapterIds, job.userId);
    await GenerationJob.updateOne({ _id: job.id }, { $set: { status: 'processing', startedAt: new Date(), progress: 5, questionsGenerated: 0 }, $unset: { error: 1 } });
    const slots = buildSlots(job.pattern, job.difficulty, job.difficultyDistribution), questions = [], contexts = [];
    for (const slot of slots) {
      signal?.throwIfAborted();
      const chapter = chapters[(slot.questionNumber - 1) % chapters.length];
      const context = buildContext(await retrieve({ textbookId: book.id, chapter, userId: job.userId, type: slot.type, difficulty: slot.difficulty, section: job.pattern.sections[slot.sectionIndex], excludedChunks: questions.flatMap(q => q.source.chunkIds), signal }));
      questions.push(await generateQuestion({ book, chapter, slot, context, previous: questions, section: job.pattern.sections[slot.sectionIndex].toObject(), paperTitle: job.title, signal })); contexts.push(context);
      await GenerationJob.updateOne({ _id: job.id }, { $set: { questionsGenerated: questions.length, progress: Math.round(5 + 80 * questions.length / slots.length) } });
    }
    await GenerationJob.updateOne({ _id: job.id }, { $set: { status: 'validating', progress: 90 } });
    const balanced = balanceMcqAnswers(questions);
    balanced.forEach((q, i) => validateQuestion(q, slots[i], contexts[i], balanced.slice(0, i)));
    validatePaper(balanced, slots, job.pattern);
    await requireReady(job.textbookId, job.chapterIds, job.userId); signal?.throwIfAborted();
    const paperId = new mongoose.Types.ObjectId();
    await transaction(async session => {
      const latest = await GenerationJob.findById(job.id).session(session);
      if (['completed', 'cancelled', 'failed'].includes(latest.status)) return;
      await QuestionPaper.create([{ _id: paperId, userId: job.userId, textbookId: job.textbookId, chapterIds: job.chapterIds, patternId: job.patternId, generationJobId: job.id, title: job.title, subject: book.subject, classLevel: book.classLevel, board: book.board, medium: book.medium, difficulty: job.difficulty, durationMinutes: job.durationMinutes, totalMarks: job.totalMarks, sections: job.pattern.sections, questions: balanced, answerKey: buildAnswerKey(balanced), status: 'ready' }], { session });
      await Question.insertMany(balanced.map(q => ({ ...q, userId: job.userId, questionPaperId: paperId })), { session });
      await enqueue('pdf-generation', 'PDF', `pdf-${paperId}`, { questionPaperId: String(paperId), userId: String(job.userId) }, session);
      await GenerationJob.updateOne({ _id: job.id }, { $set: { questionPaperId: paperId, status: 'completed', progress: 100, completedAt: new Date() } }, { session });
      await releaseSlot(job.id, session);
    });
  });
}
