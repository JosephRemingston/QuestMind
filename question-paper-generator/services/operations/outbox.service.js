import Outbox from '../../models/Outbox.js';
import { getQueue } from '../../queues/base.queue.js';
import logger from '../../utils/logger.js';
export const enqueue = (queue, name, jobId, data, session) => Outbox.updateOne({ queue, jobId: String(jobId) }, { $setOnInsert: { name, data } }, { upsert: true, session });
let dispatching = false;
export async function dispatchOutbox() {
  if (dispatching) return; dispatching = true;
  try {
    const events = await Outbox.find({ dispatchedAt: null }).sort('createdAt').limit(100);
    for (const event of events) {
      try {
        await getQueue(event.queue).add(event.name, event.data, { jobId: event.jobId });
        await Outbox.updateOne({ _id: event.id }, { $set: { dispatchedAt: new Date() } });
      } catch { await Outbox.updateOne({ _id: event.id }, { $set: { lastErrorAt: new Date() } }); logger.warn({ jobId: event.jobId }, 'Queue dispatch will retry'); }
    }
  } finally { dispatching = false; }
}
