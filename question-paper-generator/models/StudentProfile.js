import { model, ref, requiredText } from './shared.js';
// A parent-owned study profile, never an authorization link to another login.
export default model('StudentProfile', { userId: ref('User', true), name: requiredText, board: requiredText, classLevel: requiredText, medium: requiredText, isActive: { type: Boolean, default: true } }, [[{ userId: 1, createdAt: -1 }, {}]]);
