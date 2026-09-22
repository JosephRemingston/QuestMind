import ApiResponse from '../utils/ApiResponse.js';
import * as s from '../services/patterns/samplePaper.service.js';
export const upload = async (req, res) => ApiResponse.success(res, 'Sample queued for analysis', await s.uploadSample(req.user.id, req.validated.body.title, req.file), 202);
export const list = async (req, res) => ApiResponse.success(res, 'Sample papers', await s.listSamples(req.user.id, req.validated.query));
export const details = async (req, res) => ApiResponse.success(res, 'Sample paper', await s.getSample(req.params.id, req.user.id));
