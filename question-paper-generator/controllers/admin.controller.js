import ApiResponse from '../utils/ApiResponse.js';
import { uploadCatalogContent } from '../services/textbooks/upload.service.js';
import { queueSync } from '../services/operations/admin.service.js';
export const uploadContent = async (req, res) => ApiResponse.success(res, 'Catalog content queued', await uploadCatalogContent(req.user.id, req.params.id, req.file), 202);
export const sync = async (req, res) => ApiResponse.success(res, 'Catalog synchronization queued', await queueSync(req.validated.params.source, req.user.id), 202);
