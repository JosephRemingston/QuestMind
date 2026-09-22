import { randomUUID } from 'node:crypto';
import logger from '../utils/logger.js';
export default function requestId(req, res, next) {
  req.id = randomUUID(); res.setHeader('X-Request-Id', req.id);
  const start = performance.now();
  res.on('finish', () => logger.info({ requestId: req.id, userId: req.user?.id, route: req.route?.path ?? 'unmatched', method: req.method, statusCode: res.statusCode, duration: Math.round(performance.now() - start) }, 'HTTP request'));
  next();
}
