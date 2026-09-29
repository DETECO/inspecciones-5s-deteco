import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../domain/catalog.mjs';
import {
  createInspection,
  reserveInspection,
  requestTakeover,
  acknowledgeTakeover,
  saveAnswer,
  saveFinding,
  discardExtraFindings,
  releaseInspection,
  closeInspection,
  expireInspection,
} from '../domain/inspection.mjs';

const newInspection = options => createInspection({ stationId: 'bodega', week: '2026-W39', ...options });
const filledAnswers = state => QUESTIONS.reduce((next, question) => saveAnswer(next, {
  clientId: 'phone-a', questionId: question.id, count: 0,
}), state);

test('la primera reserva asigna un editor y conserva al responsable inicial', () => {
  const initial = newInspection();
  const reserved = reserveInspection(initial, { clientId: 'phone-a', inspectorName: 'Ana Pérez', at: '2026-09-21T11:15:00Z' });

  assert.equal(reserved.status, 'open');
  assert.deepEqual(reserved.editor, { clientId: 'phone-a', inspectorName: 'Ana Pérez' });
  assert.equal(reserved.startedBy, 'Ana Pérez');
  assert.throws(() => reserveInspection(reserved, { clientId: 'phone-b', inspectorName: 'Bruno Díaz' }), /reserva activa/i);
});

test('un inspector distinto en el mismo teléfono se registra al retomar y conserva al responsable inicial', () => {
  let state = reserveInspection(newInspection(), { clientId: 'phone-a', inspectorName: 'Ana Pérez' });
  state = reserveInspection(state, { clientId: 'phone-a', inspectorName: 'Bruno Díaz' });
  assert.equal(state.startedBy, 'Ana Pérez');
  assert.equal(state.editor.inspectorName, 'Bruno Díaz');
  assert.deepEqual(state.continuedBy, ['Bruno Díaz']);
});

test('la toma de control espera una cola local vacía y no sustituye al responsable inicial', () => {
  let state = reserveInspection(newInspection(), { clientId: 'phone-a', inspectorName: 'Ana Pérez' });
  state = requestTakeover(state, { clientId: 'phone-b', inspectorName: 'Bruno Díaz', at: '2026-09-22T11:00:00Z' });
  assert.equal(state.takeover.requestedBy, 'phone-b');

  const waiting = acknowledgeTakeover(state, { clientId: 'phone-a', pendingSyncOps: 1 });
  assert.equal(waiting.editor.clientId, 'phone-a');
  const transferred = acknowledgeTakeover(waiting, { clientId: 'phone-a', pendingSyncOps: 0, at: '2026-09-22T11:01:00Z' });
  assert.deepEqual(transferred.editor, { clientId: 'phone-b', inspectorName: 'Bruno Díaz' });
  assert.equal(transferred.startedBy, 'Ana Pérez');
  assert.deepEqual(transferred.continuedBy, ['Bruno Díaz']);
});

test('solo el teléfono editor puede modificar respuestas y hallazgos', () => {
  let state = reserveInspection(newInspection(), { clientId: 'phone-a', inspectorName: 'Ana Pérez' });
  assert.throws(() => saveAnswer(state, { clientId: 'phone-b', questionId: 'SEP-01', count: 2 }), /reserva/i);
  state = saveAnswer(state, { clientId: 'phone-a', questionId: 'SEP-01', count: 1 });
  assert.equal(state.answers['SEP-01'], 1);
  assert.throws(() => saveFinding(state, { clientId: 'phone-b', questionId: 'SEP-01', ordinal: 1, finding: { id: 'H-1', photoId: 'drive-1' } }), /reserva/i);
  state = saveFinding(state, { clientId: 'phone-a', questionId: 'SEP-01', ordinal: 1, finding: { id: 'H-1', photoId: 'drive-1' } });
  assert.equal(state.findings['SEP-01'][0].photoId, 'drive-1');
});

test('cerrar exige respuestas, fotos y decisiones de kaizen completas', () => {
  let state = reserveInspection(newInspection({ pendingKaizen: [{ id: 'K-1', stationId: 'bodega', status: 'open' }] }), { clientId: 'phone-a', inspectorName: 'Ana Pérez' });
  state = filledAnswers(state);
  assert.throws(() => closeInspection(state, { clientId: 'phone-a', at: '2026-09-24T14:00:00Z' }), /kaizen/i);

  state = { ...state, kaizenReviews: { 'K-1': { decision: 'pending', reason: 'Esperando repuesto' } } };
  const closed = closeInspection(state, { clientId: 'phone-a', at: '2026-09-24T14:00:00Z', completionStatus: 'cumplida' });
  assert.equal(closed.status, 'closed');
  assert.equal(closed.result.finalScore, 5);
  assert.equal(closed.result.completionStatus, 'cumplida');
  assert.throws(() => saveAnswer(closed, { clientId: 'phone-a', questionId: 'SEP-01', count: 1 }), /cerrada/i);
});

test('un hallazgo sin foto no permite cerrar', () => {
  let state = reserveInspection(newInspection(), { clientId: 'phone-a', inspectorName: 'Ana Pérez' });
  state = filledAnswers(state);
  state = saveAnswer(state, { clientId: 'phone-a', questionId: 'SEP-02', count: 1 });
  assert.throws(() => closeInspection(state, { clientId: 'phone-a' }), /fotograf/i);
});

test('al reducir hallazgos, las evidencias sobrantes solo se quitan tras confirmación explícita', () => {
  let state = reserveInspection(newInspection(), { clientId: 'phone-a', inspectorName: 'Ana Pérez' });
  state = saveAnswer(state, { clientId: 'phone-a', questionId: 'SEP-01', count: 2 });
  state = saveFinding(state, { clientId: 'phone-a', questionId: 'SEP-01', ordinal: 1, finding: { id: 'H-1', photoId: 'drive-1' } });
  state = saveFinding(state, { clientId: 'phone-a', questionId: 'SEP-01', ordinal: 2, finding: { id: 'H-2', photoId: 'drive-2' } });
  state = saveAnswer(state, { clientId: 'phone-a', questionId: 'SEP-01', count: 1 });
  assert.equal(state.findings['SEP-01'].length, 2);
  state = discardExtraFindings(state, { clientId: 'phone-a', questionId: 'SEP-01' });
  assert.deepEqual(state.findings['SEP-01'].map(item => item.id), ['H-1']);
});

test('guardar y salir libera la reserva sin borrar el avance sincronizado', () => {
  let state = reserveInspection(newInspection(), { clientId: 'phone-a', inspectorName: 'Ana Pérez' });
  state = saveAnswer(state, { clientId: 'phone-a', questionId: 'SEP-01', count: 0 });
  const released = releaseInspection(state, { clientId: 'phone-a', at: '2026-09-22T12:00:00Z' });
  assert.equal(released.status, 'open');
  assert.equal(released.editor, null);
  assert.equal(released.answers['SEP-01'], 0);
  const resumed = reserveInspection(released, { clientId: 'phone-b', inspectorName: 'Bruno Díaz' });
  assert.equal(resumed.editor.clientId, 'phone-b');
  assert.equal(resumed.startedBy, 'Ana Pérez');
});

test('al vencer, conserva evidencia parcial y deja todas las notas en cero', () => {
  let state = reserveInspection(newInspection(), { clientId: 'phone-a', inspectorName: 'Ana Pérez' });
  state = saveAnswer(state, { clientId: 'phone-a', questionId: 'SEP-01', count: 0 });
  const expired = expireInspection(state, { at: '2026-09-24T20:00:00Z' });

  assert.equal(expired.status, 'expired');
  assert.equal(expired.startedBy, 'Ana Pérez');
  assert.equal(expired.answers['SEP-01'], 0);
  assert.deepEqual(Object.values(expired.result.moduleScores), [0, 0, 0, 0, 0]);
  assert.equal(expired.result.finalScore, 0);
  assert.equal(expired.result.completionStatus, 'vencida-cerrada-incompleta');
});
