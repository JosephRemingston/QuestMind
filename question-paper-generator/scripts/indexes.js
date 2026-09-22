import { readdir } from 'node:fs/promises';
import connectDB, { closeDB } from '../configs/database.js';
await connectDB();
try {
  for (const filename of await readdir(new URL('../models/', import.meta.url))) {
    if (!filename.endsWith('.js') || filename === 'shared.js') continue;
    const Model = (await import(`../models/${filename}`)).default;
    await Model.createIndexes(); console.log(`Indexes ready: ${Model.modelName}`);
  }
} finally { await closeDB(); }
