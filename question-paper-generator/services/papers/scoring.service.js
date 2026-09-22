export function difficultyPlan(count, difficulty, distribution = { easy: 30, medium: 50, hard: 20 }) {
  if (difficulty !== 'mixed') return Array(count).fill(difficulty);
  const levels = ['easy', 'medium', 'hard'];
  const buckets = levels.map((level, i) => ({ level, i, count: Math.floor(count * distribution[level] / 100), remainder: count * distribution[level] % 100 }));
  let remainder = count - buckets.reduce((n, b) => n + b.count, 0);
  for (const bucket of [...buckets].sort((a, b) => b.remainder - a.remainder || a.i - b.i)) if (remainder-- > 0) bucket.count++;
  const plan = []; while (plan.length < count) for (const b of buckets) if (b.count > 0) { plan.push(b.level); b.count--; }
  return plan;
}
export function buildSlots(pattern, difficulty, distribution) {
  const levels = difficultyPlan(pattern.totalQuestions, difficulty, distribution), slots = [];
  pattern.sections.forEach((section, sectionIndex) => { for (let i = 0; i < section.count; i++) slots.push({ questionNumber: slots.length + 1, sectionIndex, type: section.type, marks: section.marksEach, difficulty: levels[slots.length] }); });
  return slots;
}
export function balanceMcqAnswers(questions) {
  let index = 0;
  return questions.map(q => {
    if (!['mcq', 'assertion_reason'].includes(q.type)) return q;
    const answer = q.correctAnswer, target = index++ % q.options.length, options = q.options.filter(o => o !== answer); options.splice(target, 0, answer);
    return { ...q, options }; // Answer text is retained, so correctness does not depend on option position.
  });
}
