import { hostname } from 'node:os';
import { getRedis } from '../../configs/redis.js';
import { Registry, AggregatorRegistry, Histogram, Counter, collectDefaultMetrics } from 'prom-client';
export const registry = new Registry();
registry.setDefaultLabels({ process_instance: `${hostname()}-${process.pid}` });
collectDefaultMetrics({ register: registry });
export const latency = new Histogram({ name: 'questmind_operation_seconds', help: 'Operation duration', labelNames: ['operation'], buckets: [0.1, 0.5, 1, 5, 15, 60, 180, 600], registers: [registry] });
export const failures = new Counter({ name: 'questmind_failures_total', help: 'Operation failures', labelNames: ['operation'], registers: [registry] });
export const validationRetries = new Counter({ name: 'questmind_question_validation_retries_total', help: 'Invalid questions regenerated', registers: [registry] });
export async function measured(operation, fn) { const stop = latency.startTimer({ operation }); try { return await fn(); } catch (error) { failures.inc({ operation }); throw error; } finally { stop(); await publishMetrics().catch(() => {}); } }

export async function publishMetrics() { await getRedis().set('metrics:process:' + hostname() + ':' + process.pid, JSON.stringify(await registry.getMetricsAsJSON()), 'EX', 3600); }
export async function allMetrics() {
  const redis = getRedis(), snapshots = [await registry.getMetricsAsJSON()]; let cursor = '0';
  do { const [next, keys] = await redis.scan(cursor, 'MATCH', 'metrics:process:*', 'COUNT', 100); cursor = next;
    for (const key of keys) { if (key === 'metrics:process:' + process.pid) continue; const value = await redis.get(key); if (value) snapshots.push(JSON.parse(value)); }
  } while (cursor !== '0');
  return AggregatorRegistry.aggregate(snapshots).metrics();
}
