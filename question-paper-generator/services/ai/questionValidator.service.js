import { QUESTION_TYPES } from '../../utils/constants.js';
import ApiError from '../../utils/ApiError.js';
import { generateStructuredOutput } from './llm.service.js';
import { SOURCE_POLICY, sourceBoundary } from '../security/promptInjection.service.js';
import { SAFETY_POLICY, basicSafety } from '../security/contentSafety.service.js';
const normalized = s => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function nearDuplicate(a, b) {
  const aa = normalized(a), bb = normalized(b); if (aa === bb) return true;
  const as = new Set(aa.split(' ')), bs = new Set(bb.split(' '));
  const common = [...as].filter(w => bs.has(w)).length; return common / new Set([...as, ...bs]).size >= 0.8;
}
export function validateQuestion(q, slot, context, previous = []) {
  const errors = [];
  for (const key of ['question', 'correctAnswer', 'explanation', 'concept', 'evidence']) if (typeof q[key] !== 'string' || !q[key].trim() || q[key].length > (key === 'explanation' ? 8000 : 6000)) errors.push(`Invalid ${key}`);
  if (!QUESTION_TYPES.includes(q.type) || ['questionNumber', 'sectionIndex', 'type', 'marks', 'difficulty'].some(k => q[k] !== slot[k])) errors.push('Question does not match its requested slot');
  if (!basicSafety(JSON.stringify(q))) errors.push('Unsafe output');
  if (!Array.isArray(q.options)) errors.push('Invalid options');
  else if (['mcq', 'assertion_reason', 'true_false'].includes(q.type)) {
    if (q.options.length !== (q.type === 'true_false' ? 2 : 4) || q.options.some(o => typeof o !== 'string' || !o.trim() || o.length > 1000) || new Set(q.options.map(o => normalized(String(o)))).size !== q.options.length || q.options.filter(o => o === q.correctAnswer).length !== 1) errors.push('Options must be distinct with exactly one matching answer');
    if (q.type === 'true_false' && !['True', 'False'].every(v => q.options.includes(v))) errors.push('Invalid true/false options');
  } else if (q.options.length) errors.push('This type must not have options');
  if (q.type === 'mcq' && /\b(?:option|answer)\s+[A-D]\b/i.test(q.explanation ?? '')) errors.push('Explain using answer text rather than option letters');
  if (q.type === 'fill_blank' && (q.question?.match(/____/g) ?? []).length !== 1) errors.push('Exactly one blank is required');
  if (previous.some(p => nearDuplicate(p.question, q.question ?? ''))) errors.push('Duplicate or near-duplicate question');
  const refs = q.source?.chunkIds;
  if (!Array.isArray(refs) || !refs.length || new Set(refs).size !== refs.length) errors.push('Source references are required');
  else {
    const cited = refs.map(id => context.find(c => c.chunkId === id));
    if (cited.some(c => !c || c.chapterId !== q.source.chapterId) || !cited.some(c => c?.page === q.source.page)) errors.push('Invalid source references');
    if (typeof q.evidence !== 'string' || q.evidence.length < 12 || q.evidence.length > 500 || !cited.some(c => c?.text.includes(q.evidence))) errors.push('Evidence must quote a short excerpt from a cited chunk');
  }
  if (errors.length) throw new ApiError(422, errors.join('; '), 'QUESTION_VALIDATION_FAILED');
  return q;
}
const verdictSchema = { type: 'object', additionalProperties: false, properties: { supported: { type: 'boolean' }, correct: { type: 'boolean' }, uniqueAnswer: { type: 'boolean' }, difficultyAppropriate: { type: 'boolean' }, duplicate: { type: 'boolean' }, safe: { type: 'boolean' }, reason: { type: 'string' } }, required: ['supported', 'correct', 'uniqueAnswer', 'difficultyAppropriate', 'duplicate', 'safe', 'reason'] };
export async function validateGrounding(q, context, previous, signal) {
  const verdict = await generateStructuredOutput({ systemPrompt: `${SOURCE_POLICY}\n${SAFETY_POLICY}\nIndependently solve and audit the supplied question against the cited source. Check factual support, answer and explanation correctness, uniqueness of answer, type structure, age-appropriate difficulty and safety. Reject semantic duplicates, including changed numbers or minor rewording of previous questions. Check assertion-reason causality, case subpart answers and matching bijections. A verbatim evidence excerpt alone does not prove support. Basic mathematical/logical derivation is permitted. Return JSON.`, userPrompt: `${sourceBoundary('USER_REQUIREMENTS', { question: q, previousQuestions: previous.map(p => p.question) })}\n${sourceBoundary('BOOK_CONTENT', context.filter(c => q.source.chunkIds.includes(c.chunkId)))}`, schema: verdictSchema, signal });
  if (!verdict.supported || !verdict.correct || !verdict.uniqueAnswer || !verdict.difficultyAppropriate || verdict.duplicate || !verdict.safe) throw new ApiError(422, 'Independent content validation failed', 'QUESTION_VALIDATION_FAILED');
}
export function validatePaper(questions, slots, pattern) {
  if (questions.length !== slots.length || pattern.sections.reduce((n, s) => n + (s.count - (s.choiceCount || 0)) * s.marksEach, 0) !== pattern.totalMarks) throw new ApiError(422, 'Paper counts or marks are invalid', 'QUESTION_VALIDATION_FAILED');
  questions.forEach((q, i) => {
    if (['questionNumber', 'sectionIndex', 'type', 'marks', 'difficulty'].some(k => q[k] !== slots[i][k]) || questions.slice(0, i).some(p => nearDuplicate(p.question, q.question))) throw new ApiError(422, 'Paper pattern, difficulty or diversity is invalid', 'QUESTION_VALIDATION_FAILED');
  }); return true;
}
