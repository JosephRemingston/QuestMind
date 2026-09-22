import User from '../../models/User.js';
import { publicUser } from './otp.service.js';
export async function updateProfile(userId, fields) { return publicUser(await User.findByIdAndUpdate(userId, { $set: fields }, { new: true, runValidators: true })); }
