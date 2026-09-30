import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const indexPath = new URL('../index.html', import.meta.url);
const appSource = readFileSync(new URL('../client/app.mjs', import.meta.url), 'utf8');
const indexSource = readFileSync(indexPath, 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const manifestPath = new URL('../manifest.webmanifest', import.meta.url);
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

test('declares home-screen metadata and platform-sized DETECO icons', () => {
  assert.match(indexSource, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(indexSource, /rel="apple-touch-icon"[^>]+apple-touch-icon\.png/);
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons?.some(icon => icon.sizes === '192x192' && icon.src === './assets/deteco-icon-192.png'));
  assert.ok(manifest.icons?.some(icon => icon.sizes === '512x512' && icon.src === './assets/deteco-icon-512.png'));
});

test('uses the DETECO landing page with a direct camera-scanner action', () => {
  assert.match(appSource, /class="brand-logo" src="\.\/assets\/deteco-wordmark\.jpg"/);
  assert.match(appSource, /class="welcome-page page-enter"/);
  assert.match(appSource, /5S SEMANAL/);
  assert.match(appSource, /Escanea el QR de tu estación\./);
  assert.match(appSource, /class="welcome-photo" src="\.\/assets\/qr-estacion-hero\.png"/);
  assert.match(appSource, /data-action="open-scanner"[\s\S]*?Escanear QR/);
  assert.match(appSource, /data-action="show-scan-help"[\s\S]*?Ver instrucciones/);
  assert.doesNotMatch(appSource, /station-carousel|station-artwork|HOME_CAROUSEL_STATIONS|station-presentation/);
});

test('la portada es fotográfica y no permite elegir estación fuera del QR', () => {
  const home = appSource.match(/function qrPage\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(home, /welcome-photo/);
  assert.doesNotMatch(home, /<svg|stationArtwork|station-carousel/);
  assert.match(home, /type="button" data-action="open-scanner"/);
  assert.doesNotMatch(home, /data-action="select-station"|data-station-id=/);
});

test('mantiene insignia semanal, ayuda, administración y proporciones móviles accesibles', () => {
  const header = appSource.match(/function header\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(stylesSource, /\.mode-pill\s*\{\s*display:\s*inline-flex/);
  assert.match(header, /aria-label="Administración"/);
  assert.match(stylesSource, /\.welcome-photo\s*\{/);
  assert.doesNotMatch(stylesSource, /\.station-carousel|\.station-artwork/);
  assert.match(stylesSource, /prefers-reduced-motion:\s*reduce/);
  assert.match(stylesSource, /\.scan-cta:focus-visible/);
});

test('ships the wordmark, photographic QR hero, and correctly sized home-screen icons', () => {
  for (const name of ['deteco-wordmark.jpg', 'qr-estacion-hero.png', 'deteco-icon-192.png', 'deteco-icon-512.png', 'apple-touch-icon.png', 'favicon-32.png']) {
    assert.ok(existsSync(new URL(`../assets/${name}`, import.meta.url)), `missing asset: ${name}`);
  }
  for (const [name, size] of [['deteco-icon-192.png', 192], ['deteco-icon-512.png', 512], ['apple-touch-icon.png', 180], ['favicon-32.png', 32]]) {
    const png = readFileSync(new URL(`../assets/${name}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), size, `${name} width`);
    assert.equal(png.readUInt32BE(20), size, `${name} height`);
  }
});
