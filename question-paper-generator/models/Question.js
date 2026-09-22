import { model, ref, questionFields } from './shared.js';
export default model('Question', { userId: ref('User', true), questionPaperId: ref('QuestionPaper', true), ...questionFields }, [[{ questionPaperId: 1, questionNumber: 1 }, { unique: true }]]);
