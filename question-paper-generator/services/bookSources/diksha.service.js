import CuratedBookSource from './curatedBookSource.service.js';
import { env } from '../../configs/env.js';
// No public/private endpoint guesses. Register an approved integration via registry.js
// after reviewing its API contract and credentials. The default serves curated metadata.
export default class DikshaBookSource extends CuratedBookSource {
  constructor(entries = []) { super('diksha', env.DIKSHA_ENABLED, entries); }
}
