import { verifyToken } from '../configs/jwt.js';
import { readSession } from '../services/auth/session.service.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
export const requireAuth = () => async (req, _res, next) => {
  try {
    const header = req.get('authorization');
    if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
    let claims; try { claims = verifyToken(header.slice(7), 'access'); } catch { throw new ApiError(401, 'Invalid or expired access token', 'AUTH_REQUIRED'); }
    const session = await readSession(claims.sid);
    if (!session || session.userId !== claims.sub) throw new ApiError(401, 'Session expired', 'AUTH_REQUIRED');
    const user = await User.findOne({ _id: claims.sub, isActive: true });
    if (!user) throw new ApiError(401, 'Account unavailable', 'AUTH_REQUIRED');
    req.user = user; req.auth = claims; next();
  } catch (error) { next(error instanceof ApiError ? error : new ApiError(503, 'Authentication temporarily unavailable', 'DEPENDENCY_UNAVAILABLE')); }
};
export const requireRole = (...roles) => (req, _res, next) => next(roles.includes(req.user?.role) ? undefined : new ApiError(403, 'Insufficient permissions', 'FORBIDDEN'));
