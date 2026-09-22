import { model, ref, requiredText } from './shared.js';
export default model('StorageObject', { userId: ref('User', true), key: requiredText, resourceId: { type: String, required: true }, kind: String, committed: { type: Boolean, default: false } }, [[{ key: 1 }, { unique: true }], [{ committed: 1, createdAt: 1 }, {}]]);
