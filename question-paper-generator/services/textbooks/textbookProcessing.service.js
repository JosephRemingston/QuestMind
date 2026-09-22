import mongoose from 'mongoose';
import Textbook from '../../models/Textbook.js';
import Chapter from '../../models/Chapter.js';
import BookChunk from '../../models/BookChunk.js';
import { getObject } from '../storage/s3.service.js';
import { extractDocument } from './extraction.service.js';
import { detectChapters } from './chapterDetection.service.js';
import { chunkPages } from '../retrieval/chunk.service.js';
import { embedTexts, embeddingIdentity } from '../ai/embedding.service.js';
import { transaction } from '../../configs/database.js';
import { env } from '../../configs/env.js';
import ApiError from '../../utils/ApiError.js';
import { measured } from '../operations/metrics.service.js';
export async function processTextbook(textbookId, signal) {
  return measured('textbook_processing', async () => {
    const book = await Textbook.findById(textbookId).select('+contentLocation');
    if (!book || book.contentStatus === 'ready') return;
    if (!book.isActive || !book.permissions.content_processing_allowed || !book.permissions.content_download_allowed || (env.COMMERCIAL_MODE && !book.permissions.commercial_use_allowed) || !book.contentLocation) throw new ApiError(409, 'Content processing is not authorized', 'BOOK_CONTENT_NOT_READY');
    await Textbook.updateOne({ _id: textbookId }, { $set: { contentStatus: 'processing' }, $unset: { processingError: 1 } });
    const buffer = await getObject(book.contentLocation, undefined, signal);
    const document = await extractDocument(buffer, book.contentLocation.endsWith('.epub') ? 'epub' : 'pdf', signal);
    const detected = await detectChapters(document, book.title, signal);
    const chapters = [], chunks = [];
    for (const item of detected) {
      const chapterId = new mongoose.Types.ObjectId(), pages = document.pages.filter(p => p.pageNumber >= item.startPage && p.pageNumber <= item.endPage);
      const parts = chunkPages(pages); if (!parts.length) continue;
      chapters.push({ _id: chapterId, userId: book.userId, textbookId, externalId: `detected-${item.startPage}`, title: item.title, chapterNumber: item.chapterNumber, order: item.order, contentStatus: 'ready', pageRange: { start: item.startPage, end: item.endPage }, sourceMetadata: { detectionStrategy: item.strategy, pageUnit: book.contentLocation.endsWith('.epub') ? 'spine_item' : 'pdf_page' } });
      for (const part of parts) chunks.push({ ...part, _id: new mongoose.Types.ObjectId(), userId: book.userId, textbookId, chapterId, sectionTitle: item.title, metadata: { board: book.board, classLevel: book.classLevel, medium: book.medium, subject: book.subject, textbookTitle: book.title, chapterTitle: item.title, pageNumber: part.pageNumber }, embeddingModel: embeddingIdentity() });
    }
    if (!chunks.length || chunks.length > env.MAX_CHUNKS_PER_BOOK) throw new ApiError(422, 'Textbook chunk count is outside processing limits', 'TEXT_EXTRACTION_FAILED');
    const vectors = await embedTexts(chunks.map(c => c.text), signal); chunks.forEach((c, i) => { c.embedding = vectors[i]; });
    signal?.throwIfAborted();
    await transaction(async session => {
      const latest = await Textbook.findById(textbookId).session(session);
      if (latest.contentStatus === 'ready') return;
      if (!latest.isActive || !latest.permissions.content_processing_allowed || (env.COMMERCIAL_MODE && !latest.permissions.commercial_use_allowed)) throw new ApiError(409, 'Content authorization changed', 'BOOK_CONTENT_NOT_READY');
      await Chapter.deleteMany({ textbookId }, { session }); await BookChunk.deleteMany({ textbookId }, { session });
      await Chapter.insertMany(chapters, { session });
      for (let i = 0; i < chunks.length; i += 50) await BookChunk.insertMany(chunks.slice(i, i + 50), { session });
      await Textbook.updateOne({ _id: textbookId }, { $set: { chapters: chapters.map(c => c._id), contentStatus: 'ready' } }, { session });
    });
  });
}
