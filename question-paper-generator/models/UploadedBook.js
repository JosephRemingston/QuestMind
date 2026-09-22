import { model, ref, requiredText } from './shared.js';
export default model('UploadedBook', { userId: ref('User', true), textbookId: ref('Textbook', true), s3Key: requiredText, originalFilename: String, mimeType: String, size: Number, rightsConfirmedAt: Date }, [[{ textbookId: 1 }, { unique: true }]]);
