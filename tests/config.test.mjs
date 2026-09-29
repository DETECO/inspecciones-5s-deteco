import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppConfig } from '../client/config.mjs';

test('sin una URL publicada, la interfaz deja claro que solo guarda borrador local', () => {
  assert.deepEqual(resolveAppConfig({}), { bridgeEndpoint: '', mode: 'local' });
});

test('con una publicación Apps Script válida, activa el puente verificable', () => {
  assert.deepEqual(resolveAppConfig({ bridgeEndpoint: 'https://script.google.com/macros/s/AKfycbx1234567890/exec' }), {
    bridgeEndpoint: 'https://script.google.com/macros/s/AKfycbx1234567890/exec',
    mode: 'bridge',
  });
});
