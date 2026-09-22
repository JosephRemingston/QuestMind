import { normalizeText } from '../../utils/sanitize.js';
// Page boundaries are retained for verifiable citations. Split at paragraphs/sentences
// and enforce an upper bound even for scripts without spaces or very long formulas.
export function chunkPages(pages, maxCharacters = 1800) {
  const chunks = [];
  for (const page of pages) {
    const parts = normalizeText(page.text).split(/\n\s*\n|(?<=[.!?।])\s+/u); let current = '';
    const emit = () => { if (current.trim()) chunks.push({ text: current.trim(), pageNumber: page.pageNumber, chunkIndex: chunks.length }); current = ''; };
    for (const part of parts) {
      if (current.length + part.length + 1 > maxCharacters) emit();
      if (part.length > maxCharacters) { for (let i = 0; i < part.length; i += maxCharacters) { current = part.slice(i, i + maxCharacters); emit(); } }
      else current += `${current ? '\n' : ''}${part}`;
    } emit();
  }
  return chunks;
}
