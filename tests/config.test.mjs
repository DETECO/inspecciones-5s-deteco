import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolveAppConfig } from '../client/config.mjs';

const publishedBridge = 'https://script.google.com/macros/s/AKfycbySRgbzihE3EfNN2hscyltzX-GAT8KMf1-bE6FuuBVmxZuAbgMIcwtUKxGR0jYT6qzi/exec';

test('sin una URL publicada, la interfaz deja claro que solo guarda borrador local', () => {
  assert.deepEqual(resolveAppConfig({}), { bridgeEndpoint: '', adminEndpoint: '', adminLoginUrl: '', mode: 'local' });
});

test('con una publicación Apps Script válida, activa el puente verificable', () => {
  assert.deepEqual(resolveAppConfig({ bridgeEndpoint: 'https://script.google.com/macros/s/AKfycbx1234567890/exec' }), {
    bridgeEndpoint: 'https://script.google.com/macros/s/AKfycbx1234567890/exec',
    adminEndpoint: 'https://script.google.com/a/macros/deteco.cl/s/AKfycbx1234567890/exec',
    adminLoginUrl: 'https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fscript.google.com%2Fa%2Fmacros%2Fdeteco.cl%2Fs%2FAKfycbx1234567890%2Fexec',
    mode: 'bridge',
  });
});

test('el enlace de administración solicita elegir o iniciar una cuenta Google antes de volver al panel', () => {
  const config = resolveAppConfig({ bridgeEndpoint: publishedBridge });

  assert.equal(
    config.adminLoginUrl,
    `https://accounts.google.com/AccountChooser?continue=${encodeURIComponent(config.adminEndpoint)}`,
  );
});

test('la URL de administración usa el dominio Workspace y evita la ruta /macros/u/1/ que da 404', () => {
  const config = resolveAppConfig({ bridgeEndpoint: publishedBridge });

  assert.equal(
    config.adminEndpoint,
    'https://script.google.com/a/macros/deteco.cl/s/AKfycbySRgbzihE3EfNN2hscyltzX-GAT8KMf1-bE6FuuBVmxZuAbgMIcwtUKxGR0jYT6qzi/exec',
  );
  assert.doesNotMatch(config.adminEndpoint, /\/macros\/u\/\d+\//);
});

test('la configuración publicada activa el puente Apps Script real', () => {
  const context = { window: {} };
  const source = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context);

  assert.deepEqual(resolveAppConfig(context.window.DETECO_5S_CONFIG), {
    bridgeEndpoint: publishedBridge,
    adminEndpoint: 'https://script.google.com/a/macros/deteco.cl/s/AKfycbySRgbzihE3EfNN2hscyltzX-GAT8KMf1-bE6FuuBVmxZuAbgMIcwtUKxGR0jYT6qzi/exec',
    adminLoginUrl: 'https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fscript.google.com%2Fa%2Fmacros%2Fdeteco.cl%2Fs%2FAKfycbySRgbzihE3EfNN2hscyltzX-GAT8KMf1-bE6FuuBVmxZuAbgMIcwtUKxGR0jYT6qzi%2Fexec',
    mode: 'bridge',
  });
});
