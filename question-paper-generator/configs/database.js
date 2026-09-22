import mongoose from 'mongoose';
import { env } from './env.js';
mongoose.set('strictQuery', true);
export default async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(env.MONGO_URI, { dbName: env.MONGO_DB_NAME, autoIndex: env.NODE_ENV !== 'production', serverSelectionTimeoutMS: 5000, maxPoolSize: 20 });
  return mongoose.connection;
}
export const transaction = fn => mongoose.connection.transaction(fn);
export const closeDB = () => mongoose.disconnect();
