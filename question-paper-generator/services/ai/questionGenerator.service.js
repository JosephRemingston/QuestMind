import { generateStructuredOutput } from './llm.service.js';
import { questionPrompt, questionJsonSchema, generationSystem } from './prompt.service.js';
import { validateQuestion, validateGrounding } from './questionValidator.service.js';
import { env } from '../../configs/env.js';
import { validationRetries } from '../operations/metrics.service.js';
export async function generateQuestion(spec) {
  let feedback = '', lastError;
  for (let attempt = 0; attempt <= env.MAX_QUESTION_RETRIES; attempt++) {
    spec.signal?.throwIfAborted();
    try {
      const question = await generateStructuredOutput({ systemPrompt: generationSystem, userPrompt: questionPrompt({ ...spec, feedback }), schema: questionJsonSchema, signal: spec.signal });
      validateQuestion(question, spec.slot, spec.context, spec.previous);
      await validateGrounding(question, spec.context, spec.previous, spec.signal);
      return question;
    } catch (error) {
      if (error.errorCode !== 'QUESTION_VALIDATION_FAILED') throw error;
      lastError = error; feedback = error.message;
      if (attempt < env.MAX_QUESTION_RETRIES) validationRetries.inc();
    }
  }
  throw lastError;
}
