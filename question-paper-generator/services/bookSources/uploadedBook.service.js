import BaseBookSource from './baseBookSource.service.js';
import { getBook, publicBook, requireReady } from '../textbooks/textbook.service.js';
import { listChapters } from '../textbooks/chapter.service.js';
import Textbook from '../../models/Textbook.js';
import Chapter from '../../models/Chapter.js';
import BookChunk from '../../models/BookChunk.js';
import ApiError from '../../utils/ApiError.js';
export default class UploadedBookSource extends BaseBookSource {
  constructor(userId) { super(); if (!userId) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED'); this.userId = userId; this.name = 'uploaded'; }
  async searchBooks() { return (await Textbook.find({ userId: this.userId, source: 'uploaded', isActive: true }).limit(100)).map(publicBook); }
  async getBook(id) { const b = await getBook(id, this.userId); if (String(b.userId) !== String(this.userId)) throw new ApiError(404, 'Textbook not found', 'TEXTBOOK_NOT_FOUND'); return publicBook(b); }
  async getChapters(id) { await this.getBook(id); return listChapters(id, this.userId); }
  async resolveCode() { return null; }
  async getContent(bookId, chapterId) {
    await this.getBook(bookId);
    await requireReady(bookId, [chapterId], this.userId);
    const chapter = await Chapter.findOne({ _id: chapterId, textbookId: bookId, contentStatus: 'ready' });
    if (!chapter) throw new ApiError(409, 'Chapter content unavailable', 'BOOK_CONTENT_NOT_READY');
    return BookChunk.find({ textbookId: bookId, chapterId, userId: this.userId }).select('text pageNumber').sort('chunkIndex').lean();
  }
}
