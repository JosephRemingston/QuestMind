import OpenAI from 'openai';
import config from '../../configs/embeddings.js';
import { env } from '../../configs/env.js';
import ApiError from '../../utils/ApiError.js';
const providers = new Map();
export const registerEmbeddingProvider = (name, provider) => providers.set(name, provider);
export const embeddingIdentity = () => `${config.provider}:${config.model}`;
export async function embedTexts(texts, signal) {
  if (!texts.length) return [];
  if (!providers.has(config.provider)) {
    if (config.provider !== 'openai') throw new ApiError(503, 'Embeddings are not configured', 'PROVIDER_UNAVAILABLE');
    const client = new OpenAI({ apiKey: config.apiKey, timeout: env.LLM_TIMEOUT_MS, maxRetries: 0 });
    providers.set('openai', { embedTexts: async (input, signal) => (await client.embeddings.create({ model: config.model, input }, { signal })).data.sort((a, b) => a.index - b.index).map(v => v.embedding) });
  }
  const result = [];
  for (let i = 0; i < texts.length; i += 32) {
    signal?.throwIfAborted();
    const batch = await providers.get(config.provider).embedTexts(texts.slice(i, i + 32), signal);
    if (batch.length !== Math.min(32, texts.length - i) || batch.some(v => !Array.isArray(v) || !v.length || v.some(n => !Number.isFinite(n)))) throw new ApiError(502, 'Invalid embedding response', 'PROVIDER_UNAVAILABLE');
    result.push(...batch);
  }
  if (result.some(v => v.length !== result[0].length)) throw new ApiError(502, 'Inconsistent embedding dimensions', 'PROVIDER_UNAVAILABLE');
  return result;
}
export const embedText = async (text, signal) => (await embedTexts([text], signal))[0];
