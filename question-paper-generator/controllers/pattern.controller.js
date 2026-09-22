import ApiResponse from '../utils/ApiResponse.js';
import * as s from '../services/patterns/pattern.service.js';
export const list = async (req, res) => ApiResponse.success(res, 'Patterns', await s.listPatterns(req.user.id, req.validated.query));
export const details = async (req, res) => ApiResponse.success(res, 'Pattern', await s.getPattern(req.params.id, req.user.id));
export const create = async (req, res) => ApiResponse.success(res, 'Pattern created', await s.createPattern(req.user.id, req.validated.body), 201);
export const update = async (req, res) => ApiResponse.success(res, 'Pattern updated', await s.updatePattern(req.params.id, req.user.id, req.validated.body));
export const remove = async (req, res) => { await s.deletePattern(req.params.id, req.user.id); return ApiResponse.success(res, 'Pattern deleted'); };
