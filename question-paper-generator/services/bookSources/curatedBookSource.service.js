import BaseBookSource from './baseBookSource.service.js';
import { readFile } from 'node:fs/promises';
export default class CuratedBookSource extends BaseBookSource {
  constructor(name, enabled, entries = []) { super(); this.name = name; this.enabled = enabled; this.entries = entries; }
  async records() { return this.enabled ? this.entries : []; }
  async searchBooks(filters = {}) {
    return (await this.records()).filter(book => ['board', 'classLevel', 'medium', 'subject'].every(k => !filters[k] || book[k] === filters[k]) && (!filters.search || filters.search.toLowerCase().split(/\s+/).every(t => JSON.stringify(book).toLowerCase().includes(t)))).slice(0, 100).map(book => ({ ...book, source: this.name, contentAvailable: false, chaptersAvailable: Boolean(book.chapters?.length) }));
  }
  async getBook(externalId) { return (await this.records()).find(b => b.externalId === externalId) ?? null; }
  async getChapters(externalId) { return (await this.getBook(externalId))?.chapters ?? []; }
  async resolveCode(code) { return (await this.records()).find(b => [b.qrCode, b.dialCode, b.doId, b.externalId, b.officialUrl].includes(code)) ?? null; }
}
export const readCurated = async () => JSON.parse(await readFile(new URL('../../fixtures/catalog.json', import.meta.url), 'utf8'));
