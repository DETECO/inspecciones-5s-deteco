const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(overrides = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'Bridge.gs'), 'utf8');
  const props = { APP5S_FRONTEND_ORIGIN: 'https://deteco.github.io' };
  const context = {
    JSON,
    Buffer,
    Utilities: {
      base64Decode: value => Array.from(Buffer.from(value, 'base64')),
      base64Encode: bytes => Buffer.from(bytes).toString('base64'),
      newBlob: value => ({
        getBytes: () => Array.isArray(value) ? value : Array.from(Buffer.from(String(value), 'utf8')),
        getDataAsString: () => Buffer.from(Array.isArray(value) ? value : String(value), Array.isArray(value) ? undefined : 'utf8').toString('utf8'),
      }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key] || '' }) },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createHtmlOutput: html => ({ html, setXFrameOptionsMode(mode) { this.mode = mode; return this; } }),
    },
    app5sHandle_: () => ({ ok: true, state: { status: 'new' } }),
    ...overrides,
  };
  const api = vm.runInNewContext(`${source}\n({ app5sDecodePayload_, app5sBridgeReceipt_, doPost, doGet })`, context);
  return { api, props };
}

test('el puente decodifica un payload JSON válido sin aceptar otro formato', () => {
  const { api } = load();
  const valid = Buffer.from(JSON.stringify({ accessToken: 'a'.repeat(32), stationId: 'bodega' })).toString('base64');
  assert.deepEqual(api.app5sDecodePayload_(valid), { accessToken: 'a'.repeat(32), stationId: 'bodega' });
  assert.throws(() => api.app5sDecodePayload_('%%%'), /payload/i);
  assert.throws(() => api.app5sDecodePayload_(Buffer.from('[]').toString('base64')), /payload/i);
});

test('el acuse usa solo el origen configurado y no incorpora el payload legible', () => {
  const { api } = load();
  const output = api.app5sBridgeReceipt_('r'.repeat(24), 'n'.repeat(24), { ok: true, inspector: 'Ana' });
  assert.equal(output.mode, 'ALLOWALL');
  assert.match(output.html, /https:\/\/deteco\.github\.io/);
  assert.doesNotMatch(output.html, /"inspector":"Ana"/);
  assert.match(output.html, /deteco-5s-bridge-v1/);
});

test('doPost confirma la misma solicitud y no envía errores crudos al navegador', () => {
  const { api } = load({ app5sHandle_: () => { throw new Error('detalle interno'); } });
  const payload = Buffer.from(JSON.stringify({ accessToken: 'a'.repeat(32) })).toString('base64');
  const output = api.doPost({ parameter: { requestId: 'r'.repeat(24), nonce: 'n'.repeat(24), operation: 'state', payload } });
  assert.match(output.html, /deteco-5s-bridge-v1/);
  assert.doesNotMatch(output.html, /detalle interno/);
});

test('doGet inserta el enlace real de regreso al panel sin depender del iframe ni del referrer', () => {
  const deploymentId = 'AKfycbyTest1234567890';
  const { api } = load({
    ScriptApp: { getService: () => ({ getUrl: () => `https://script.google.com/macros/s/${deploymentId}/exec` }) },
    HtmlService: {
      createHtmlOutputFromFile: () => ({ getContent: () => '<a id="account-switch" href="__APP5S_ADMIN_ACCOUNT_URL__">Cambiar cuenta</a>' }),
      createHtmlOutput: html => ({ html, setTitle() { return this; }, addMetaTag() { return this; } }),
    },
  });
  const html = api.doGet().html;
  assert.doesNotMatch(html, /__APP5S_ADMIN_ACCOUNT_URL__/);
  const encoded = html.match(/continue=([^\"]+)/)[1];
  assert.equal(decodeURIComponent(encoded), `https://script.google.com/a/macros/deteco.cl/s/${deploymentId}/exec`);
});
