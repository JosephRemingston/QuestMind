import { env } from './env.js';
export default { provider: env.LLM_PROVIDER, model: env.LLM_MODEL, apiKey: env.LLM_API_KEY, timeout: env.LLM_TIMEOUT_MS };
