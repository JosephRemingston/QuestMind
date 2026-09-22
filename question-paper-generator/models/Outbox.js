import { model, requiredText, mixed } from './shared.js';
export default model('Outbox', { queue: requiredText, name: requiredText, jobId: requiredText, data: mixed, dispatchedAt: Date, lastErrorAt: Date }, [[{ queue: 1, jobId: 1 }, { unique: true }], [{ dispatchedAt: 1 }, {}]]);
