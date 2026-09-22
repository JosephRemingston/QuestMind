import { validateQuestion, validatePaper, nearDuplicate } from '../../services/ai/questionValidator.service.js';
import { balanceMcqAnswers } from '../../services/papers/scoring.service.js';
import { buildAnswerKey } from '../../services/ai/answerGenerator.service.js';
import { context, slot, question } from '../helpers/question.js';
import { buildContext } from '../../services/retrieval/contextBuilder.service.js';
import { chunkPages } from '../../services/retrieval/chunk.service.js';
import { cosine } from '../../services/retrieval/retrieval.service.js';
test('accepts grounded MCQ', () => expect(validateQuestion(question(), slot, context)).toBeTruthy());
test.each([
  { options: ['Two', 'Two', 'Three', 'Four'] }, { correctAnswer: 'Six' }, { marks: 2 }, { question: '' },
  { source: { chapterId: 'foreign', chunkIds: ['unknown'], page: 2 } }, { evidence: 'This fact is made up.' },
  { source: { ...question().source, page: 900 } }, { difficulty: 'easy' },
])('rejects invalid question %#', change => expect(() => validateQuestion({ ...question(), ...change }, slot, context)).toThrow());
test('detects duplicate wording and punctuation', () => { expect(nearDuplicate('What is a triangle?', 'What is a triangle!')).toBe(true); expect(() => validateQuestion(question(), slot, context, [question()])).toThrow(/Duplicate/); });
test('answer key derives from existing validated objects', () => { const [key] = buildAnswerKey([question()]); expect(key.correctAnswer).toBe(question().correctAnswer); expect(key.explanation).toBe(question().explanation); });
test('answer balancing preserves answer text', () => { const questions = Array.from({ length: 4 }, () => question()); const balanced = balanceMcqAnswers(questions); expect(balanced.map(q => q.options.indexOf(q.correctAnswer))).toEqual([0, 1, 2, 3]); });
test('paper cannot pass with incorrect counts, totals or difficulty', () => { const p = { totalMarks: 1, sections: [{ count: 1, marksEach: 1 }] }; expect(validatePaper([question()], [slot], p)).toBe(true); expect(() => validatePaper([], [slot], p)).toThrow(); expect(() => validatePaper([question()], [slot], { ...p, totalMarks: 2 })).toThrow(); });
test('context budget never includes oversized chunks', () => { const small = { _id: 'c', chapterId: 'b', pageNumber: 1, text: 'Small source' }; expect(buildContext([small, { ...small, text: 'x'.repeat(10000) }], 200)).toHaveLength(1); expect(() => buildContext([{ ...small, text: 'x'.repeat(1000) }], 10)).toThrow(); });
test('chunking preserves page citations and hard text bounds', () => { const chunks = chunkPages([{ pageNumber: 7, text: 'x'.repeat(5000) }]); expect(chunks.length).toBe(3); expect(chunks.every(c => c.text.length <= 1800 && c.pageNumber === 7)).toBe(true); });
test('cosine guards malformed vectors', () => { expect(cosine([1, 0], [1, 0])).toBe(1); expect(cosine([0, 0], [1, 0])).toBe(0); expect(cosine([1], [1, 2])).toBe(0); });
