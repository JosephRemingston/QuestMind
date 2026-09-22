import Textbook from '../../models/Textbook.js';
import { visibleTo, publicBook } from './textbook.service.js';
import { listPage } from '../../utils/pagination.js';
import { sources } from '../bookSources/registry.js';
export function searchFilter(query, userId) {
  const filter = visibleTo(userId);
  for (const key of ['board', 'classLevel', 'medium', 'subject', 'source']) if (query[key]) filter[key] = query[key];
  if (query.search) {
    const terms = query.search.replace(/\bmaths\b/gi, 'mathematics');
    filter.$and = [{ $or: [{ $text: { $search: terms } }, ...['externalId', 'dialCode', 'doId', 'qrCode'].map(key => ({ [key]: query.search }))] }];
  }
  return filter;
}
export async function searchBooks(query, userId) {
  const result = await listPage(Textbook, searchFilter(query, userId), query);
  // Provider search operates on authorized metadata only; never fetch book content here.
  let discovery = [];
  if (!result.pagination.total && query.page === 1) {
    for (const source of sources()) { if (query.source && query.source !== source.name) continue; discovery = await source.searchBooks(query); if (discovery.length) break; }
  }
  return { books: result.items.map(publicBook), pagination: result.pagination, discovery, uploadSuggested: result.pagination.total === 0 && discovery.length === 0 };
}
export const recommended = (user, query) => searchBooks({ ...query, ...Object.fromEntries(['board', 'classLevel', 'medium'].filter(k => user[k]).map(k => [k, user[k]])) }, user.id);
