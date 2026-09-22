export const buildAnswerKey = questions => questions.map(q => ({ questionNumber: q.questionNumber, correctAnswer: q.correctAnswer, explanation: q.explanation, marks: q.marks, source: q.source }));
