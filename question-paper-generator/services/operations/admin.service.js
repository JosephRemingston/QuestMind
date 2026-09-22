import { enqueue } from './outbox.service.js';
import { randomUUID } from '../../utils/crypto.js';
import QuestionPaper from '../../models/QuestionPaper.js';
import ApiError from '../../utils/ApiError.js';
export async function queueSync(source, userId) { const jobId = `sync-${source}-${randomUUID()}`; await enqueue('textbook-processing', source === 'diksha' ? 'SYNC_DIKSHA_BOOKS' : 'SYNC_NCERT_BOOKS', jobId, { source, userId }); return { jobId, status: 'queued' }; }
export async function retryPdf(paperId, userId) { const paper = await QuestionPaper.findOne({ _id: paperId, userId, status: 'ready', pdfStatus: 'failed' }); if (!paper) throw new ApiError(409, 'Only failed PDFs can be retried', 'CONFLICT'); await enqueue('pdf-generation', 'PDF', `pdf-retry-${paperId}-${randomUUID()}`, { questionPaperId: paperId, userId }); return { status: 'queued' }; }
