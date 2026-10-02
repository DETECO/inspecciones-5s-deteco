import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../backend/Admin.html', import.meta.url), 'utf8');
test('panel: vista, descarga e impresión usan el mismo cartel completo', () => {
  assert.match(source, /app5sQrPoster\.createQrPoster\(/);
  assert.match(source, /el\('qr-preview'\)\.innerHTML = svg/);
  assert.match(source, /el\('qr-print-svg'\)\.innerHTML = svg/);
  assert.match(source, /new Blob\(\[state\.qrSvg\]/);
  assert.match(source, />Descargar cartel<\/button>/);
  assert.doesNotMatch(source, /id="qr-print-title"/);
});
test('panel: impresión A4 vertical en una hoja y vista accesible para móvil', () => {
  assert.match(source, /@page\{size:A4 portrait;margin:10mm\}/);
  assert.match(source, /print-color-adjust:exact/);
  assert.match(source, /#qr-print-svg\{width:190mm;height:[\d.]+mm/);
  assert.match(source, /\.qr-dialog\{[^}]*max-height:calc\(100dvh/);
  assert.match(source, /\.qr-preview\{[^}]*aspect-ratio:3\/4/);
});

test('panel: el estilo del cartel no agranda el SVG del QR anidado', () => {
  assert.match(source, /\.qr-preview>svg/);
  assert.match(source, /#qr-print-svg>svg/);
  assert.doesNotMatch(source, /\.qr-preview svg|#qr-print-svg svg/);
});
