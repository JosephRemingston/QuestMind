import { sandboxJob } from './runtime.js';
import { processPdf } from '../services/papers/pdfProcessing.service.js';
export default job => sandboxJob(job, (job, signal) => processPdf(job.data.questionPaperId, signal));
