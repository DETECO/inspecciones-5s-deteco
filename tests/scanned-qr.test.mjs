import assert from 'node:assert/strict';
import test from 'node:test';
import { scannedStationUrl } from '../client/scanned-qr.mjs';

const token = 'abcdefghijklmnopqrstuvwxyz123456';

test('una lectura válida abre la estación escaneada en la web actual', () => {
  const source = `https://deteco.github.io/inspecciones-5s-deteco/#station=oficina&token=${token}`;
  assert.equal(
    scannedStationUrl(source, 'https://deteco.github.io/inspecciones-5s-deteco/'),
    `https://deteco.github.io/inspecciones-5s-deteco/#station=oficina&token=${token}`,
  );
});

test('la lectura nunca redirige el navegador a otro sitio ni conserva la URL del QR', () => {
  const source = `https://sitio-no-relacionado.example/redirect#station=bodega&token=${token}`;
  assert.equal(
    scannedStationUrl(source, 'https://deteco.github.io/inspecciones-5s-deteco/'),
    `https://deteco.github.io/inspecciones-5s-deteco/#station=bodega&token=${token}`,
  );
});

test('rechaza un código sin estación, token válido o URL web', () => {
  for (const value of [
    'texto cualquiera',
    'javascript:alert(1)#station=oficina&token=' + token,
    'https://deteco.github.io/#station=oficina&token=corto',
  ]) assert.throws(() => scannedStationUrl(value, 'https://deteco.github.io/inspecciones-5s-deteco/'), /QR|estación|válid/i);
});
