import { sandboxJob } from './runtime.js';
import { processGeneration } from '../services/papers/generation.service.js';
export default job => sandboxJob(job, (job, signal) => processGeneration(job.data.generationJobId, signal));
