import { generateStructuredOutput } from '../ai/llm.service.js';
import { SOURCE_POLICY, sourceBoundary } from '../security/promptInjection.service.js';
export async function detectChapters({ pages, outline }, title, signal) {
  let starts = outline.filter(x => x.title && x.startPage >= 1 && x.startPage <= pages.length);
  if (!starts.length) {
    // Printed TOC numbers are accepted only when the target page actually contains the title.
    for (const page of pages.slice(0, 12)) for (const match of page.text.matchAll(/^(.{4,120}?)\s*\.{2,}\s*(\d{1,4})\s*$/gm)) {
      const n = Number(match[2]); if (pages[n - 1]?.text.toLowerCase().includes(match[1].trim().toLowerCase())) starts.push({ title: match[1].trim(), startPage: n, strategy: 'table_of_contents' });
    }
  }
  if (!starts.length) {
    const frequency = new Map();
    for (const page of pages) for (const line of page.lines.slice(0, 6)) frequency.set(line.text.trim(), (frequency.get(line.text.trim()) ?? 0) + 1);
    for (const page of pages) {
      const sizes = page.lines.map(l => l.size).sort((a, b) => a - b), median = sizes[Math.floor(sizes.length / 2)] || 12;
      const heading = page.lines.slice(0, 12).find(l => l.text.length >= 3 && l.text.length <= 160 && ((/^(chapter|unit|lesson|अध्याय|पाठ)\s*[\dIVX]+/iu.test(l.text)) || (l.size >= median * 1.35 && /^\d+[.\s]/.test(l.text))) && (frequency.get(l.text.trim()) ?? 0) <= 2);
      if (heading) starts.push({ title: heading.text.trim(), startPage: page.pageNumber, strategy: 'heading_font_page_structure' });
    }
  }
  if (!starts.length) {
    const snippets = pages.map(p => ({ page: p.pageNumber, opening: p.text.slice(0, 220) }));
    const bounded = []; let bytes = 0;
    for (const snippet of snippets) { const size = Buffer.byteLength(JSON.stringify(snippet)); if (bytes + size > 16000) break; bounded.push(snippet); bytes += size; }
    const result = await generateStructuredOutput({ systemPrompt: `${SOURCE_POLICY} Identify chapter boundaries from page opening snippets. Only return boundaries explicitly evidenced by a heading in a provided page. Copy the title exactly. Return an empty array when uncertain.`, userPrompt: sourceBoundary('BOOK_CONTENT', bounded), schema: { type: 'object', additionalProperties: false, properties: { chapters: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, startPage: { type: 'integer' } }, required: ['title', 'startPage'] } } }, required: ['chapters'] }, signal });
    starts = result.chapters.filter(x => x.title.length >= 3 && pages[x.startPage - 1]?.text.includes(x.title)).map(x => ({ ...x, strategy: 'llm_verified_heading' }));
  }
  if (!starts.length) starts = [{ title: `${title} - Full text`, startPage: 1, strategy: 'whole_document_fallback' }];
  starts = [...new Map(starts.sort((a, b) => a.startPage - b.startPage).map(x => [x.startPage, x])).values()];
  // Keep introductory material separate so no source pages silently disappear.
  if (starts[0].startPage > 1) starts.unshift({ title: 'Introduction', startPage: 1, strategy: 'page_structure' });
  return starts.map((x, i) => ({ ...x, endPage: (starts[i + 1]?.startPage ?? pages.length + 1) - 1, order: i, chapterNumber: i + 1 }));
}
