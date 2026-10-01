import { QUESTIONS, DAILY_MANAGEMENT } from './catalog.mjs?v=20261001-gd';

export function inspectionQuestions(state) {
  const applicable = state.dailyManagementApplicable;
  // Undefined identifies a legacy client, not an explicit No.
  if (applicable !== undefined && typeof applicable !== 'boolean') {
    throw new Error('Falta indicar si corresponde Gerenciamiento Diario.');
  }
  return applicable === true ? [...QUESTIONS, ...DAILY_MANAGEMENT.questions] : QUESTIONS;
}

export function dailyManagementResult(state) {
  inspectionQuestions(state);
  if (state.dailyManagementApplicable !== true) {
    if (DAILY_MANAGEMENT.questions.some(q => Object.hasOwn(state.answers, q.id) || state.findings[q.id]?.length)) {
      throw new Error('Gerenciamiento Diario no corresponde; hay respuestas o fotos de ese módulo.');
    }
    return { applicable: state.dailyManagementApplicable ?? null, score: null };
  }
  return { applicable: true, score: DAILY_MANAGEMENT.questions.reduce((total, q) => total + 5 - state.answers[q.id], 0) / DAILY_MANAGEMENT.questions.length };
}
