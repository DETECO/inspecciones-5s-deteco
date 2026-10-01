import test from 'node:test';
import assert from 'node:assert/strict';
import * as catalog from '../domain/catalog.mjs';
import { createInspection, reserveInspection, saveAnswer, saveFinding, closeInspection } from '../domain/inspection.mjs';

function inspection(applicable) {
  const state = reserveInspection(createInspection({ stationId: 'oficina', week: '2026-W40' }), { clientId: 'phone-a', inspectorName: 'Inspector', at: '2026-09-30T14:00:00Z' });
  state.dailyManagementApplicable = applicable;
  state.answers = Object.fromEntries(catalog.QUESTIONS.map(q => [q.id, 0]));
  return state;
}
const close = state => closeInspection(state, { clientId: 'phone-a', at: '2026-09-30T15:00:00Z' });

test('catálogo GD contiene ocho preguntas sin alterar las 25 preguntas 5S', () => {
  assert.equal(catalog.QUESTIONS.length, 25);
  assert.equal(catalog.DAILY_MANAGEMENT?.questions.length, 8);
  assert.equal(catalog.getQuestion('GD-01').moduleId, 'gerenciamiento-diario');
});

test('sin decisión de aplicabilidad no permite el cierre del nuevo recorrido', () => {
  assert.throws(() => close(inspection(null)), /Gerenciamiento Diario/);
});

test('No aplica permite cierre con 25 respuestas y nota GD vacía', () => {
  const closed = close(inspection(false));
  assert.equal(closed.result.finalScore, 5);
  assert.deepEqual(closed.result.dailyManagement, { applicable: false, score: null });
});

test('Sí requiere las ocho respuestas GD y calcula nota separada', () => {
  let state = inspection(true);
  assert.throws(() => close(state), /respuesta/);
  for (let i = 1; i <= 8; i++) state = saveAnswer(state, { clientId: 'phone-a', questionId: `GD-0${i}`, count: 0 });
  state = saveAnswer(state, { clientId: 'phone-a', questionId: 'GD-01', count: 1 });
  assert.throws(() => close(state), /fotografía/);
  state = saveFinding(state, { clientId: 'phone-a', questionId: 'GD-01', ordinal: 1, finding: { id: 'gd-finding', photoId: 'drive-photo' } });
  const closed = close(state);
  assert.equal(closed.result.finalScore, 5);
  assert.equal(closed.result.dailyManagement.score, 4.875);
  assert.equal(Object.keys(closed.result.moduleScores).length, 5);
});

test('No aplica rechaza respuestas GD ocultas y legado queda no evaluado', () => {
  const state = inspection(false);
  state.answers['GD-01'] = 0;
  assert.throws(() => close(state), /Gerenciamiento Diario/);
  delete state.dailyManagementApplicable;
  delete state.answers['GD-01'];
  assert.deepEqual(close(state).result.dailyManagement, { applicable: null, score: null });
});
