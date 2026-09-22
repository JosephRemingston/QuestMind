import StudentProfile from '../../models/StudentProfile.js';
import { listPage } from '../../utils/pagination.js';
import ApiError from '../../utils/ApiError.js';
export const list = (userId, query) => listPage(StudentProfile, { userId, isActive: true }, query);
export const create = (userId, body) => StudentProfile.create({ userId, ...body });
export async function update(id, userId, body) { const profile = await StudentProfile.findOneAndUpdate({ _id: id, userId, isActive: true }, { $set: body }, { new: true, runValidators: true }); if (!profile) throw new ApiError(404, 'Student profile not found', 'RESOURCE_NOT_FOUND'); return profile; }
export const remove = (id, userId) => update(id, userId, { isActive: false });
