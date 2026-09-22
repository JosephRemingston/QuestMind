import mongoose from 'mongoose';
export const { Schema } = mongoose;
export const ref = (model, required = false) => ({ type: Schema.Types.ObjectId, ref: model, required });
export const owner = { ...ref('User'), default: null, index: true };
export const requiredText = { type: String, required: true, trim: true, maxlength: 500 };
export const mixed = Schema.Types.Mixed;
export function model(name, fields, indexes = []) {
  const schema = new Schema(fields, { timestamps: true, strict: 'throw', minimize: false, toJSON: { virtuals: true, transform: (_doc, ret) => { delete ret.__v; return ret; } } });
  for (const [keys, options] of indexes) schema.index(keys, options);
  return mongoose.models[name] || mongoose.model(name, schema);
}
export const sectionSchema = new Schema({ name: String, type: String, count: Number, marksEach: Number, totalMarks: Number, instructions: String, choiceCount: { type: Number, default: 0 } }, { _id: false, versionKey: false, strict: 'throw' });
export const sourceSchema = new Schema({ chapterId: ref('Chapter', true), page: Number, chunkIds: [ref('BookChunk', true)] }, { _id: false, versionKey: false });
export const questionFields = {
  questionNumber: { type: Number, required: true }, sectionIndex: { type: Number, required: true }, type: requiredText,
  question: { type: String, required: true, maxlength: 6000 }, options: [String], correctAnswer: { type: String, required: true, maxlength: 6000 },
  explanation: { type: String, required: true, maxlength: 8000 }, marks: Number, difficulty: String, concept: String,
  source: { type: sourceSchema, required: true }, evidence: String,
};
export const questionSchema = new Schema(questionFields, { _id: false, versionKey: false, strict: 'throw' });
