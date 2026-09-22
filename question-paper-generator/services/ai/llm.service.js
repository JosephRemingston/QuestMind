import OpenAI from 'openai';
import Ajv from 'ajv';
import config from '../../configs/llm.js';
import { env } from '../../configs/env.js';
import ApiError from '../../utils/ApiError.js';
import { measured } from '../operations/metrics.service.js';
const ajv = new Ajv({ allErrors: true, strict: false });
const providers = new Map();
export const registerLLMProvider = (name, provider) => providers.set(name, provider);
class OpenAIProvider {
  constructor() { this.client = new OpenAI({ apiKey: config.apiKey, timeout: config.timeout, maxRetries: 0 }); }
  async generateStructuredOutput({ systemPrompt, userPrompt, schema, signal }) {
    const response = await this.client.responses.create({ model: config.model, store: false, input: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], text: { format: { type: 'json_schema', name: 'assessment_output', strict: true, schema } }, max_output_tokens: env.LLM_MAX_OUTPUT_TOKENS }, { signal });
    if (response.status !== 'completed' || !response.output_text) throw new ApiError(502, 'AI provider did not return a complete result', 'GENERATION_FAILED');
    return JSON.parse(response.output_text);
  }
}
export async function generateStructuredOutput(request) {
  return measured('llm', async () => {
    if (!providers.has(config.provider)) {
      if (config.provider !== 'openai') throw new ApiError(503, 'AI generation is not configured', 'PROVIDER_UNAVAILABLE');
      providers.set('openai', new OpenAIProvider());
    }
    const data = await providers.get(config.provider).generateStructuredOutput(request);
    if (!ajv.compile(request.schema)(data)) throw new ApiError(502, 'AI returned invalid structured data', 'QUESTION_VALIDATION_FAILED');
    return data;
  });
}
