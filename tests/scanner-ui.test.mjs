import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import QrScanner from '../vendor/qr-scanner/qr-scanner.min.js';

const appSource = readFileSync(new URL('../client/app.mjs', import.meta.url), 'utf8');

test('el arranque usa únicamente métodos disponibles en la librería QR publicada', () => {
  assert.match(appSource, /new QrScanner\(/);
  assert.equal(typeof QrScanner.prototype.start, 'function');
  for (const [, method] of appSource.matchAll(/\bQrScanner\.([A-Za-z_$][\w$]*)\(/g)) {
    assert.equal(typeof QrScanner[method], 'function', `QrScanner.${method} no existe en la librería incluida`);
  }
});

test('la pantalla de escaneo abre la cámara trasera y lee sin pulsar un segundo botón', () => {
  assert.match(appSource, /<video id="qr-camera"[^>]+autoplay muted playsinline/);
  assert.match(appSource, /preferredCamera:\s*'environment'/);
  assert.match(appSource, /await scanner\.start\(\)/);
  assert.match(appSource, /data-action="open-scanner"/);
});

test('la linterna se ofrece solo cuando la cámara confirma que puede encenderla', () => {
  assert.match(appSource, /await scanner\.hasFlash\(\)/);
  assert.match(appSource, /await qrScanner\.turnFlashOn\(\)/);
  assert.match(appSource, /await qrScanner\.turnFlashOff\(\)/);
  assert.match(appSource, /data-action="toggle-flash"/);
});

test('el lector y los iconos usados se sirven desde archivos locales con licencia', () => {
  assert.match(appSource, /\.\.\/vendor\/qr-scanner\/qr-scanner\.min\.js/);
  for (const path of [
    '../vendor/qr-scanner/qr-scanner.min.js',
    '../vendor/qr-scanner/qr-scanner-worker.min.js',
    '../vendor/qr-scanner/LICENSE',
    '../assets/icons/scan.svg',
    '../assets/icons/scan-eye.svg',
    '../assets/icons/qrcode.svg',
    '../assets/icons/info-circle.svg',
    '../assets/icons/arrow-left.svg',
    '../assets/icons/bolt.svg',
    '../assets/icons/x.svg',
    '../assets/icons/LICENSE-tabler-icons.txt',
  ]) assert.equal(existsSync(new URL(path, import.meta.url)), true, `missing: ${path}`);
});
