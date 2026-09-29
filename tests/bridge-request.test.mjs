import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBridgeRequest, decodeBridgePayload } from '../transport/bridge-request.mjs';

const request = {
  operation: 'save-answer',
  requestId: 'r'.repeat(24),
  nonce: 'n'.repeat(24),
  accessToken: 't'.repeat(32),
  payload: { stationId: 'bodega', clientId: 'phone-a', questionId: 'SEP-01', count: 2 },
};

test('el envío al puente lleva un único sobre con ID, nonce y acceso', () => {
  const envelope = makeBridgeRequest(request);
  assert.deepEqual(Object.keys(envelope).sort(), ['nonce', 'operation', 'payload', 'requestId']);
  assert.equal(envelope.operation, 'save-answer');
  assert.deepEqual(decodeBridgePayload(envelope.payload), {
    accessToken: request.accessToken,
    stationId: 'bodega',
    clientId: 'phone-a',
    questionId: 'SEP-01',
    count: 2,
  });
});

test('no permite operaciones o identificadores que el servidor no podrá validar', () => {
  assert.throws(() => makeBridgeRequest({ ...request, operation: 'delete-all' }), /operación/i);
  assert.throws(() => makeBridgeRequest({ ...request, requestId: 'corto' }), /solicitud/i);
  assert.throws(() => makeBridgeRequest({ ...request, nonce: 'corto' }), /nonce/i);
  assert.throws(() => makeBridgeRequest({ ...request, accessToken: 'corto' }), /QR/i);
});

test('permite ordenar el descarte confirmado de evidencia sobrante', () => {
  const envelope = makeBridgeRequest({
    ...request,
    operation: 'discard-extra-findings',
    payload: { stationId: 'bodega', clientId: 'phone-a', questionId: 'SEP-01' },
  });
  assert.equal(envelope.operation, 'discard-extra-findings');
});

test('un payload manipulado no se convierte en una operación válida', () => {
  assert.throws(() => decodeBridgePayload('%%%'), /payload/i);
  assert.throws(() => decodeBridgePayload('W10='), /payload/i);
});
