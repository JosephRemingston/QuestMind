import { generateQuestion } from '../../services/ai/questionGenerator.service.js';
import { registerLLMProvider } from '../../services/ai/llm.service.js';
import { context, slot, question } from '../helpers/question.js';
import { env } from '../../configs/env.js';
const verdict = { supported: true, correct: true, uniqueAnswer: true, difficultyAppropriate: true, duplicate: false, safe: true, reason: 'Source supports the answer' };
test('regenerates only the invalid slot, then independently checks its answer', async () => {
  let generations = 0, validations = 0;
  registerLLMProvider('disabled', { generateStructuredOutput: async ({ schema }) => { if (schema.properties.supported) { validations++; return verdict; } generations++; return generations === 1 ? { ...question(), evidence: 'Invented unsupported evidence' } : question(); } });
  const q = await generateQuestion({ book: { title: 'Geometry' }, chapter: { title: 'Triangles' }, slot, context, previous: [] });
  expect(q.correctAnswer).toBe('Three'); expect(generations).toBe(2); expect(validations).toBe(1);
});
test('stops at the configured validation retry budget', async () => {
  let count = 0;
  registerLLMProvider('disabled', { generateStructuredOutput: async () => { count++; return { ...question(), source: { ...question().source, chunkIds: ['foreign'] } }; } });
  await expect(generateQuestion({ book: {}, chapter: {}, slot, context, previous: [] })).rejects.toMatchObject({ errorCode: 'QUESTION_VALIDATION_FAILED' });
  expect(count).toBe(env.MAX_QUESTION_RETRIES + 1);
});
test('an exact evidence quote does not bypass failed independent grounding', async () => {
  registerLLMProvider('disabled', { generateStructuredOutput: async ({ schema }) => schema.properties.supported ? { ...verdict, supported: false } : question() });
  await expect(generateQuestion({ book: {}, chapter: {}, slot, context, previous: [] })).rejects.toMatchObject({ errorCode: 'QUESTION_VALIDATION_FAILED' });
});
