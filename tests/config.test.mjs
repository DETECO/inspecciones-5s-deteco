import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolveAppConfig } from '../client/config.mjs';

const publishedBridge = 'https://script.google.com/macros/s/AKfycbySRgbzihE3EfNN2hscyltzX-GAT8KMf1-bE6FuuBVmxZuAbgMIcwtUKxGR0jYT6qzi/exec';

test('sin una URL publicada, la interfaz deja claro que solo guarda borrador local', () => {
  assert.deepEqual(resolveAppConfig({}), { bridgeEndpoint: '', mode: 'local' });
});

test('con una publicación Apps Script válida, activa el puente verificable', () => {
  assert.deepEqual(resolveAppConfig({ bridgeEndpoint: 'https://script.google.com/macros/s/AKfycbx1234567890/exec' }), {
    bridgeEndpoint: 'https://script.google.com/macros/s/AKfycbx1234567890/exec',
    mode: 'bridge',
  });
});

test('la configuración publicada activa el puente Apps Script real', () => {
  const context = { window: {} };
  const source = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context);

  assert.deepEqual(resolveAppConfig(context.window.DETECO_5S_CONFIG), {
    bridgeEndpoint: publishedBridge,
    mode: 'bridge',
  });
});
