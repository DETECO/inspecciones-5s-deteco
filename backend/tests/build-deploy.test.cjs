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
  assert.match(code, /function app5sAdminSaveSchedule/);
  assert.match(code, /function app5sAdminUpdateOwner/);
  assert.match(code, /function app5sAdminSaveNotifications/);
  assert.match(code, /function app5sNotifyClosedSafe_/);
  new vm.Script(code);
  assert.equal(manifest.runtimeVersion, 'V8');
  assert.deepEqual(manifest.webapp, { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' },
    'la versión nueva debe conservar el acceso anónimo del puente QR activo');
});

test('el paquete administrativo incluye el generador QR local y no depende de terceros', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'deteco-5s-qr-'));
  writeDeploy(output);
  const admin = fs.readFileSync(path.join(output, 'Admin.html'), 'utf8');
  assert.match(admin, /var qrcode\s*=\s*function/);
  assert.doesNotMatch(admin, /__LOCAL_QR_LIBRARY__/);
  assert.doesNotMatch(admin, /__ADMIN_CONFIG_LIBRARY__/);
  assert.match(admin, /window.app5sAdminConfig/);
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

test('la administración usa la identidad visual DETECO clara con el logo oficial', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'deteco-5s-admin-brand-'));
  writeDeploy(output);
  const admin = fs.readFileSync(path.join(output, 'Admin.html'), 'utf8');
  assert.match(admin, /class="brand-logo"[^>]+alt="DETECO/);
  assert.match(admin, /--charcoal:#494741/i);
  assert.match(admin, /--orange:#f26522/i);
  assert.match(admin, /header[^}]*background:#fff/i);
  assert.doesNotMatch(admin, /class="brand">DETECO · 5S/);
});

test('el panel administrativo publica una vista Kaizen con filtros y carga diferida de evidencia', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'deteco-5s-admin-kaizen-'));
  writeDeploy(output);
  const admin = fs.readFileSync(path.join(output, 'Admin.html'), 'utf8');
  assert.match(admin, /href="#kaizen"[^>]*>[^<]*<img[^>]+>Kaizen/i);
  assert.match(admin, /id="kaizen-stations"/);
  assert.match(admin, /id="kaizen-status"/);
  assert.match(admin, /\.app5sAdminKaizenState\(/);
  assert.match(admin, /\.app5sAdminKaizenPhoto\(/);
  assert.match(admin, /data-evidence=/);
  assert.doesNotMatch(admin, /data-photo=|dataset\.photo/,
    'el navegador no debe recibir IDs internos de archivos Drive');
});

test('el panel distingue problemas de acceso Google y ofrece cambiar de cuenta o reintentar', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'deteco-5s-admin-account-'));
  writeDeploy(output);
  const admin = fs.readFileSync(path.join(output, 'Admin.html'), 'utf8');
  assert.match(admin, /id="access-actions"/);
  assert.match(admin, /id="account-switch"[^>]*>Iniciar o cambiar cuenta/);
  assert.match(admin, /id="retry-access"[^>]*>Volver a comprobar acceso/);
  assert.match(admin, /La cuenta activa no pertenece a DETECO y no tiene acceso a este panel/);
  assert.match(admin, /Tu cuenta DETECO todavía no tiene acceso al panel/);
  assert.match(admin, /const protocol = window\.location\.protocol/);
  assert.match(admin, /const slashPair = String\.fromCharCode\(47, 47\)/);
  assert.match(admin, /scriptOrigin \+ '\/a\/macros\/deteco\.cl\/s\/' \+ deploymentId/);
  assert.match(admin, /accountsOrigin \+ '\/AccountChooser\?continue=' \+ encodeURIComponent/);
  assert.match(admin, /\.app5sAdminState\(\)/);
});
