import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../client/app.mjs', import.meta.url), 'utf8');
const scannedQrHandler = appSource.match(
  /async function handleScannedQr\(result\) \{[\s\S]*?\n\}\n\nfunction openScanner\(/,
)?.[0] || '';

test('al reconocer un QR guarda la ruta y muestra la identificación de la estación', () => {
  assert.notEqual(scannedQrHandler, '', 'no se encontró el callback de lectura QR');
  assert.match(
    scannedQrHandler,
    /sessionStorage\.setItem\(sessionKey,\s*JSON\.stringify\(/,
    'la ruta reconocida debe quedar guardada antes de depender de la navegación',
  );
  assert.match(scannedQrHandler, /state\.route\s*=/, 'la ruta reconocida debe activar el estado de la app');
  assert.match(scannedQrHandler, /state\.screen\s*=\s*['"]identity['"]/, 'la app debe pasar a identificación');
  assert.match(scannedQrHandler, /state\.station\s*=/, 'la estación reconocida debe quedar disponible para mostrar su nombre');
  assert.match(scannedQrHandler, /render\(\)/, 'la identificación debe renderizarse tras reconocer el QR');
  assert.doesNotMatch(
    scannedQrHandler,
    /setScanFeedback\(['"]Estación reconocida\. Abriendo inspección…['"]\)[\s\S]*window\.location\.assign\(/,
    'no debe quedar bloqueada en el mensaje de apertura esperando una navegación completa',
  );
});

test('el acceso local no deja el botón de inicio bloqueado tras leer el QR', () => {
  const initializer = appSource.match(/async function initializeApp\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(initializer, /\} else \{[\s\S]*?qrValidationPending\s*=\s*false;[\s\S]*?qrAccessValidated\s*=\s*true;/,
    'el modo local debe finalizar la validación visual del QR');
  assert.match(initializer, /qrValidationPending\s*=\s*false/,
    'la validación nunca debe quedar pendiente indefinidamente');
});

test('la pantalla de identificación ofrece recuperación si falla o no hay conexión', () => {
  const identity = appSource.match(/function identityPage\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  const clickHandler = appSource.match(/appElement\.addEventListener\('click',[\s\S]*?\n\}\);/)?.[0] || '';
  const onlineHandler = appSource.match(/window\.addEventListener\('online',[\s\S]*?\n\}\);/)?.[0] || '';
  assert.match(identity, /data-action="retry-qr-validation"/);
  assert.match(identity, /data-action="rescan-qr"/);
  assert.match(clickHandler, /retry-qr-validation/);
  assert.match(clickHandler, /rescan-qr/);
  assert.match(onlineHandler, /qrAccessValidated/,
    'al volver internet debe revalidar automáticamente la estación');
});

test('la ruta QR restaurada desde sessionStorage valida estación y token', () => {
  const routeReader = appSource.match(/function storageReadFromSession\(key\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(routeReader, /parseQrRoute/);
  assert.match(routeReader, /STATIONS\.some/,
    'la ruta guardada solo puede recuperar una estación conocida');
});
