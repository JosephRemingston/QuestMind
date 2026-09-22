import { model, requiredText, mixed } from './shared.js';
export default model('TextbookSource', { source: requiredText, enabled: { type: Boolean, default: false }, authorizationReference: String, lastSyncedAt: Date, metadata: mixed }, [[{ source: 1 }, { unique: true }]]);
