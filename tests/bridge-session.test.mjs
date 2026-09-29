import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridgeSession } from '../client/bridge-session.mjs';

function bridgeThat(receipts) {
  const calls = [];
  return {
    calls,
    bridge: {
      send: async request => {
        calls.push(request);
        const next = receipts.shift();
        if (next instanceof Error) throw next;
        return next || { state: { status: 'open' } };
      },
    },
  };
}

test('envía las operaciones offline en el mismo orden y con su ID estable', async () => {
  const fake = bridgeThat([{ state: { answers: { 'SEP-01': 1 } } }, { state: { findings: { 'SEP-01': [{ id: 'H-1' }] } } }]);
  let nextId = 1;
  const session = createBridgeSession({
    bridge: fake.bridge,
    stationId: 'bodega',
    accessToken: 't'.repeat(32),
    clientId: 'phone-a',
    operationId: () => `operation-${nextId++}-abcdefgh`,
  });
  session.enqueue('save-answer', { questionId: 'SEP-01', count: 1 });
  session.enqueue('save-finding', { questionId: 'SEP-01', ordinal: 1, finding: { id: 'H-1' } });

  const receipts = await session.flush();
  assert.equal(session.pending().length, 0);
  assert.deepEqual(fake.calls.map(call => [call.operation, call.requestId, call.payload.stationId, call.payload.clientId]), [
    ['save-answer', 'operation-1-abcdefgh', 'bodega', 'phone-a'],
    ['save-finding', 'operation-2-abcdefgh', 'bodega', 'phone-a'],
  ]);
  assert.deepEqual(receipts.map(receipt => receipt.state), [
    { answers: { 'SEP-01': 1 } },
    { findings: { 'SEP-01': [{ id: 'H-1' }] } },
  ]);
});

test('si falla el envío conserva la operación pendiente para reintentarla', async () => {
  const fake = bridgeThat([new Error('Sin conexión')]);
  const session = createBridgeSession({
    bridge: fake.bridge,
    stationId: 'bodega',
    accessToken: 't'.repeat(32),
    clientId: 'phone-a',
    operationId: () => 'operation-1-abcdefgh',
  });
  session.enqueue('save-answer', { questionId: 'SEP-01', count: 1 });

  await assert.rejects(session.flush(), /conexión/i);
  assert.deepEqual(session.pending().map(item => item.id), ['operation-1-abcdefgh']);
});

test('confirma y entrega cada resultado antes de pasar a la operación siguiente', async () => {
  const fake = bridgeThat([{ state: { version: 1 } }, { state: { version: 2 } }]);
  const session = createBridgeSession({
    bridge: fake.bridge,
    stationId: 'bodega',
    accessToken: 't'.repeat(32),
    clientId: 'phone-a',
    operationId: (() => { let id = 0; return () => `operation-${++id}-abcdefgh`; })(),
  });
  session.enqueue('save-answer', { questionId: 'SEP-01', count: 1 });
  session.enqueue('save-answer', { questionId: 'SEP-02', count: 0 });
  const observed = [];

  await session.flush({ onReceipt: receipt => observed.push([receipt.state.version, session.pending().length]) });
  assert.deepEqual(observed, [[1, 1], [2, 0]]);
});

test('una lectura de estado no entra a la cola y usa el acceso QR del puente', async () => {
  const fake = bridgeThat([{ state: { status: 'new' } }]);
  const session = createBridgeSession({
    bridge: fake.bridge,
    stationId: 'bodega',
    accessToken: 't'.repeat(32),
    clientId: 'phone-a',
  });
  const receipt = await session.readState();
  assert.deepEqual(receipt.state, { status: 'new' });
  assert.equal(session.pending().length, 0);
  assert.deepEqual(fake.calls[0], {
    operation: 'state',
    accessToken: 't'.repeat(32),
    payload: { stationId: 'bodega', clientId: 'phone-a' },
  });
});

test('cada mutación conserva la hora local en que se guardó para sincronizar después', async () => {
  const fake = bridgeThat([{ state: { status: 'open' } }]);
  const session = createBridgeSession({
    bridge: fake.bridge,
    stationId: 'bodega',
    accessToken: 't'.repeat(32),
    clientId: 'phone-a',
    now: () => new Date('2026-09-24T14:59:00.000Z'),
    operationId: () => 'operation-1-abcdefgh',
  });
  session.enqueue('close', {});
  await session.flush();
  assert.equal(fake.calls[0].payload.occurredAt, '2026-09-24T14:59:00.000Z');
});
