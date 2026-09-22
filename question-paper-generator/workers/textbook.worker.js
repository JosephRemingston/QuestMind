import { sandboxJob } from './runtime.js';
import { processTextbook } from '../services/textbooks/textbookProcessing.service.js';
import { analyzeSample } from '../services/patterns/samplePaperAnalyzer.service.js';
import { syncSource, syncBookChapters } from '../services/operations/catalogSync.service.js';
export default job => sandboxJob(job, async (job, signal) => {
  switch (job.name) {
    case 'PROCESS_TEXTBOOK': case 'EXTRACT_CHAPTERS': case 'CREATE_CHUNKS': case 'CREATE_EMBEDDINGS': return processTextbook(job.data.textbookId, signal);
    case 'ANALYZE_SAMPLE': return analyzeSample(job.data.samplePaperId, signal);
    case 'SYNC_DIKSHA_BOOKS': return syncSource('diksha');
    case 'SYNC_NCERT_BOOKS': return syncSource('ncert');
    case 'SYNC_BOOK_CHAPTERS': return syncBookChapters(job.data.textbookId);
    case 'UPDATE_BOOK_METADATA': return syncSource(job.data.source);
    default: throw new Error('Unsupported textbook job');
  }
});
