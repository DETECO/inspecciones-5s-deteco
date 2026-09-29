import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../domain/catalog.mjs';
import { scoreInspection, validateInspection } from '../domain/scoring.mjs';

const uniform = count => Object.fromEntries(QUESTIONS.map(question => [question.id, count]));

test('sin hallazgos, cada módulo y la nota final son 5,0', () => {
  const result = scoreInspection(uniform(0));
  assert.deepEqual(Object.values(result.moduleScores), [5, 5, 5, 5, 5]);
  assert.equal(result.finalScore, 5);
});

test('cinco hallazgos por pregunta dan nota cero', () => {
  const result = scoreInspection(uniform(5));
  assert.deepEqual(Object.values(result.moduleScores), [0, 0, 0, 0, 0]);
  assert.equal(result.finalScore, 0);
});

test('la nota final promedia cinco módulos, no veinticinco preguntas planas', () => {
  const answers = uniform(0);
  answers['SEP-01'] = 5;
  const result = scoreInspection(answers);
  assert.equal(result.moduleScores.separar, 3.75);
  assert.equal(result.finalScore, 4.75);
});

test('no calcula nota con respuesta omitida, fraccional o fuera de 0 a 5', () => {
  const missing = uniform(0);
  delete missing['LIM-01'];
  assert.throws(() => scoreInspection(missing), /25 respuestas|incompleta/i);
  for (const invalid of [-1, 1.5, 6, '3']) {
    const answers = uniform(0);
    answers['ORG-01'] = invalid;
    assert.throws(() => scoreInspection(answers), /0 a 5|entero/i);
  }
});

test('el cierre exige una fotografía ya sincronizada por hallazgo', () => {
  const answers = uniform(0);
  answers['SEP-02'] = 2;
  const findings = { 'SEP-02': [{ id: 'H-1', photoId: 'drive-1' }, { id: 'H-2', photoId: '' }] };
  const result = validateInspection(answers, findings);
  assert.deepEqual(result.missingQuestions, []);
  assert.deepEqual(result.invalidQuestions, []);
  assert.deepEqual(result.missingPhotos, [{ questionId: 'SEP-02', ordinal: 2 }]);
  assert.equal(result.canClose, false);
  findings['SEP-02'][1].photoId = 'drive-2';
  assert.equal(validateInspection(answers, findings).canClose, true);
});

test('si se reduce un número de hallazgos, identifica evidencia sobrante para confirmación', () => {
  const answers = uniform(0);
  answers['SEP-02'] = 1;
  const findings = { 'SEP-02': [{ id: 'H-1', photoId: 'drive-1' }, { id: 'H-2', photoId: 'drive-2' }] };
  const result = validateInspection(answers, findings);
  assert.deepEqual(result.extraFindings, [{ questionId: 'SEP-02', count: 1 }]);
  assert.equal(result.canClose, false);
});
