import { model, owner, ref, mixed, requiredText } from './shared.js';
import { SOURCES, CONTENT_STATUSES } from '../utils/constants.js';
export default model('Textbook', {
  userId: owner, source: { type: String, enum: SOURCES, required: true }, externalId: requiredText, title: requiredText, description: String,
  board: requiredText, classLevel: requiredText, medium: requiredText, subject: requiredText, publisher: String, author: String, keywords: [String],
  coverImageUrl: String, officialUrl: String, qrCode: String, dialCode: String, doId: String, sourceMetadata: { type: mixed, select: false },
  copyright: String, contentAccessMethod: { type: String, enum: ['metadata_only', 'official_link', 'authorized_content', 'user_uploaded', 'licensed_content'], default: 'metadata_only' },
  contentStatus: { type: String, enum: CONTENT_STATUSES, default: 'metadata_only' }, contentLocation: { type: String, select: false }, chapters: [ref('Chapter')],
  permissions: { metadata_available: { type: Boolean, default: true }, content_available: { type: Boolean, default: false }, content_download_allowed: { type: Boolean, default: false }, content_processing_allowed: { type: Boolean, default: false }, commercial_use_allowed: { type: Boolean, default: false }, authorizationReference: { type: String, select: false } },
  license: { name: String, url: String, commercialUseAllowed: { type: Boolean, default: false }, redistributionAllowed: { type: Boolean, default: false } },
  isActive: { type: Boolean, default: true }, processingError: String,
}, [[{ source: 1, externalId: 1 }, { unique: true }], [{ board: 1, classLevel: 1, medium: 1, subject: 1 }, {}], [{ title: 1 }, {}], [{ externalId: 1 }, {}], [{ qrCode: 1 }, {}], [{ dialCode: 1 }, {}], [{ doId: 1 }, {}], [{ title: 'text', subject: 'text', board: 'text', classLevel: 'text', publisher: 'text', author: 'text', keywords: 'text', externalId: 'text' }, { default_language: 'none' }]]);
