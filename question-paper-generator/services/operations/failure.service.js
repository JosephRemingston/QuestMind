import GenerationJob from '../../models/GenerationJob.js';
import Textbook from '../../models/Textbook.js';
import SamplePaper from '../../models/SamplePaper.js';
import QuestionPaper from '../../models/QuestionPaper.js';
import { transaction } from '../../configs/database.js';
import { releaseSlot } from '../papers/generation.service.js';
export async function recordFinalFailure(job) {
  if (!job) return;
  if (job.attemptsMade < (job.opts.attempts ?? 1) && (!job.getState || await job.getState() !== 'failed')) return;
  if (job.data.generationJobId) await transaction(async session => {
    const result = await GenerationJob.updateOne({ _id: job.data.generationJobId, status: { $nin: ['completed', 'cancelled'] } }, { $set: { status: 'failed', completedAt: new Date(), error: { errorCode: 'GENERATION_FAILED', message: 'Generation failed after retries. Try again with fewer questions or different chapters.' } } }, { session });
    if (result.matchedCount) await releaseSlot(job.data.generationJobId, session);
  });
  if (job.data.textbookId && ['PROCESS_TEXTBOOK', 'EXTRACT_CHAPTERS', 'CREATE_CHUNKS', 'CREATE_EMBEDDINGS'].includes(job.name)) await Textbook.updateOne({ _id: job.data.textbookId, contentStatus: { $ne: 'ready' } }, { $set: { contentStatus: 'failed', processingError: 'Processing failed. Use a text-based, unencrypted document within the processing limits.' } });
  if (job.data.samplePaperId) await SamplePaper.updateOne({ _id: job.data.samplePaperId, processingStatus: { $ne: 'ready' } }, { $set: { processingStatus: 'failed', processingError: 'Pattern analysis failed. Try a simpler sample or create a custom pattern.' } });
  if (job.data.questionPaperId) await QuestionPaper.updateOne({ _id: job.data.questionPaperId, pdfStatus: { $ne: 'ready' } }, { $set: { pdfStatus: 'failed' } });
}
