import Textbook from '../../models/Textbook.js';
import Chapter from '../../models/Chapter.js';
import { visibleTo, publicBook, publicChapter, getBook } from './textbook.service.js';
import { sources } from '../bookSources/registry.js';
export function identifyCode(input) {
  const code = input.trim();
  try {
    const url = new URL(code);
    if (url.protocol !== 'https:') return { source: 'unknown', code };
    if (['diksha.gov.in', 'www.diksha.gov.in'].includes(url.hostname)) return { source: 'diksha', code: url.searchParams.get('dialcode') ?? url.pathname.split('/').filter(Boolean).at(-1) ?? code };
    if (['ncert.nic.in', 'www.ncert.nic.in', 'epathshala.nic.in'].includes(url.hostname)) return { source: 'ncert', code };
    return { source: 'unknown', code };
  } catch { return { source: /^do_\d+$/.test(code) ? 'diksha' : 'unknown', code }; }
}
export async function resolveQrCode(input, userId) {
  const identified = identifyCode(input), codes = [...new Set([input.trim(), identified.code])];
  const book = await Textbook.findOne({ ...visibleTo(userId), $and: [{ $or: ['qrCode', 'dialCode', 'doId', 'externalId', 'officialUrl'].map(k => ({ [k]: { $in: codes } })) }] });
  if (book) return { source: book.source, textbook: publicBook(book), chapter: null };
  const chapter = await Chapter.findOne({ isActive: true, $or: [{ userId: null }, { userId }], $and: [{ $or: ['qrCode', 'dialCode', 'officialUrl'].map(k => ({ [k]: { $in: codes } })) }] });
  if (chapter) { const parent = await getBook(chapter.textbookId, userId); return { source: parent.source, textbook: publicBook(parent), chapter: publicChapter(chapter, parent) }; }
  // Unknown codes are matched locally first; their format alone is never proof of DIKSHA ownership.
  for (const provider of sources()) {
    if (identified.source !== 'unknown' && provider.name !== identified.source) continue;
    const match = await provider.resolveCode(identified.code);
    if (match) return { source: provider.name, discovery: { ...match, contentAvailable: false }, textbook: null, chapter: null };
  }
  return { source: identified.source, textbook: null, chapter: null, uploadSuggested: true };
}
