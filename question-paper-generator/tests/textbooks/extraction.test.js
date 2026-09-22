import { zip, epubEntries } from '../helpers/zip.js';
import { validateFile, readEpub } from '../../services/storage/file.service.js';
import { extractEpub } from '../../services/textbooks/extraction.service.js';
import { detectChapters } from '../../services/textbooks/chapterDetection.service.js';
test('valid EPUB uses spine ordering and ignores script/head metadata', async () => {
  const buffer = zip(epubEntries);
  expect((await validateFile({ originalname: 'book.epub', mimetype: 'application/epub+zip', buffer, size: buffer.length })).ext).toBe('epub');
  const extracted = await extractEpub(buffer); expect(extracted.pages).toHaveLength(1); expect(extracted.pages[0].text).toContain('A triangle has three sides.'); expect(extracted.pages[0].text).not.toContain('script'); expect(extracted.pages[0].text).not.toContain('Metadata'); expect(extracted.outline[0].strategy).toBe('epub_spine');
});
test('rejects EPUB DTD/entity injection and missing manifest', async () => {
  await expect(extractEpub(zip({ ...epubEntries, 'book/chapter1.xhtml': '<!DOCTYPE html [<!ENTITY x "malicious">]><html>&x;</html>' }))).rejects.toThrow();
  await expect(extractEpub(zip({ mimetype: 'application/epub+zip' }))).rejects.toThrow();
});
test('rejects encrypted, oversized and traversal archives', async () => {
  await expect(readEpub(zip(epubEntries, { flags: 1 }))).rejects.toThrow();
  await expect(readEpub(zip(epubEntries, { expandedSize: 200 * 1024 * 1024 }))).rejects.toThrow();
  await expect(readEpub(zip({ '../escape.xml': 'unsafe' }))).rejects.toThrow();
});
test('PDF outline creates explicit chapter page ranges', async () => {
  const document = { pages: [1, 2, 3, 4].map(pageNumber => ({ pageNumber, text: 'Source', lines: [] })), outline: [{ title: 'First chapter', startPage: 2, strategy: 'pdf_outline' }, { title: 'Second chapter', startPage: 4, strategy: 'pdf_outline' }] };
  const chapters = await detectChapters(document, 'Geometry'); expect(chapters.map(c => [c.title, c.startPage, c.endPage])).toEqual([['Introduction', 1, 1], ['First chapter', 2, 3], ['Second chapter', 4, 4]]);
});
test('chapter detection uses font and page structure without outline', async () => {
  const document = { outline: [], pages: [{ pageNumber: 1, text: 'Chapter 1 Triangles\nA triangle has three sides.', lines: [{ text: 'Chapter 1 Triangles', size: 20 }, { text: 'A triangle has three sides.', size: 12 }] }] };
  const chapters = await detectChapters(document, 'Geometry'); expect(chapters[0].strategy).toBe('heading_font_page_structure');
});
