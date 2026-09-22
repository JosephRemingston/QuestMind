import connectDB, { closeDB } from '../configs/database.js';
import { readCurated } from '../services/bookSources/curatedBookSource.service.js';
import { builtIns } from '../services/patterns/pattern.service.js';
import QuestionPattern from '../models/QuestionPattern.js';
import Textbook from '../models/Textbook.js';
await connectDB();
try {
  for (const pattern of builtIns) await QuestionPattern.updateOne({ userId: null, builtIn: true, name: pattern.name }, { $setOnInsert: pattern }, { upsert: true });
  for (const record of await readCurated()) { const { chapters, ...fields } = record; await Textbook.updateOne({ source: fields.source, externalId: fields.externalId }, { $setOnInsert: { ...fields, userId: null } }, { upsert: true }); }
  console.log('Seeded eight editable-copy templates and curated discovery metadata. No textbook content was downloaded.');
} finally { await closeDB(); }
