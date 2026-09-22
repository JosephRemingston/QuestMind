import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import yauzl from 'yauzl';
import ApiError from '../../utils/ApiError.js';
import { env } from '../../configs/env.js';
export const invalidFile = () => new ApiError(400, 'Only valid PDF or EPUB files are supported', 'INVALID_FILE_TYPE');
export function readEpub(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(invalidFile());
      const entries = new Map(); let total = 0, count = 0, failed = false;
      const fail = () => { if (!failed) { failed = true; zip.close(); reject(invalidFile()); } };
      zip.on('error', fail); zip.on('end', () => { if (!failed) resolve(entries); });
      zip.on('entry', entry => {
        if (++count > env.MAX_ARCHIVE_ENTRIES || entry.generalPurposeBitFlag & 1 || entry.fileName.startsWith('/') || entry.fileName.split('/').includes('..')) return fail();
        total += entry.uncompressedSize;
        if (total > env.MAX_ARCHIVE_EXPANDED_MB * 1024 * 1024 || entry.uncompressedSize > 20 * 1024 * 1024) return fail();
        if (!/\.(xhtml|html|xml|opf|ncx)$/i.test(entry.fileName) && entry.fileName !== 'mimetype') { zip.readEntry(); return; }
        zip.openReadStream(entry, (err, stream) => {
          if (err) return fail(); const chunks = []; let size = 0;
          stream.on('error', fail); stream.on('data', chunk => { size += chunk.length; if (size > entry.uncompressedSize || size > 20 * 1024 * 1024) { stream.destroy(); fail(); } else chunks.push(chunk); });
          stream.on('end', () => { if (!failed) { entries.set(entry.fileName, Buffer.concat(chunks).toString('utf8')); zip.readEntry(); } });
        });
      }); zip.readEntry();
    });
  });
}
export async function validateFile(file, kind = 'book') {
  if (!file) throw new ApiError(400, 'A file is required', 'INVALID_FILE_TYPE');
  const maximum = (kind === 'book' ? env.MAX_BOOK_SIZE_MB : env.MAX_SAMPLE_PAPER_SIZE_MB) * 1024 * 1024;
  if (file.size > maximum) throw new ApiError(413, 'File exceeds the upload size limit', 'FILE_TOO_LARGE');
  const buffer = file.buffer ?? await readFile(file.path);
  const ext = extname(file.originalname).toLowerCase();
  if (ext === '.pdf' && file.mimetype === 'application/pdf' && buffer.subarray(0, 5).toString() === '%PDF-') return { ext: 'pdf', mimeType: 'application/pdf', buffer };
  if (kind === 'book' && ext === '.epub' && file.mimetype === 'application/epub+zip' && buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) {
    const entries = await readEpub(buffer);
    if (entries.get('mimetype')?.trim() === 'application/epub+zip' && entries.has('META-INF/container.xml')) return { ext: 'epub', mimeType: 'application/epub+zip', buffer };
  }
  throw invalidFile();
}
