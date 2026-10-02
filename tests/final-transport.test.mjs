import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBridgeRequest, decodeBridgePayload } from '../transport/bridge-request.mjs';
import { createFormBridge } from '../transport/form-client.mjs';
import { createBridgeSession } from '../client/bridge-session.mjs';
import { submitFinalInspection } from '../client/final-submit.mjs';

const accessToken = 't'.repeat(32);
const sessionId = 'session-12345678';
const occurredAt = '2026-09-30T15:00:00.000Z';
const finalRequests = [
  ['begin-final', { sessionId, inspectorName: 'Inspector prueba' }],
  ['final-state', { sessionId }],
  ['upload-final-photo', { sessionId, photoId: 'finding-12345678', dataUri: 'data:image/jpeg;base64,AAAA', category: 'Hallazgos' }],
  ['submit-final', { sessionId, occurredAt, dailyManagementApplicable: false, answers: { 'SEP-01': 1 }, findings: { 'SEP-01': [{ id: 'finding-12345678', photoId: 'drive-photo-1', note: 'Nota' }] }, kaizenReviews: {} }],
];

test('el transporte versiona su validador para renovar la caché de las operaciones finales', () => {
  const appSource = readFileSync(new URL('../client/app.mjs', import.meta.url), 'utf8');
  const transportSource = readFileSync(new URL('../transport/form-client.mjs', import.meta.url), 'utf8');
  const appImport = appSource.match(/import \{ createFormBridge \} from ['"]([^'"]+)['"]/)[1];
  const validatorImport = transportSource.match(/import \{ makeBridgeRequest \} from ['"]([^'"]+)['"]/)[1];
  const transportUrl = new URL(appImport, 'https://example.com/client/app.mjs');
  const validatorUrl = new URL(validatorImport, transportUrl);
  assert.equal(transportUrl.searchParams.get('v'), '20261002-close');
  assert.equal(validatorUrl.pathname, '/transport/bridge-request.mjs');
  assert.equal(validatorUrl.searchParams.get('v'), transportUrl.searchParams.get('v'));
});

for (const [operation, payload] of finalRequests) {
  test(`el sobre del puente acepta ${operation} y conserva acceso y payload`, () => {
    const envelope = makeBridgeRequest({ operation, payload, accessToken, requestId: 'r'.repeat(24), nonce: 'n'.repeat(24) });
    assert.equal(envelope.operation, operation);
    assert.deepEqual(decodeBridgePayload(envelope.payload), { ...payload, accessToken });
  });
}

// Only the browser boundary is simulated: session, form transport, encoding and
// receipt validation execute their production implementations.
function browserBoundary(t) {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const listeners = new Map();
  const elements = [];
  const submitted = [];
  globalThis.document = {
    createElement(tag) {
      const node = {
        tag, children: [],
        append(...items) { this.children.push(...items); },
        remove() { this.removed = true; },
        setAttribute() {},
      };
      if (tag === 'iframe') node.contentWindow = {};
      if (tag === 'form') node.submit = () => {
        const fields = Object.fromEntries(node.children.map(input => [input.name, input.value]));
        submitted.push({ fields, payload: decodeBridgePayload(fields.payload), action: node.action, method: node.method, target: node.target });
        const result = fields.operation === 'upload-final-photo'
          ? { ok: true, photoId: 'drive-photo-1' }
          : { ok: true, state: { status: fields.operation === 'submit-final' ? 'closed' : 'open', finalSessionId: sessionId } };
        queueMicrotask(() => listeners.get('message')({
          origin: 'https://script.googleusercontent.com',
          data: { channel: 'deteco-5s-bridge-v1', requestId: fields.requestId, nonce: fields.nonce, encodedResult: Buffer.from(JSON.stringify(result)).toString('base64') },
        }));
      };
      return node;
    },
    body: { append: (...items) => elements.push(...items) },
  };
  globalThis.window = {
    setTimeout, clearTimeout,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
  };
  t.after(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  });
  return { submitted, elements, listeners };
}

function bridgeSession() {
  return createBridgeSession({
    bridge: createFormBridge({ endpoint: 'https://script.google.com/macros/s/AKfycbx1234567890/exec' }),
    stationId: 'bodega', clientId: 'phone-a', accessToken,
    now: () => new Date(occurredAt),
  });
}

test('inicio, consulta, fotografía y cierre final atraviesan el transporte real por formulario', async t => {
  const boundary = browserBoundary(t);
  const session = bridgeSession();
  await session.sendNow('begin-final', finalRequests[0][1]);
  await session.sendNow('final-state', finalRequests[1][1]);
  const receipt = await submitFinalInspection({
    session, sessionId, occurredAt, uploadCache: new Map(),
    inspection: {
      dailyManagementApplicable: false,
      answers: { 'SEP-01': 1 },
      findings: { 'SEP-01': [{ id: 'finding-12345678', dataUri: 'data:image/jpeg;base64,AAAA', note: 'Nota' }] },
      kaizenReviews: {},
    },
  });
  assert.deepEqual(boundary.submitted.map(request => request.fields.operation), finalRequests.map(([operation]) => operation));
  for (const [index, request] of boundary.submitted.entries()) {
    assert.deepEqual(request.payload, { ...finalRequests[index][1], occurredAt, stationId: 'bodega', clientId: 'phone-a', accessToken });
    assert.equal(request.method, 'post');
    assert.equal(request.action, 'https://script.google.com/macros/s/AKfycbx1234567890/exec');
    assert.equal(request.target, `deteco-5s-${request.fields.requestId}`);
  }
  assert.equal(receipt.state.status, 'closed');
  assert.equal(receipt.state.finalSessionId, sessionId);
  assert.ok(boundary.elements.every(element => element.removed));
  assert.equal(boundary.listeners.size, 0);
});

test('operaciones desconocidas siguen rechazadas antes de crear o enviar un formulario', t => {
  const boundary = browserBoundary(t);
  const session = bridgeSession();
  for (const operation of ['delete-all', 'begin-final-extra', 'admin-login']) {
    assert.throws(() => session.sendNow(operation, { sessionId }), /Operación de puente inválida/);
  }
  assert.equal(boundary.submitted.length, 0);
  assert.equal(boundary.elements.length, 0);
  assert.equal(boundary.listeners.size, 0);
});
