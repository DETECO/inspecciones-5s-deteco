const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const qrcode = require('../vendor/qrcode-generator-2.0.4.js');
const rendererPath = path.join(__dirname, '../qr-poster.js');
const payload = 'https://deteco.github.io/inspecciones-5s-deteco/?station=BODEGA&token=0123456789abcdef0123456789abcdef';
const assets = {
  logoDataUri: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, '../../assets/deteco-wordmark.jpg')).toString('base64'),
  scanIconDataUri: 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(__dirname, '../../assets/icons/scan.svg')).toString('base64'),
};
function render(extra = {}) {
  assert.ok(fs.existsSync(rendererPath), 'falta el renderizador del cartel completo');
  return require(rendererPath).createQrPoster({ stationName: 'BODEGA', qrUrl: payload, ...assets, ...extra });
}

test('cartel: jerarquía DETECO, estación, inspección, QR y llamada a escanear', () => {
  const svg = render();
  assert.match(svg, /^<svg[^>]+viewBox="0 0 1080 1440"/);
  assert.match(svg, />BODEGA<\/text>/);
  assert.match(svg, />INSPECCIÓN 5S<\/text>/);
  assert.match(svg, />Escanea para iniciar<\/text>/);
  assert.match(svg, /fill="#f26522"/);
  assert.match(svg, /id="station-qr"/);
});

test('cartel: las imágenes están embebidas, sin solicitudes externas', () => {
  const svg = render();
  assert.ok(svg.includes(assets.logoDataUri));
  assert.ok(svg.includes(assets.scanIconDataUri));
  assert.doesNotMatch(svg, /(?:href|src)="https?:|<script|<foreignObject|<iframe/i);
});

test('cartel: conserva el código real y un margen de cuatro módulos', () => {
  const qr = qrcode(0, 'M');
  qr.addData(payload, 'Byte');
  qr.make();
  const original = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
  const qrPath = original.match(/<path d="([^"]+)"/)[1];
  const box = original.match(/viewBox="([^"]+)"/)[1];
  const svg = render();
  assert.ok(svg.includes(qrPath), 'el cartel no cambia la matriz del QR original');
  assert.ok(svg.includes(`viewBox="${box}"`));
  assert.equal(Number(box.split(' ')[2]), (qr.getModuleCount() + 8) * 4);
});

test('cartel: el pie no invade el margen blanco inferior, incluso con enlaces cortos', () => {
  for (const qrUrl of [payload, 'https://example.com/a', payload + '&extra=additional-station-context']) {
    const svg = render({ qrUrl });
    const qr = svg.match(/<svg id="station-qr"[^>]+>/)[0];
    const y = Number(qr.match(/ y="([^"]+)"/)[1]);
    const height = Number(qr.match(/ height="([^"]+)"/)[1]);
    const iconY = Number(svg.match(/x="158" y="([^"]+)" width="112" height="112"/)[1]);
    // Tabler scan.svg: top path y=3, stroke-width=2, in a 24px viewBox.
    // Include the stroke extent, not just its center, plus 2px separation.
    const iconInkTop = iconY + 112 * (3 - 2 / 2) / 24;
    assert.ok(y + height + 2 <= iconInkTop, 'todo el borde blanco debe quedar antes de la tinta del pie');
  }
});

test('cartel: el nombre es dinámico y se escapa como texto, no como HTML', () => {
  const svg = render({ stationName: 'OBRA <NORTE> & "SUR"' });
  assert.match(svg, /OBRA &lt;NORTE&gt; &amp; &quot;SUR&quot;/);
  assert.doesNotMatch(svg, /<NORTE>/);
  const office = render({ stationName: 'OFICINA', qrUrl: payload.replace('BODEGA', 'OFICINA') });
  assert.match(office, />OFICINA<\/text>/);
  assert.notEqual(office.match(/<path d="([^"]+)"/)[1], svg.match(/<path d="([^"]+)"/)[1]);
});

test('cartel: nombres largos y acentuados caben en el ancho del cartel', () => {
  for (const stationName of ['OBRA SANTA JULIA', 'MANTENCIÓN', 'ESTACIÓN DE ABASTECIMIENTO Y LOGÍSTICA OBRA PARQUE INDUSTRIAL']) {
    const svg = render({ stationName });
    assert.ok(svg.includes(stationName));
    const widths = [...svg.matchAll(/textLength="(\d+)"/g)].map(match => Number(match[1]));
    assert.ok(widths.every(width => width > 0 && width <= 920));
    assert.match(svg, /lengthAdjust="spacingAndGlyphs"/);
  }
});

test('cartel: un nombre largo usa dos líneas legibles, no letras aplastadas', () => {
  const svg = render({ stationName: 'ESTACIÓN DE ABASTECIMIENTO Y LOGÍSTICA OBRA PARQUE INDUSTRIAL' });
  assert.match(svg, /<g id="station-name">/);
  assert.equal((svg.match(/class="station-name-line"/g) || []).length, 2);
});

test('cartel: rechaza una estación sin enlace o imágenes externas', () => {
  assert.throws(() => render({ qrUrl: '' }), /enlace/i);
  assert.throws(() => render({ stationName: '' }), /nombre/i);
  assert.throws(() => render({ logoDataUri: 'https://example.com/logo.jpg' }), /embebida/i);
});
