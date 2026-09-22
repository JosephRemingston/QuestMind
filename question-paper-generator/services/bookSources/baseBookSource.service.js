import ApiError from '../../utils/ApiError.js';
export default class BaseBookSource {
  async searchBooks() { throw new Error('Not implemented'); }
  async getBook() { throw new Error('Not implemented'); }
  async getChapters() { throw new Error('Not implemented'); }
  async resolveCode() { throw new Error('Not implemented'); }
  async getContent() { throw new ApiError(409, 'Authorized content is not available', 'BOOK_CONTENT_NOT_READY'); }
  async resolveQrCode(code) { return this.resolveCode(code); }
  async getChapterContent(bookId, chapterId) { return this.getContent(bookId, chapterId); }
}
