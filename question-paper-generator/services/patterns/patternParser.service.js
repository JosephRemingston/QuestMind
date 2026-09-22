import { patternBody } from '../../utils/validators.js';
import { env } from '../../configs/env.js';
import ApiError from '../../utils/ApiError.js';
export function parsePattern(input) {
  // Accept the analyzer's questionType spelling only at this boundary.
  const normalized = { ...input, name: input.name ?? 'Extracted Pattern', sections: input.sections?.map(s => { const { questionType, totalMarks, ...rest } = s; return { ...rest, type: rest.type ?? questionType }; }) };
  let parsed; try { parsed = patternBody.parse(normalized); } catch { throw new ApiError(400, 'Invalid question pattern', 'INVALID_PATTERN'); }
  const sections = parsed.sections.map((s, i) => ({ ...s, name: s.name ?? `Section ${String.fromCharCode(65 + i)}`, totalMarks: (s.count - s.choiceCount) * s.marksEach }));
  const totalMarks = sections.reduce((n, s) => n + s.totalMarks, 0), totalQuestions = sections.reduce((n, s) => n + s.count, 0);
  if (sections.some(s => s.choiceCount >= s.count) || totalQuestions > env.MAX_QUESTIONS_PER_PAPER || (input.totalMarks !== undefined && input.totalMarks !== totalMarks) || new Set(sections.map(s => s.name.toLowerCase())).size !== sections.length) throw new ApiError(400, 'Pattern totals or section names are invalid', 'INVALID_PATTERN');
  for (let i = 0; i < sections.length; i++) if (input.sections[i].totalMarks !== undefined && input.sections[i].totalMarks !== sections[i].totalMarks) throw new ApiError(400, 'Section marks do not match', 'INVALID_PATTERN');
  return { name: parsed.name, sections, totalMarks, totalQuestions, ...(parsed.difficultyDistribution ? { difficultyDistribution: parsed.difficultyDistribution } : {}) };
}
