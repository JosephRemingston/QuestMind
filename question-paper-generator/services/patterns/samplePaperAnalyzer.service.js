import SamplePaper from '../../models/SamplePaper.js';
import QuestionPattern from '../../models/QuestionPattern.js';
import { getObject } from '../storage/s3.service.js';
import { extractPdf } from '../textbooks/extraction.service.js';
import { generateStructuredOutput } from '../ai/llm.service.js';
import { SOURCE_POLICY, sourceBoundary } from '../security/promptInjection.service.js';
import { parsePattern } from './patternParser.service.js';
import { QUESTION_TYPES } from '../../utils/constants.js';
import { transaction } from '../../configs/database.js';
import { env } from '../../configs/env.js';
import ApiError from '../../utils/ApiError.js';
const schema = { type: 'object', additionalProperties: false, properties: {
  name: { type: 'string' }, totalMarks: { type: 'number' }, sections: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, questionType: { type: 'string', enum: QUESTION_TYPES }, count: { type: 'integer' }, marksEach: { type: 'number' }, totalMarks: { type: 'number' }, instructions: { type: 'string' }, choiceCount: { type: 'integer' } }, required: ['name', 'questionType', 'count', 'marksEach', 'totalMarks', 'instructions', 'choiceCount'] } },
  difficultySignals: { type: 'string' }, numbering: { type: 'string' }, caseStudyStructure: { type: 'string' }, unsupportedStructure: { type: 'boolean' },
}, required: ['name', 'totalMarks', 'sections', 'difficultySignals', 'numbering', 'caseStudyStructure', 'unsupportedStructure'] };
export async function analyzeSampleText(text, signal) {
  const analyzed = await generateStructuredOutput({ systemPrompt: `${SOURCE_POLICY} Extract only question paper STRUCTURE, not factual content or actual questions. Detect sections, types, counts, marks, numbering, optional choices and case-study structure. count means total offered questions; choiceCount means offered questions that may be omitted. totalMarks is required attempted marks. Split mixed-type sections into homogeneous sections. Mark unsupportedStructure true for choices across sections or unequal-mark alternatives. Do not invent a structure from insufficient text.`, userPrompt: sourceBoundary('SAMPLE_CONTENT', text), schema, signal });
  if (analyzed.unsupportedStructure) throw new ApiError(422, 'This sample has unsupported cross-section or unequal-mark choices; create a custom pattern', 'INVALID_PATTERN');
  const { difficultySignals, numbering, caseStudyStructure, unsupportedStructure, ...pattern } = analyzed;
  return { ...parsePattern(pattern), analysis: { difficultySignals, numbering, caseStudyStructure } };
}
export async function analyzeSample(samplePaperId, signal) {
  const sample = await SamplePaper.findById(samplePaperId).select('+s3Key');
  if (!sample || sample.processingStatus === 'ready') return;
  await SamplePaper.updateOne({ _id: samplePaperId }, { $set: { processingStatus: 'processing' } });
  const extracted = await extractPdf(await getObject(sample.s3Key, env.MAX_SAMPLE_PAPER_SIZE_MB * 1024 * 1024, signal), signal);
  const text = extracted.pages.map(p => p.text).join('\n');
  if (Buffer.byteLength(text) > 30000) throw new ApiError(422, 'Sample paper text exceeds the analysis budget', 'INVALID_PATTERN');
  const pattern = await analyzeSampleText(text, signal);
  await transaction(async session => {
    const created = await QuestionPattern.findOneAndUpdate({ samplePaperId }, { $setOnInsert: { ...pattern, userId: sample.userId } }, { upsert: true, new: true, session });
    await SamplePaper.updateOne({ _id: samplePaperId }, { $set: { analyzedPattern: pattern, patternId: created._id, processingStatus: 'ready' }, $unset: { processingError: 1 } }, { session });
  });
}
