import Chapter from '../../models/Chapter.js';
import { getBook, publicChapter } from './textbook.service.js';
import ApiError from '../../utils/ApiError.js';
export async function getChapter(id, userId) {
  const chapter = await Chapter.findOne({ _id: id, isActive: true });
  if (!chapter) throw new ApiError(404, 'Chapter not found', 'CHAPTER_NOT_FOUND');
  const book = await getBook(chapter.textbookId, userId); return publicChapter(chapter, book);
}
export async function listChapters(bookId, userId) { const book = await getBook(bookId, userId); return (await Chapter.find({ textbookId: bookId, isActive: true }).sort('order')).map(c => publicChapter(c, book)); }

export async function pageChapters(bookId, userId, query) {
  const book = await getBook(bookId, userId); const { page, limit, sort } = query; const filter = { textbookId: bookId, isActive: true };
  const [chapters, total] = await Promise.all([Chapter.find(filter).sort(sort.includes('title') ? sort : 'order').skip((page - 1) * limit).limit(limit), Chapter.countDocuments(filter)]);
  return { chapters: chapters.map(c => publicChapter(c, book)), pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
}
