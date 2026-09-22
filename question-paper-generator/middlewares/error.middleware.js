import { ZodError } from 'zod';
import multer from 'multer';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
export default function errorHandler(error, req, res, _next) {
  let status = error instanceof ApiError ? error.statusCode : 500;
  let message = error instanceof ApiError ? error.message : 'An unexpected error occurred';
  let code = error instanceof ApiError ? error.errorCode : 'INTERNAL_ERROR';
  if (error instanceof ZodError) { status = 400; message = error.issues.map(i => `${i.path.join('.') || 'request'}: ${i.message}`).join('; '); code = 'INVALID_REQUEST'; }
  if (error instanceof multer.MulterError) { status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400; message = error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the upload size limit' : 'Invalid multipart upload'; code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'INVALID_FILE_TYPE'; }
  if (error.name === 'CastError' || error.name === 'StrictModeError' || error.name === 'ValidationError') { status = 400; message = 'Invalid request data'; code = 'INVALID_REQUEST'; }
  if (error.type === 'entity.too.large') { status = 413; message = 'Request body too large'; code = 'FILE_TOO_LARGE'; }
  if (error.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON'; code = 'INVALID_REQUEST'; }
  if (error.code === 11000) { status = 409; message = 'Resource already exists'; code = 'CONFLICT'; }
  if (status >= 500) logger.error({ requestId: req.id, errorType: error.name, errorCode: code }, 'Request failed');
  if (!res.headersSent) res.status(status).json({ success: false, message, errorCode: code, requestId: req.id });
}
