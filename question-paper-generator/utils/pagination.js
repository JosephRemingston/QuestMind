import { z } from 'zod';
export const paginationSchema = { page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), sort: z.enum(['createdAt', '-createdAt', 'title', '-title']).default('-createdAt') };
export function paginate(query = {}) { const { page, limit, sort } = z.object(paginationSchema).parse(query); return { page, limit, skip: (page - 1) * limit, sort }; }
export const pagination = (total, page, limit) => ({ total, page, limit, pages: Math.ceil(total / limit) });
export async function listPage(Model, filter, query, projection) {
  const p = paginate(query);
  const [items, total] = await Promise.all([Model.find(filter).select(projection ?? '').sort(p.sort).skip(p.skip).limit(p.limit).lean(), Model.countDocuments(filter)]);
  return { items, pagination: pagination(total, p.page, p.limit) };
}
