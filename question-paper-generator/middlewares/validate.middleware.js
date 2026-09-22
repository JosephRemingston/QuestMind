import { rejectUnsafeKeys } from '../utils/sanitize.js';
export const validate = (schema, source = 'body') => (req, _res, next) => {
  try { rejectUnsafeKeys(req[source]); req.validated ??= {}; req.validated[source] = schema.parse(req[source]); next(); } catch (error) { next(error); }
};
