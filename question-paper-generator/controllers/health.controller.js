import ApiResponse from '../utils/ApiResponse.js';
import * as s from '../services/operations/health.service.js';
export const health = async (_req, res) => ApiResponse.success(res, 'Service alive', s.health());
export const ready = async (_req, res) => { const data = await s.readiness(); if (!data.ready) return res.status(503).json({ success: false, message: 'Dependencies unavailable', errorCode: 'DEPENDENCY_UNAVAILABLE', data }); return ApiResponse.success(res, 'Service ready', data); };
