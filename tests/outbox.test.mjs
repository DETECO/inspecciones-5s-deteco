import test from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeOutbox, appendOutbox, pendingOutbox } from '../client/outbox.mjs';

const answer = {
  id: 'op-answer-0001',
  operation: 'save-answer',
  payload: { stationId: 'bodega', questionId: 'SEP-01', count: 1 },
};

const finding = {
  id: 'op-finding-0002',
  operation: 'save-finding',
  payload: { stationId: 'bodega', questionId: 'SEP-01', ordinal: 1, finding: { id: 'H-1' } },
};

test('la cola mantiene el orden de respuesta y fotografía mientras no hay conexión', () => {
  const queued = appendOutbox(appendOutbox([], answer), finding);
  assert.deepEqual(pendingOutbox(queued).map(item => item.id), ['op-answer-0001', 'op-finding-0002']);
});

test('solo elimina la operación confirmada que está al inicio de la cola', () => {
  const queued = appendOutbox(appendOutbox([], answer), finding);
  assert.throws(() => acknowledgeOutbox(queued, 'op-finding-0002'), /orden/i);
  assert.deepEqual(acknowledgeOutbox(queued, 'op-answer-0001').map(item => item.id), ['op-finding-0002']);
});

test('no acepta una operación sin identificador, tipo ni datos de envío', () => {
  assert.throws(() => appendOutbox([], { id: '', operation: 'save-answer', payload: {} }), /cola/i);
  assert.throws(() => appendOutbox([], { id: 'op-12345678', operation: '', payload: {} }), /cola/i);
  assert.throws(() => appendOutbox([], { id: 'op-12345678', operation: 'save-answer' }), /cola/i);
});
