const test = require('node:test');
const assert = require('node:assert/strict');
const qrcode = require('../vendor/qrcode-generator-2.0.4.js');

test('el QR local crea un SVG escalable para el enlace de una estación', () => {
  const qr = qrcode(0, 'M');
  qr.addData('https://deteco.github.io/inspecciones-lean/?station=BODEGA&token=0123456789abcdef0123456789abcdef', 'Byte');
  qr.make();

  const svg = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true, title: 'BODEGA · Inspección 5S' });
  assert.match(svg, /^<svg\b/);
  assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /<path d="M/);
  assert.match(svg, /<title[^>]*>BODEGA · Inspección 5S<\/title>/);
  assert.ok(qr.getModuleCount() >= 21);
});
