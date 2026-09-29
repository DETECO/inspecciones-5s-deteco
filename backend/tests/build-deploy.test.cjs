const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { writeDeploy } = require('../build-deploy.cjs');

test('el paquete de Apps Script reúne puente, núcleo, servicio y persistencia', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'deteco-5s-'));
  writeDeploy(output);
  const code = fs.readFileSync(path.join(output, 'Code.gs'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'appsscript.json'), 'utf8'));
  assert.match(code, /deteco-5s-bridge-v1/);
  assert.match(code, /function app5sCreateService/);
  assert.match(code, /function app5sHandle_/);
  assert.equal(manifest.runtimeVersion, 'V8');
});

test('el paquete administrativo incluye el generador QR local y no depende de terceros', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'deteco-5s-qr-'));
  writeDeploy(output);
  const admin = fs.readFileSync(path.join(output, 'Admin.html'), 'utf8');
  assert.match(admin, /var qrcode\s*=\s*function/);
  assert.doesNotMatch(admin, /__LOCAL_QR_LIBRARY__/);
  assert.doesNotMatch(admin, /<script[^>]+src=/i);
  assert.match(admin, /Imprimir QR/);
  const scripts = [...admin.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  assert.equal(scripts.length, 2);
  const browser = {};
  new vm.Script(scripts[0]).runInNewContext(browser);
  assert.equal(typeof browser.qrcode, 'function');
  const qr = browser.qrcode(0, 'M');
  qr.addData('https://deteco.github.io/inspecciones-lean/?station=BODEGA&token=0123456789abcdef0123456789abcdef', 'Byte');
  qr.make();
  assert.match(qr.createSvgTag({ scalable: true, margin: 16 }), /^<svg\b/);
  new vm.Script(scripts[1]);
});
