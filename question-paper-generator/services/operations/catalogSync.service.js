import { sources } from '../bookSources/registry.js';
import Textbook from '../../models/Textbook.js';
import Chapter from '../../models/Chapter.js';
import TextbookSource from '../../models/TextbookSource.js';
import { transaction } from '../../configs/database.js';
import { catalogBody, chapterBody } from '../../utils/validators.js';
import ApiError from '../../utils/ApiError.js';
export async function syncSource(name) {
  const provider = sources().find(p => p.name === name);
  if (!provider) throw new ApiError(409, 'Source integration is not enabled', 'PROVIDER_UNAVAILABLE');
  const records = await provider.searchBooks({});
  for (const entry of records) {
    const { chapters = [], contentAvailable, chaptersAvailable, ...metadata } = entry;
    // Metadata sync never imports permissions or content state from a remote source.
    const { permissions, contentStatus, ...safe } = catalogBody.parse({ ...metadata, source: name });
    await transaction(async session => {
      const book = await Textbook.findOneAndUpdate({ source: name, externalId: safe.externalId, userId: null }, { $set: safe, $setOnInsert: { contentStatus: 'metadata_only' } }, { upsert: true, new: true, session });
      if (book.contentStatus !== 'ready') for (const raw of chapters) {
        const fields = chapterBody.parse(raw);
        const chapter = await Chapter.findOneAndUpdate({ textbookId: book._id, externalId: fields.externalId }, { $set: { ...fields, contentStatus: 'metadata_only', userId: null } }, { upsert: true, new: true, session });
        await Textbook.updateOne({ _id: book._id }, { $addToSet: { chapters: chapter._id } }, { session });
      }
    });
  }
  await TextbookSource.updateOne({ source: name }, { $set: { enabled: true, lastSyncedAt: new Date() } }, { upsert: true });
}
export async function syncBookChapters(textbookId) {
  const book = await Textbook.findOne({ _id: textbookId, userId: null });
  if (!book) throw new ApiError(404, 'Textbook not found', 'TEXTBOOK_NOT_FOUND');
  const provider = sources().find(p => p.name === book.source);
  if (!provider) throw new ApiError(409, 'Source integration is unavailable', 'PROVIDER_UNAVAILABLE');
  const chapters = await provider.getChapters(book.externalId);
  if (book.contentStatus === 'ready') return;
  await transaction(async session => {
    for (const raw of chapters) {
      const fields = chapterBody.parse(raw);
      const c = await Chapter.findOneAndUpdate({ textbookId, externalId: fields.externalId }, { $set: { ...fields, contentStatus: 'metadata_only', userId: null } }, { new: true, upsert: true, session });
      await Textbook.updateOne({ _id: textbookId }, { $addToSet: { chapters: c._id } }, { session });
    }
  });
}
