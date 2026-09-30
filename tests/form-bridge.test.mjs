import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrustedBridgeReceipt, decodeBridgeResult } from '../transport/form-bridge.mjs';

const expected = { requestId: 'req-1234567890123456', nonce: 'nonce-1234567890123456' };
const receipt = {
  origin: 'https://script.googleusercontent.com',
  data: {
    channel: 'deteco-5s-bridge-v1',
    requestId: expected.requestId,
    nonce: expected.nonce,
    encodedResult: 'eyJvayI6dHJ1ZX0=',
  },
};

test('solo acepta un acuse de Google que coincide con solicitud y nonce', () => {
  assert.equal(isTrustedBridgeReceipt(receipt, expected), true);
  assert.deepEqual(decodeBridgeResult(receipt.data.encodedResult), { ok: true });
});

test('acepta el acuse de Google aunque lo envíe un marco interno de Apps Script', () => {
  const outerFrame = {};
  const nestedFrameReceipt = { ...receipt, source: {} };
  assert.equal(isTrustedBridgeReceipt(nestedFrameReceipt, { ...expected, source: outerFrame }), true);
});

test('acepta el subdominio temporal de Google usado por la respuesta real de Apps Script', () => {
  const temporaryGoogleReceipt = {
    ...receipt,
    origin: 'https://n-h2lopvw2mqb2gouortammh5ymzuz5av43zzl23y-0lu-script.googleusercontent.com',
  };
  assert.equal(isTrustedBridgeReceipt(temporaryGoogleReceipt, expected), true);
});

test('descarta mensajes de otra web o de una solicitud antigua', () => {
  assert.equal(isTrustedBridgeReceipt({ ...receipt, origin: 'https://evil.example' }, expected), false);
  assert.equal(isTrustedBridgeReceipt({ ...receipt, origin: 'https://n-abc-script.googleusercontent.com.evil.example' }, expected), false);
  assert.equal(isTrustedBridgeReceipt({ ...receipt, data: { ...receipt.data, nonce: 'other' } }, expected), false);
  assert.equal(isTrustedBridgeReceipt({ ...receipt, data: { ...receipt.data, requestId: 'old' } }, expected), false);
  assert.equal(isTrustedBridgeReceipt({ ...receipt, data: { ...receipt.data, channel: 'other' } }, expected), false);
});

test('un acuse malformado no se interpreta como guardado', () => {
  assert.equal(isTrustedBridgeReceipt({ ...receipt, data: null }, expected), false);
  assert.throws(() => decodeBridgeResult('not-json'), /acuse|respuesta/i);
});
