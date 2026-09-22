import { model, requiredText, mixed } from './shared.js';
import { ROLES } from '../utils/constants.js';
export default model('User', { phoneNumber: requiredText, role: { type: String, enum: ROLES, default: 'student' }, name: { type: String, maxlength: 100 }, board: String, classLevel: String, medium: String, preferences: { type: mixed, default: {} }, isActive: { type: Boolean, default: true }, lastLoginAt: Date, activeGenerations: { type: Number, default: 0 } }, [[{ phoneNumber: 1 }, { unique: true }]]);
