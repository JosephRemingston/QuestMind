import mongoose from 'mongoose';
import { basename } from 'node:path';
import Textbook from '../../models/Textbook.js';
import UploadedBook from '../../models/UploadedBook.js';
import StorageObject from '../../models/StorageObject.js';
import { validateFile } from '../storage/file.service.js';
import { putObject } from '../storage/s3.service.js';
import { transaction } from '../../configs/database.js';
import { enqueue } from '../operations/outbox.service.js';
import { publicBook } from './textbook.service.js';
export async function uploadTextbook(userId, fields, file) {
  const validated = await validateFile(file), bookId = new mongoose.Types.ObjectId();
  const key = `textbooks/${userId}/${bookId}/original.${validated.ext}`;
  await StorageObject.create({ userId, key, resourceId: String(bookId), kind: 'textbook' });
  await putObject(key, validated.buffer, validated.mimeType);
  await transaction(async session => {
    const { rightsConfirmed, ...metadata } = fields;
    await Textbook.create([{ ...metadata, _id: bookId, userId, source: 'uploaded', externalId: String(bookId), contentAccessMethod: 'user_uploaded', contentLocation: key, contentStatus: 'processing', permissions: { metadata_available: true, content_available: true, content_download_allowed: true, content_processing_allowed: true, commercial_use_allowed: true, authorizationReference: `User ${userId} attested processing rights at ${new Date().toISOString()}` } }], { session });
    await UploadedBook.create([{ userId, textbookId: bookId, s3Key: key, originalFilename: basename(file.originalname).slice(0, 255), mimeType: validated.mimeType, size: file.size, rightsConfirmedAt: new Date() }], { session });
    await StorageObject.updateOne({ key }, { $set: { committed: true } }, { session });
    await enqueue('textbook-processing', 'PROCESS_TEXTBOOK', `book-${bookId}`, { textbookId: String(bookId), userId }, session);
  });
  return { textbook: publicBook(await Textbook.findById(bookId)), jobId: `book-${bookId}`, status: 'queued' };
}
export async function uploadCatalogContent(userId, bookId, file) {
  const book = await Textbook.findOne({ _id: bookId, userId: null });
  const { env } = await import('../../configs/env.js');
  const { default: ApiError } = await import('../../utils/ApiError.js');
  if (!book) throw new ApiError(404, 'Textbook not found', 'TEXTBOOK_NOT_FOUND');
  if (!book.permissions.content_processing_allowed || !book.permissions.content_download_allowed || (env.COMMERCIAL_MODE && !book.permissions.commercial_use_allowed)) throw new ApiError(409, 'Record the required content permissions before ingestion', 'BOOK_CONTENT_NOT_READY');
  if (['ready', 'processing'].includes(book.contentStatus)) throw new ApiError(409, 'Create a new catalog edition to replace published content', 'CONFLICT');
  const validated = await validateFile(file), key = `textbooks/${userId}/${bookId}/${new mongoose.Types.ObjectId()}.${validated.ext}`;
  await StorageObject.create({ userId, key, resourceId: String(bookId), kind: 'textbook' });
  await putObject(key, validated.buffer, validated.mimeType);
  await transaction(async session => {
    const updated = await Textbook.updateOne({ _id: bookId, contentStatus: { $nin: ['ready', 'processing'] } }, { $set: { contentLocation: key, contentAccessMethod: book.source === 'licensed' ? 'licensed_content' : 'authorized_content', contentStatus: 'processing', 'permissions.content_available': true } }, { session });
    if (!updated.modifiedCount) throw new ApiError(409, 'Content ingestion already started', 'CONFLICT');
    await StorageObject.updateOne({ key }, { $set: { committed: true } }, { session });
    await enqueue('textbook-processing', 'PROCESS_TEXTBOOK', `book-${bookId}-${key.split('/').at(-1).split('.')[0]}`, { textbookId: bookId, userId }, session);
  });
  return { textbookId: bookId, status: 'queued' };
}
