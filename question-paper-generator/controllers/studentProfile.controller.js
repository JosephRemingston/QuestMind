import ApiResponse from '../utils/ApiResponse.js';
import * as s from '../services/auth/studentProfile.service.js';
export const list = async (req, res) => ApiResponse.success(res, 'Student profiles', await s.list(req.user.id, req.validated.query));
export const create = async (req, res) => ApiResponse.success(res, 'Student profile created', await s.create(req.user.id, req.validated.body), 201);
export const update = async (req, res) => ApiResponse.success(res, 'Student profile updated', await s.update(req.params.id, req.user.id, req.validated.body));
export const remove = async (req, res) => { await s.remove(req.params.id, req.user.id); return ApiResponse.success(res, 'Student profile removed'); };
