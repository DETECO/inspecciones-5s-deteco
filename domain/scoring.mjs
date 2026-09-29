import { MODULES, QUESTIONS } from './catalog.mjs';

const validCount = value => Number.isInteger(value) && value >= 0 && value <= 5;
const questionIds = new Set(QUESTIONS.map(question => question.id));

export function scoreInspection(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new TypeError('La inspección está incompleta: se requieren 25 respuestas.');
  }

  const moduleScores = {};
  for (const module of MODULES) {
    let points = 0;
    for (const question of module.questions) {
      if (!Object.hasOwn(answers, question.id)) {
        throw new Error('La inspección está incompleta: se requieren 25 respuestas.');
      }
      const count = answers[question.id];
      if (!validCount(count)) {
        throw new RangeError(`Los hallazgos de ${question.id} deben ser un entero de 0 a 5.`);
      }
      points += 5 - count;
    }
    moduleScores[module.id] = points / module.questions.length;
  }

  return {
    moduleScores,
    finalScore: Object.values(moduleScores).reduce((sum, score) => sum + score, 0) / MODULES.length,
  };
}

export function validateInspection(answers, findings = {}) {
  const missingQuestions = [];
  const invalidQuestions = [];
  const missingPhotos = [];
  const extraFindings = [];
  const answerMap = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  const findingMap = findings && typeof findings === 'object' && !Array.isArray(findings) ? findings : {};

  for (const question of QUESTIONS) {
    if (!Object.hasOwn(answerMap, question.id) || answerMap[question.id] === null || answerMap[question.id] === '') {
      missingQuestions.push(question.id);
      continue;
    }
    const count = answerMap[question.id];
    if (!validCount(count)) {
      invalidQuestions.push(question.id);
      continue;
    }

    const items = Array.isArray(findingMap[question.id]) ? findingMap[question.id] : [];
    for (let index = 0; index < count; index += 1) {
      if (typeof items[index]?.photoId !== 'string' || !items[index].photoId.trim()) {
        missingPhotos.push({ questionId: question.id, ordinal: index + 1 });
      }
    }
    if (items.length > count) {
      extraFindings.push({ questionId: question.id, count: items.length - count });
    }
  }

  for (const [id, items] of Object.entries(findingMap)) {
    if (!questionIds.has(id) && Array.isArray(items) && items.length > 0) {
      extraFindings.push({ questionId: id, count: items.length });
    }
  }

  return {
    missingQuestions,
    invalidQuestions,
    missingPhotos,
    extraFindings,
    canClose: !missingQuestions.length && !invalidQuestions.length && !missingPhotos.length && !extraFindings.length,
  };
}
