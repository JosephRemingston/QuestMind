import QuestionPaper from '../../models/QuestionPaper.js';
import StorageObject from '../../models/StorageObject.js';
import { putObject } from '../storage/s3.service.js';
import { renderPaper } from './pdf.service.js';
import { measured } from '../operations/metrics.service.js';
import { transaction } from '../../configs/database.js';
export async function processPdf(questionPaperId, signal) {
  return measured('pdf', async () => {
    const paper = await QuestionPaper.findById(questionPaperId);
    if (!paper || paper.pdfStatus === 'ready' || paper.status === 'archived') return;
    await QuestionPaper.updateOne({ _id: paper.id }, { $set: { pdfStatus: 'processing' } });
    const pdfKey = `question-papers/${paper.userId}/${paper.id}/question-paper.pdf`, answerPdfKey = `question-papers/${paper.userId}/${paper.id}/answer-key.pdf`;
    for (const [key, answer] of [[pdfKey, false], [answerPdfKey, true]]) {
      signal?.throwIfAborted();
      await StorageObject.updateOne({ key }, { $setOnInsert: { userId: paper.userId, resourceId: paper.id, kind: 'paper' } }, { upsert: true });
      await putObject(key, await renderPaper(paper, answer), 'application/pdf', signal);
    }
    signal?.throwIfAborted();
    await transaction(async session => {
      await QuestionPaper.updateOne({ _id: paper.id }, { $set: { pdfKey, answerPdfKey, pdfStatus: 'ready' } }, { session });
      await StorageObject.updateMany({ key: { $in: [pdfKey, answerPdfKey] } }, { $set: { committed: true } }, { session });
    });
  });
}
