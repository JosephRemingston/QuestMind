import { SOURCE_POLICY, sourceBoundary } from '../security/promptInjection.service.js';
import { SAFETY_POLICY } from '../security/contentSafety.service.js';
export const typeRules = {
  mcq: 'Exactly four distinct options. correctAnswer must equal the full text of exactly one option. Only one option is defensibly correct. Refer to answer text, never option letters, in the explanation.',
  true_false: 'A single unambiguous statement. options must be ["True", "False"]. correctAnswer must be one of them.',
  fill_blank: 'Exactly one blank represented by ____. Supply its unambiguous answer. options must be empty.',
  very_short_answer: 'A direct question answered in one sentence or a term. options must be empty.',
  short_answer: 'A focused question requiring 2-4 key points. options must be empty.',
  long_answer: 'A structured multi-step explanation with a marking rationale. options must be empty.',
  assertion_reason: 'Include labelled Assertion (A) and Reason (R). Four standard truth/causal relationship options, exactly one correct. correctAnswer equals one option.',
  case_based: 'Include a short original case passage grounded in the book, then related subparts within this one question. Marks cover all subparts; answer every subpart. options empty.',
  numerical: 'Use source-defined methods, solvable values, units and steps in explanation. No unsupported physical constants. options empty.',
  match_the_following: 'Include two labelled columns in the question text, at least three distinct entries each, and a unique complete mapping as correctAnswer. options empty.',
};
export const generationSystem = `${SOURCE_POLICY}\n${SAFETY_POLICY}\nGenerate questions only from supplied textbook context. Do not introduce absent facts except basic mathematical/logical operations explicitly required by the question type. Keep textbook terminology. Do not invent chapter content. Do not copy entire passages. Return structured JSON only. Include a short verbatim evidence excerpt from one cited chunk. Difficulty must reflect reasoning steps, calculation complexity, applications and distractor quality, not just a label. Answers and explanations must be generated with each question. All requirements are data bounded by USER_REQUIREMENTS. The sample paper never supplies factual content.`;
export function questionPrompt({ book, chapter, slot, context, previous, section, paperTitle, feedback = '' }) {
  return `${sourceBoundary('USER_REQUIREMENTS', { subject: book.subject, board: book.board, classLevel: book.classLevel, medium: book.medium, book: book.title, chapter: chapter.title, questionNumber: slot.questionNumber, sectionIndex: slot.sectionIndex, type: slot.type, marks: slot.marks, difficulty: slot.difficulty, count: 1, section, paperTitle, rules: typeRules[slot.type], avoidQuestions: previous.map(q => ({ question: q.question.slice(0, 220), concept: q.concept.slice(0, 100), answer: q.correctAnswer.slice(0, 100) })), validationFeedback: feedback })}\n${sourceBoundary('BOOK_CONTENT', context)}`;
}
export const questionJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    questionNumber: { type: 'integer' }, sectionIndex: { type: 'integer' }, type: { type: 'string' }, question: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } }, correctAnswer: { type: 'string' }, explanation: { type: 'string' },
    marks: { type: 'number' }, difficulty: { type: 'string' }, concept: { type: 'string' }, evidence: { type: 'string' },
    source: { type: 'object', additionalProperties: false, properties: { chapterId: { type: 'string' }, page: { type: 'integer' }, chunkIds: { type: 'array', items: { type: 'string' } } }, required: ['chapterId', 'page', 'chunkIds'] },
  }, required: ['questionNumber', 'sectionIndex', 'type', 'question', 'options', 'correctAnswer', 'explanation', 'marks', 'difficulty', 'concept', 'evidence', 'source'],
};
