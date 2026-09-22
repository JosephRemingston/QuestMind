import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import path from 'node:path';
import { readEpub, invalidFile } from '../storage/file.service.js';
import { normalizeText } from '../../utils/sanitize.js';
import { env } from '../../configs/env.js';
import ApiError from '../../utils/ApiError.js';
const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
export async function extractPdf(buffer, signal) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const assets = path.dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')));
  const loading = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, standardFontDataUrl: `${assets}/standard_fonts/`, cMapUrl: `${assets}/cmaps/`, cMapPacked: true, wasmUrl: `${assets}/wasm/` });
  let document;
  try {
    document = await loading.promise;
    if (document.numPages > env.MAX_BOOK_PAGES) throw new ApiError(413, 'Too many pages', 'FILE_TOO_LARGE');
    const pages = []; let characters = 0;
    for (let i = 1; i <= document.numPages; i++) {
      signal?.throwIfAborted();
      const page = await document.getPage(i), content = await page.getTextContent();
      const lines = []; let line;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform[5], size = Math.abs(item.transform[3]) || item.height;
        if (!line || Math.abs(line.y - y) > 3) { line = { text: '', y, size, font: item.fontName }; lines.push(line); }
        line.text += `${line.text ? ' ' : ''}${item.str}`; line.size = Math.max(line.size, size);
        if (item.hasEOL) line = undefined;
      }
      const text = normalizeText(lines.map(l => l.text).join('\n')); characters += text.length;
      if (characters > env.MAX_EXTRACTED_CHARACTERS) throw new ApiError(413, 'Extracted text exceeds processing capacity', 'FILE_TOO_LARGE');
      pages.push({ pageNumber: i, text, lines }); page.cleanup();
    }
    if (pages.reduce((n, p) => n + p.text.length, 0) < 100) throw new ApiError(422, 'No usable text found. Scanned PDFs require OCR before upload.', 'TEXT_EXTRACTION_FAILED');
    const outline = [];
    const walk = async entries => {
      for (const entry of entries ?? []) {
        let dest = typeof entry.dest === 'string' ? await document.getDestination(entry.dest) : entry.dest;
        if (dest?.[0] !== undefined) { const index = Number.isInteger(dest[0]) ? dest[0] : await document.getPageIndex(dest[0]); outline.push({ title: entry.title, startPage: index + 1, strategy: 'pdf_outline' }); }
        await walk(entry.items);
      }
    };
    await walk(await document.getOutline()); return { pages, outline };
  } catch (error) {
    if (error instanceof ApiError || signal?.aborted) throw error;
    throw new ApiError(422, 'Unable to extract PDF; check that it is valid and unencrypted', 'TEXT_EXTRACTION_FAILED');
  } finally { await loading.destroy(); }
}
export async function extractEpub(buffer) {
  const entries = await readEpub(buffer), parser = new XMLParser({ ignoreAttributes: false, processEntities: true, htmlEntities: true });
  // Reject DTDs before parsing. External entities/network resources are never resolved.
  if ([...entries.values()].some(v => /<!ENTITY|<!DOCTYPE[^>]*\[/i.test(v))) throw invalidFile();
  const container = parser.parse(entries.get('META-INF/container.xml') ?? '');
  const root = list(container.container?.rootfiles?.rootfile)[0]?.['@_full-path'];
  if (!root || !entries.has(root)) throw invalidFile();
  const opf = parser.parse(entries.get(root)).package;
  const manifest = new Map(list(opf.manifest?.item).map(item => [item['@_id'], item]));
  const pages = [], outline = []; let characters = 0;
  const extractText = value => {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (!value || typeof value !== 'object') return '';
    return Object.entries(value).filter(([key]) => !key.startsWith('@_') && !['script', 'style', 'head'].includes(key)).map(([, child]) => extractText(child)).join('\n');
  };
  for (const ref of list(opf.spine?.itemref)) {
    const item = manifest.get(ref['@_idref']); if (!item) throw invalidFile();
    const name = path.posix.normalize(path.posix.join(path.posix.dirname(root), decodeURIComponent(item['@_href'].split('#')[0])));
    if (!entries.has(name)) throw invalidFile();
    const parsed = parser.parse(entries.get(name)), text = normalizeText(extractText(parsed)); characters += text.length;
    if (characters > env.MAX_EXTRACTED_CHARACTERS || pages.length >= env.MAX_BOOK_PAGES) throw new ApiError(413, 'EPUB exceeds processing capacity', 'FILE_TOO_LARGE');
    if (!text) continue;
    const pageNumber = pages.length + 1, title = text.split('\n').find(l => l.trim())?.slice(0, 200) || `Part ${pageNumber}`;
    pages.push({ pageNumber, text, lines: [] }); outline.push({ title, startPage: pageNumber, strategy: 'epub_spine' });
  }
  if (!pages.length) throw invalidFile(); return { pages, outline };
}
export const extractDocument = (buffer, ext, signal) => ext === 'epub' ? extractEpub(buffer) : extractPdf(buffer, signal);
