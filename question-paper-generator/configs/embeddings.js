import { env } from './env.js';
export default { provider: env.EMBEDDING_PROVIDER, model: env.EMBEDDING_MODEL, apiKey: env.EMBEDDING_API_KEY };
