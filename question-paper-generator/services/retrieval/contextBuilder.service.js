import { sanitizeSource } from '../security/promptInjection.service.js';
import { env } from '../../configs/env.js';
import ApiError from '../../utils/ApiError.js';
export function buildContext(chunks, maxTokens = env.MAX_CONTEXT_TOKENS) {
  const selected = []; let bytes = Buffer.byteLength('<BOOK_CONTENT>\n[]\n</BOOK_CONTENT>');
  for (const chunk of chunks) {
    const record = { chunkId: String(chunk._id), chapterId: String(chunk.chapterId), page: chunk.pageNumber, sectionTitle: chunk.sectionTitle, text: chunk.text };
    // UTF-8 bytes form a conservative tokenizer-independent token upper bound.
    const cost = Buffer.byteLength(sanitizeSource(JSON.stringify(record)), 'utf8') + 2;
    if (bytes + cost > maxTokens) continue;
    selected.push(record); bytes += cost;
  }
  if (!selected.length) throw new ApiError(409, 'Insufficient source context within budget', 'BOOK_CONTENT_NOT_READY');
  return selected;
}
