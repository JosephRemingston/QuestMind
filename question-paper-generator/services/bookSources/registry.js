import DikshaBookSource from './diksha.service.js';
import NcertBookSource from './ncert.service.js';
import LicensedBookSource from './licensed.service.js';
const providers = new Map([['diksha', new DikshaBookSource()], ['ncert', new NcertBookSource()], ['licensed', new LicensedBookSource()]]);
export const sources = () => [...providers.values()].filter(p => p.enabled);
export function registerBookSource(name, provider) { for (const method of ['searchBooks', 'getBook', 'getChapters', 'resolveCode', 'getContent']) if (typeof provider[method] !== 'function') throw new Error(`Missing provider method: ${method}`); providers.set(name, provider); }
