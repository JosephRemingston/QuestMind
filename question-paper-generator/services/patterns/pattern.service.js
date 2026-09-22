import QuestionPattern from '../../models/QuestionPattern.js';
import { listPage } from '../../utils/pagination.js';
import { parsePattern } from './patternParser.service.js';
import ApiError from '../../utils/ApiError.js';
export const listPatterns = (userId, query) => listPage(QuestionPattern, { isActive: true, $or: [{ userId }, { userId: null, builtIn: true }] }, query);
export async function getPattern(id, userId) { const p = await QuestionPattern.findOne({ _id: id, isActive: true, $or: [{ userId }, { userId: null, builtIn: true }] }); if (!p) throw new ApiError(404, 'Pattern not found', 'RESOURCE_NOT_FOUND'); return p; }
export const createPattern = (userId, input) => QuestionPattern.create({ ...parsePattern(input), userId });
export async function updatePattern(id, userId, input) { const p = await QuestionPattern.findOneAndUpdate({ _id: id, userId, builtIn: false, isActive: true }, { $set: parsePattern(input) }, { new: true, runValidators: true }); if (!p) throw new ApiError(404, 'Pattern not found', 'RESOURCE_NOT_FOUND'); return p; }
export async function deletePattern(id, userId) { const p = await QuestionPattern.findOneAndUpdate({ _id: id, userId, builtIn: false }, { $set: { isActive: false } }); if (!p) throw new ApiError(404, 'Pattern not found', 'RESOURCE_NOT_FOUND'); }
export const builtIns = [
  ['Practice Test', 5, 3, 0], ['Unit Test', 10, 5, 2], ['Class Test', 5, 5, 1], ['Mid Term', 15, 10, 5], ['Final Exam', 20, 10, 8], ['Revision Paper', 10, 5, 4], ['Board Exam Style', 20, 10, 8], ['Custom', 5, 0, 0],
].map(([name, mcq, short, long]) => parsePattern({ name, sections: [{ type: 'mcq', count: mcq, marksEach: 1 }, ...(short ? [{ type: 'short_answer', count: short, marksEach: 2 }] : []), ...(long ? [{ type: 'long_answer', count: long, marksEach: 5 }] : [])] }));
