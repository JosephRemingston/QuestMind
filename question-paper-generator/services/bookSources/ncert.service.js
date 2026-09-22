import CuratedBookSource, { readCurated } from './curatedBookSource.service.js';
import { env } from '../../configs/env.js';
export default class NcertBookSource extends CuratedBookSource {
  constructor() { super('ncert', env.NCERT_ENABLED); }
  async records() { return this.enabled ? (await readCurated()).filter(b => b.source === 'ncert') : []; }
}
