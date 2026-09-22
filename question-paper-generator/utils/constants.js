export const ROLES = ['student', 'parent', 'teacher', 'admin'];
export const SOURCES = ['diksha', 'ncert', 'licensed', 'uploaded'];
export const CONTENT_STATUSES = ['metadata_only', 'available', 'processing', 'ready', 'failed'];
export const QUESTION_TYPES = ['mcq', 'true_false', 'fill_blank', 'very_short_answer', 'short_answer', 'long_answer', 'assertion_reason', 'case_based', 'numerical', 'match_the_following'];
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'];
export const DIFFICULTY_SCORES = { easy: 0.3, medium: 0.5, hard: 0.8 };
export const ERROR_CODES = Object.fromEntries(['AUTH_REQUIRED', 'INVALID_OTP', 'OTP_RATE_LIMITED', 'USER_NOT_FOUND', 'TEXTBOOK_NOT_FOUND', 'CHAPTER_NOT_FOUND', 'BOOK_CONTENT_NOT_READY', 'INVALID_PATTERN', 'GENERATION_LIMIT_REACHED', 'GENERATION_FAILED', 'QUESTION_VALIDATION_FAILED', 'FILE_TOO_LARGE', 'INVALID_FILE_TYPE', 'RESOURCE_NOT_FOUND', 'FORBIDDEN'].map(x => [x, x]));
export const JOBS = { PROCESS_TEXTBOOK: 'PROCESS_TEXTBOOK', EXTRACT_CHAPTERS: 'EXTRACT_CHAPTERS', CREATE_CHUNKS: 'CREATE_CHUNKS', CREATE_EMBEDDINGS: 'CREATE_EMBEDDINGS', ANALYZE_SAMPLE: 'ANALYZE_SAMPLE', GENERATE: 'GENERATE', PDF: 'PDF', SYNC_DIKSHA_BOOKS: 'SYNC_DIKSHA_BOOKS', SYNC_NCERT_BOOKS: 'SYNC_NCERT_BOOKS', SYNC_BOOK_CHAPTERS: 'SYNC_BOOK_CHAPTERS', UPDATE_BOOK_METADATA: 'UPDATE_BOOK_METADATA' };
