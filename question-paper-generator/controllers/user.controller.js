import ApiResponse from '../utils/ApiResponse.js';
import { updateProfile } from '../services/auth/user.service.js';
export const update = async (req, res) => ApiResponse.success(res, 'Profile updated', await updateProfile(req.user.id, req.validated.body));
