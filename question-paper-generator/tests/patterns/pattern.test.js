import { parsePattern } from '../../services/patterns/patternParser.service.js';
import { builtIns } from '../../services/patterns/pattern.service.js';
import { difficultyPlan, buildSlots } from '../../services/papers/scoring.service.js';
import { distribution, generationBody } from '../../utils/validators.js';
test('all eight built-ins have consistent counts and marks', () => { expect(builtIns).toHaveLength(8); for (const p of builtIns) { expect(p.totalQuestions).toBe(p.sections.reduce((n, s) => n + s.count, 0)); expect(p.totalMarks).toBe(p.sections.reduce((n, s) => n + s.totalMarks, 0)); } });
test('pattern supports optional equal-mark questions', () => { const p = parsePattern({ sections: [{ type: 'short_answer', count: 5, choiceCount: 2, marksEach: 2 }] }); expect(p.totalMarks).toBe(6); expect(p.totalQuestions).toBe(5); });
test.each([
  { sections: [{ type: 'mcq', count: 0, marksEach: 1 }] },
  { sections: [{ type: 'essay', count: 1, marksEach: 1 }] },
  { sections: [{ type: 'mcq', count: 3, marksEach: -1 }] },
  { sections: [{ type: 'mcq', count: 2, choiceCount: 2, marksEach: 1 }] },
  { sections: [{ type: 'mcq', count: 3, marksEach: 1 }], totalMarks: 99 },
  { sections: [{ type: 'mcq', count: 3, marksEach: 1, totalMarks: 99 }] },
  { sections: [{ name: 'A', type: 'mcq', count: 2, marksEach: 1 }, { name: 'a', type: 'mcq', count: 2, marksEach: 1 }] },
])('rejects invalid pattern %#', value => expect(() => parsePattern(value)).toThrow());
test('difficulty distribution validates sums', () => { expect(() => distribution.parse({ easy: 20, medium: 30, hard: 20 })).toThrow(); expect(distribution.parse({ easy: 30, medium: 50, hard: 20 })).toBeTruthy(); });
test('mixed allocation uses exact deterministic largest-remainder counts', () => { const p = difficultyPlan(10, 'mixed'); expect(p.filter(x => x === 'easy')).toHaveLength(3); expect(p.filter(x => x === 'medium')).toHaveLength(5); expect(p.filter(x => x === 'hard')).toHaveLength(2); expect(difficultyPlan(3, 'mixed')).toHaveLength(3); });
test('generation rejects duplicate chapters, extra userId and ambiguous patterns', () => { const req = { textbookId: 'a'.repeat(24), chapterIds: ['b'.repeat(24)], patternId: 'c'.repeat(24), difficulty: 'easy', durationMinutes: 60 }; expect(generationBody.parse(req)).toBeTruthy(); expect(() => generationBody.parse({ ...req, userId: 'd'.repeat(24) })).toThrow(); expect(() => generationBody.parse({ ...req, chapterIds: [req.chapterIds[0], req.chapterIds[0]] })).toThrow(); });
