const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { writeCoreFile } = require('../build-core.cjs');

writeCoreFile();
const base = path.join(__dirname, '..');
const source = ['deploy/Core.gs', 'Code.gs'].map(file => fs.readFileSync(path.join(base, file), 'utf8')).join('\n');
const api = vm.runInNewContext(`${source}\n({ app5sSeedStations_, app5sPublicState_, app5sMakeStationToken_, app5sPhotoParts_ })`, {
  Date, Intl, Object, Number, Array, Map, Set, String, RegExp, Error, TypeError, RangeError,
  Utilities: {
    getUuid: () => '12345678-1234-1234-1234-123456789abc',
    base64Decode: value => Array.from(Buffer.from(value, 'base64')),
  },
});

test('la instalación parte con las nueve estaciones aprobadas y claves QR no predecibles', () => {
  const rows = api.app5sSeedStations_();
  assert.equal(rows.length, 9);
  assert.deepEqual(JSON.parse(JSON.stringify(rows.map(row => row.slice(0, 2)))), [
    ['oficina', 'OFICINA'], ['hormigon', 'HORMIGON'], ['soldadura', 'SOLDADURA'], ['electricidad', 'ELECTRICIDAD'], ['bodega', 'BODEGA'], ['mantencion', 'MANTENCION'], ['carpinteria', 'CARPINTERIA'], ['enfierradura', 'ENFIERRADURA'], ['obra-santa-julia', 'OBRA SANTA JULIA'],
  ]);
  assert.match(api.app5sMakeStationToken_(), /^[A-Za-z0-9_-]{32,}$/);
});

test('el estado enviado al teléfono nunca devuelve el acceso QR ni propiedades internas', () => {
  const state = api.app5sPublicState_({
    stationId: 'bodega', week: '2026-W39', status: 'open', accessToken: 'secret', internalRow: 9,
    editor: { clientId: 'phone-a', inspectorName: 'Ana' }, answers: { 'SEP-01': 1 }, findings: {},
  });
  assert.equal(state.accessToken, undefined);
  assert.equal(state.internalRow, undefined);
  assert.equal(state.stationId, 'bodega');
  assert.equal(state.editor.inspectorName, 'Ana');
});

test('solo acepta fotos JPG, PNG o WebP y limita el tamaño antes de subir a Drive', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(api.app5sPhotoParts_('data:image/jpeg;base64,AAAA'))), {
    mime: 'image/jpeg', extension: 'jpg', bytes: [0, 0, 0],
  });
  assert.throws(() => api.app5sPhotoParts_('data:text/html;base64,AAAA'), /foto/i);
  assert.throws(() => api.app5sPhotoParts_('data:image/jpeg;base64,'), /foto/i);
});
