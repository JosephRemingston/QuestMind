import mongoose from 'mongoose';
import Textbook from '../../models/Textbook.js';
import Chapter from '../../models/Chapter.js';
import ApiError from '../../utils/ApiError.js';
import { transaction } from '../../configs/database.js';
import { env } from '../../configs/env.js';
export const visibleTo = userId => ({ isActive: true, $or: [{ userId: null }, { userId }] });
export const canGenerate = book => book.contentStatus === 'ready' && book.permissions?.content_processing_allowed === true && (!env.COMMERCIAL_MODE || book.permissions?.commercial_use_allowed === true);
export const publicBook = book => {
  const value = book.toObject ? book.toObject() : book;
  const { sourceMetadata, contentLocation, permissions, processingError, __v, ...safe } = value;
  return { ...safe, id: String(value._id), contentAvailable: canGenerate(value), chaptersAvailable: value.chapters?.length > 0 };
};
export const publicChapter = (chapter, book) => {
  const { sourceMetadata, contentLocation, __v, ...value } = chapter.toObject ? chapter.toObject() : chapter;
  return { ...value, id: String(value._id), contentAvailable: chapter.contentStatus === 'ready' && canGenerate(book) };
};
export async function getBook(bookId, userId, internal = false) {
  const query = Textbook.findOne({ _id: bookId, ...visibleTo(userId) });
  if (internal) query.select('+contentLocation +permissions.authorizationReference');
  const book = await query;
  if (!book) throw new ApiError(404, 'Textbook not found', 'TEXTBOOK_NOT_FOUND');
  return book;
}
export async function details(bookId, userId) {
  const book = await getBook(bookId, userId);
  const chapters = await Chapter.find({ textbookId: bookId, isActive: true }).sort('order');
  return { ...publicBook(book), chapters: chapters.map(c => publicChapter(c, book)) };
}
export async function requireReady(bookId, chapterIds, userId) {
  const book = await getBook(bookId, userId, true);
  const chapters = await Chapter.find({ _id: { $in: chapterIds }, textbookId: bookId, isActive: true }).sort('order');
  if (chapters.length !== chapterIds.length) throw new ApiError(404, 'One or more chapters were not found in this textbook', 'CHAPTER_NOT_FOUND');
  if (!canGenerate(book) || chapters.some(c => c.contentStatus !== 'ready')) throw new ApiError(409, 'This textbook is available for discovery, but its content is not available for generation yet.', 'BOOK_CONTENT_NOT_READY');
  return { book, chapters };
}
function validatePermissions(fields) {
  if (fields.permissions?.content_processing_allowed && !fields.permissions.authorizationReference) throw new ApiError(400, 'Record an authorization reference before permitting content processing');
  if (fields.permissions?.commercial_use_allowed && !fields.permissions?.content_processing_allowed) throw new ApiError(400, 'Commercial use requires processing authorization');
}
export async function createCatalogBook(fields) { validatePermissions(fields); return publicBook(await Textbook.create({ ...fields, userId: null })); }
export async function editCatalogBook(id, fields) {
  const book = await Textbook.findOne({ _id: id, userId: null }).select('+permissions.authorizationReference');
  if (!book) throw new ApiError(404, 'Textbook not found', 'TEXTBOOK_NOT_FOUND');
  validatePermissions({ ...book.toObject(), ...fields }); book.set(fields); await book.save(); return publicBook(book);
}
export async function disableCatalogBook(id) { const book = await Textbook.findOneAndUpdate({ _id: id, userId: null }, { $set: { isActive: false } }); if (!book) throw new ApiError(404, 'Textbook not found', 'TEXTBOOK_NOT_FOUND'); }
export async function addChapter(bookId, fields) {
  const chapterId = new mongoose.Types.ObjectId();
  await transaction(async session => {
    const book = await Textbook.findOne({ _id: bookId, userId: null }).session(session);
    if (!book) throw new ApiError(404, 'Textbook not found', 'TEXTBOOK_NOT_FOUND');
    if (fields.parentChapterId && !await Chapter.exists({ _id: fields.parentChapterId, textbookId: bookId }).session(session)) throw new ApiError(400, 'Parent chapter must belong to this textbook');
    await Chapter.create([{ ...fields, _id: chapterId, textbookId: bookId, userId: null }], { session });
    await Textbook.updateOne({ _id: bookId }, { $addToSet: { chapters: chapterId } }, { session });
  });
  return Chapter.findById(chapterId);
}
export async function editChapter(id, fields) {
  const chapter = await Chapter.findOne({ _id: id, userId: null });
  if (!chapter) throw new ApiError(404, 'Chapter not found', 'CHAPTER_NOT_FOUND');
  if (fields.parentChapterId && (fields.parentChapterId === id || !await Chapter.exists({ _id: fields.parentChapterId, textbookId: chapter.textbookId }))) throw new ApiError(400, 'Invalid parent chapter');
  chapter.set(fields); await chapter.save(); return chapter;
}
