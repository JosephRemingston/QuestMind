import CuratedBookSource from './curatedBookSource.service.js';
import { env } from '../../configs/env.js';
export default class LicensedBookSource extends CuratedBookSource { constructor(entries = []) { super('licensed', env.LICENSED_ENABLED, entries); } }
