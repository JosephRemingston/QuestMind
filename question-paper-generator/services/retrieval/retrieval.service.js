import BookChunk from '../../models/BookChunk.js';
import { embedText, embeddingIdentity } from '../ai/embedding.service.js';
import { env } from '../../configs/env.js';
import ApiError from '../../utils/ApiError.js';
import { measured } from '../operations/metrics.service.js';
export function cosine(a, b) { if (!a?.length || a.length !== b?.length) return 0; let dot = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; } return aa && bb ? dot / Math.sqrt(aa * bb) : 0; }
export async function retrieve({ textbookId, chapter, userId, type, difficulty, section, excludedChunks = [], signal }) {
  return measured('retrieval', async () => {
    const candidates = await BookChunk.find({ textbookId, chapterId: chapter._id, $or: [{ userId: null }, { userId }] }).select('+embedding').sort('chunkIndex').limit(env.MAX_RETRIEVAL_CANDIDATES + 1).lean();
    if (!candidates.length) throw new ApiError(409, 'No chapter content is available', 'BOOK_CONTENT_NOT_READY');
    if (candidates.length > env.MAX_RETRIEVAL_CANDIDATES) throw new ApiError(409, 'Chapter exceeds the configured retrieval capacity', 'RETRIEVAL_CAPACITY_EXCEEDED');
    if (candidates.some(c => c.embeddingModel !== embeddingIdentity())) throw new ApiError(409, 'Textbook embeddings must be reindexed for the configured model', 'BOOK_CONTENT_NOT_READY');
    const topics = [...new Set(candidates.map(c => c.sectionTitle).filter(Boolean))].slice(0, 20).join(', ');
    const query = `${chapter.title}; topics ${topics}; ${type}; ${difficulty}; ${section.name}; ${section.marksEach} marks; ${section.instructions}`;
    const vector = await embedText(query, signal);
    return candidates.map(c => ({ ...c, score: cosine(c.embedding, vector) - (excludedChunks.includes(String(c._id)) ? 0.25 : 0) })).sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex).slice(0, env.RETRIEVAL_TOP_K);
  });
}
