import ApiResponse from '../utils/ApiResponse.js';
import * as otp from '../services/auth/otp.service.js';
import { refreshTokens } from '../services/auth/token.service.js';
import { revokeSession } from '../services/auth/session.service.js';
export const sendOtp = async (req, res) => ApiResponse.success(res, 'OTP sent', await otp.sendOtp(req.validated.body.phoneNumber));
export const verifyOtp = async (req, res) => ApiResponse.success(res, 'Signed in', await otp.verifyOtp(req.validated.body.phoneNumber, req.validated.body.code));
export const refresh = async (req, res) => ApiResponse.success(res, 'Tokens refreshed', await refreshTokens(req.validated.body.refreshToken));
export const logout = async (req, res) => { await revokeSession(req.auth.sid); return ApiResponse.success(res, 'Signed out'); };
export const me = async (req, res) => ApiResponse.success(res, 'Profile', otp.publicUser(req.user));
