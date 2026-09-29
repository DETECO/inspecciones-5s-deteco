import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQrRoute, scrubQrFragment } from '../client/route.mjs';

const token = 'a'.repeat(32);

test('lee la estación y el código de acceso desde el fragmento del QR', () => {
  const result = parseQrRoute(`https://deteco.github.io/inspecciones-5s/#station=bodega&token=${token}`);
  assert.deepEqual(result, { stationId: 'bodega', accessToken: token });
});

test('rechaza una URL sin código QR o con estación inválida', () => {
  assert.throws(() => parseQrRoute('https://deteco.github.io/inspecciones-5s/'), /QR/i);
  assert.throws(() => parseQrRoute(`https://deteco.github.io/#station=../../bodega&token=${token}`), /estación/i);
  assert.throws(() => parseQrRoute('https://deteco.github.io/#station=bodega&token=corto'), /QR/i);
});

test('al limpiar el fragmento conserva la URL pública sin exponer el código', () => {
  assert.equal(
    scrubQrFragment(`https://deteco.github.io/inspecciones-5s/#station=bodega&token=${token}`),
    'https://deteco.github.io/inspecciones-5s/',
  );
});
