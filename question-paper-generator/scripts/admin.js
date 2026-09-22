import connectDB, { closeDB } from '../configs/database.js';
import User from '../models/User.js';
import { phone } from '../utils/validators.js';
import { ROLES } from '../utils/constants.js';
const phoneNumber = phone.parse(process.argv[2]), role = process.argv[3] ?? 'admin';
if (!ROLES.includes(role)) throw new Error('Usage: npm run admin -- +919876543210 admin|teacher|parent|student');
await connectDB();
try { const user = await User.findOneAndUpdate({ phoneNumber }, { $set: { role } }); if (!user) throw new Error('The user must complete OTP login first'); console.log(`Role updated to ${role}`); } finally { await closeDB(); }
