const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { writeCoreFile } = require('../build-core.cjs');

writeCoreFile();
const base = path.join(__dirname, '..');
const source = ['deploy/Core.gs', 'Service.gs'].map(file => fs.readFileSync(path.join(base, file), 'utf8')).join('\n');
const serviceFactory = vm.runInNewContext(`${source}\n({ app5sCreateService, QUESTIONS })`, { Date, Intl, Object, Number, Array, Map, Set, String, RegExp, Error, TypeError, RangeError });

function harness(iso = '2026-09-21T11:15:00Z') {
  let now = new Date(iso);
  const records = new Map();
  const events = [];
  const service = serviceFactory.app5sCreateService({
    now: () => now,
    load: (stationId, week) => records.get(`${stationId}:${week}`) || null,
    save: inspection => records.set(`${inspection.stationId}:${inspection.week}`, inspection),
    loadPendingKaizen: () => [],
    event: (type, inspection) => events.push({ type, status: inspection.status }),
  });
  return { service, records, events, setNow: value => { now = new Date(value); } };
}

test('una estación mantiene una única inspección y un único editor por semana', () => {
  const h = harness();
  const started = h.service.reserve('bodega', 'phone-a', 'Ana Pérez');
  assert.equal(started.editor.clientId, 'phone-a');
  assert.throws(() => h.service.reserve('bodega', 'phone-b', 'Bruno Díaz'), /reserva/i);
  const answered = h.service.saveAnswer('bodega', 'phone-a', 'SEP-01', 2);
  assert.equal(answered.answers['SEP-01'], 2);
  const released = h.service.release('bodega', 'phone-a');
  assert.equal(released.editor, null);
  assert.equal(h.service.reserve('bodega', 'phone-b', 'Bruno Díaz').startedBy, 'Ana Pérez');
});

test('la toma de control solo se confirma desde el editor sincronizado', () => {
  const h = harness();
  h.service.reserve('bodega', 'phone-a', 'Ana Pérez');
  h.service.requestTakeover('bodega', 'phone-b', 'Bruno Díaz');
  assert.equal(h.service.acknowledgeTakeover('bodega', 'phone-a', 2).editor.clientId, 'phone-a');
  const transferred = h.service.acknowledgeTakeover('bodega', 'phone-a', 0);
  assert.equal(transferred.editor.clientId, 'phone-b');
  assert.equal(transferred.startedBy, 'Ana Pérez');
});

test('el jueves después de las 12 permite retomar solo una inspección iniciada', () => {
  const h = harness();
  h.service.reserve('bodega', 'phone-a', 'Ana Pérez');
  h.service.release('bodega', 'phone-a');
  h.setNow('2026-09-24T15:00:00Z');
  assert.equal(h.service.reserve('bodega', 'phone-b', 'Bruno Díaz').editor.clientId, 'phone-b');
  assert.throws(() => h.service.reserve('oficina', 'phone-c', 'Carla Soto'), /horario/i);
});

test('el viernes formaliza una inspección abierta como vencida sin borrar el avance', () => {
  const h = harness();
  h.service.reserve('bodega', 'phone-a', 'Ana Pérez');
  h.service.saveAnswer('bodega', 'phone-a', 'SEP-01', 0);
  h.setNow('2026-09-25T15:00:00Z');
  const expired = h.service.getState('bodega');
  assert.equal(expired.status, 'expired');
  assert.equal(expired.answers['SEP-01'], 0);
  assert.equal(expired.result.finalScore, 0);
  assert.equal(h.events.at(-1).type, 'VENCIMIENTO');
});

test('el cierre devuelve una nota real y bloquea la misma semana', () => {
  const h = harness('2026-09-24T14:00:00Z');
  h.service.reserve('bodega', 'phone-a', 'Ana Pérez');
  serviceFactory.QUESTIONS.forEach(question => h.service.saveAnswer('bodega', 'phone-a', question.id, 0));
  const closed = h.service.close('bodega', 'phone-a');
  assert.equal(closed.status, 'closed');
  assert.equal(closed.result.finalScore, 5);
  assert.throws(() => h.service.reserve('bodega', 'phone-b', 'Bruno Díaz'), /cerrada/i);
});

test('al reducir hallazgos, el servidor también descarta la evidencia sobrante', () => {
  const h = harness();
  h.service.reserve('bodega', 'phone-a', 'Ana Pérez');
  h.service.saveAnswer('bodega', 'phone-a', 'SEP-01', 2);
  h.service.saveFinding('bodega', 'phone-a', 'SEP-01', 1, { id: 'H-1', photoId: 'drive-1' });
  h.service.saveFinding('bodega', 'phone-a', 'SEP-01', 2, { id: 'H-2', photoId: 'drive-2' });
  h.service.saveAnswer('bodega', 'phone-a', 'SEP-01', 1);

  const next = h.service.discardExtraFindings('bodega', 'phone-a', 'SEP-01');
  assert.deepEqual(JSON.parse(JSON.stringify(next.findings['SEP-01'].map(item => item.id))), ['H-1']);
});

test('acepta el cierre sincronizado después del horario si el teléfono lo registró a tiempo', () => {
  const h = harness();
  h.service.reserve('bodega', 'phone-a', 'Ana Pérez');
  h.setNow('2026-09-25T15:00:00Z');
  serviceFactory.QUESTIONS.forEach(question => h.service.saveAnswer('bodega', 'phone-a', question.id, 0, '2026-09-24T14:30:00Z'));

  const closed = h.service.close('bodega', 'phone-a', '2026-09-24T14:59:00Z');
  assert.equal(closed.status, 'closed');
  assert.equal(closed.closedAt, '2026-09-24T14:59:00.000Z');
  assert.equal(closed.result.completionStatus, 'cumplida');
});

test('recupera una inspección vencida por consulta antes de recibir su cierre local a tiempo', () => {
  const h = harness();
  h.service.reserve('bodega', 'phone-a', 'Ana Pérez');
  h.setNow('2026-09-25T15:00:00Z');
  assert.equal(h.service.getState('bodega').status, 'expired');
  serviceFactory.QUESTIONS.forEach(question => h.service.saveAnswer('bodega', 'phone-a', question.id, 0, '2026-09-24T14:30:00Z'));

  const closed = h.service.close('bodega', 'phone-a', '2026-09-24T14:59:00Z');
  assert.equal(closed.status, 'closed');
  assert.equal(closed.closedAt, '2026-09-24T14:59:00.000Z');
  assert.equal(closed.result.completionStatus, 'cumplida');
});
