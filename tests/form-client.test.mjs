import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBridgeEndpoint } from '../transport/form-client.mjs';
import { createFormBridge } from '../transport/form-client.mjs';

test('acepta solo una URL HTTPS publicada de Apps Script para el puente', () => {
  assert.equal(
    validateBridgeEndpoint('https://script.google.com/macros/s/AKfycbx1234567890/exec'),
    'https://script.google.com/macros/s/AKfycbx1234567890/exec',
  );
});

test('rechaza URLs de desarrollo, HTTP u otros destinos', () => {
  for (const url of [
    'https://script.google.com/macros/s/AKfycbx1234567890/dev',
    'http://script.google.com/macros/s/AKfycbx1234567890/exec',
    'https://example.com/collect',
  ]) assert.throws(() => validateBridgeEndpoint(url), /puente|Apps Script/i);
});

test('conserva el identificador estable de una operación al enviarla por iframe', async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const listeners = new Map();
  const appended = [];
  const element = tag => {
    const node = {
      tag,
      children: [],
      append(...items) { this.children.push(...items); },
      remove() { this.removed = true; },
      setAttribute() {},
    };
    if (tag === 'iframe') node.contentWindow = {};
    if (tag === 'form') node.submit = () => { node.submitted = true; };
    return node;
  };
  globalThis.document = { createElement: element, body: { append: (...items) => appended.push(...items) } };
  globalThis.window = {
    setTimeout,
    clearTimeout,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
  };
  try {
    const client = createFormBridge({ endpoint: 'https://script.google.com/macros/s/AKfycbx1234567890/exec' });
    const pending = client.send({
      operation: 'save-answer',
      requestId: 'stable-operation-123456',
      accessToken: 't'.repeat(32),
      payload: { stationId: 'bodega', clientId: 'phone-a', questionId: 'SEP-01', count: 1 },
    });
    const frame = appended.find(node => node.tag === 'iframe');
    const form = appended.find(node => node.tag === 'form');
    const field = name => form.children.find(input => input.name === name)?.value;
    assert.equal(field('requestId'), 'stable-operation-123456');
    listeners.get('message')({
      origin: 'https://script.googleusercontent.com',
      source: frame.contentWindow,
      data: { channel: 'deteco-5s-bridge-v1', requestId: field('requestId'), nonce: field('nonce'), encodedResult: 'eyJvayI6dHJ1ZX0=' },
    });
    await pending;
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test('cierre y fotos tienen espera propia y timeout identificable para comprobar resultado', async () => {
  const originals = { document: globalThis.document, window: globalThis.window };
  let timer, delay;
  const nodes = [];
  globalThis.document = { createElement: tag => ({ tag, children: [], append(...items) { this.children.push(...items); }, remove() {}, setAttribute() {}, submit() {} }), body: { append(...items) { nodes.push(...items); } } };
  globalThis.window = { setTimeout(fn, ms) { timer = fn; delay = ms; return 1; }, clearTimeout() {}, addEventListener() {}, removeEventListener() {} };
  try {
    const bridge = createFormBridge({ endpoint: 'https://script.google.com/macros/s/AKfycbx1234567890/exec' });
    for (const [operation, expected] of [['submit-final', 90000], ['upload-final-photo', 60000], ['final-state', 30000]]) {
      const pending = bridge.send({ operation, accessToken: 't'.repeat(32), payload: {} });
      assert.equal(delay, expected);
      timer();
      await assert.rejects(pending, error => error.code === 'BRIDGE_TIMEOUT');
    }
  } finally { Object.assign(globalThis, originals); }
});
