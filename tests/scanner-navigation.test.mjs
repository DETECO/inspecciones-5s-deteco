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
  assert.match(scannedQrHandler, /state\.screen\s*=\s*['"]station-opening['"]/, 'la app debe mostrar la transición de estación');
  assert.match(scannedQrHandler, /state\.station\s*=/, 'la estación reconocida debe quedar disponible para mostrar su nombre');
  assert.match(scannedQrHandler, /render\(\)/, 'la identificación debe renderizarse tras reconocer el QR');
  assert.match(scannedQrHandler, /setTimeout\([\s\S]*?initializeApp\(\)/, 'la identificación debe abrirse después de la transición breve');
  assert.doesNotMatch(
    scannedQrHandler,
    /setScanFeedback\(['"]Estación reconocida\. Abriendo inspección…['"]\)[\s\S]*window\.location\.assign\(/,
    'no debe quedar bloqueada en el mensaje de apertura esperando una navegación completa',
  );
});

test('la transición del QR muestra el nombre de la estación y el arco de carga aprobado', () => {
  const openingPage = appSource.match(/function stationOpeningPage\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  const render = appSource.match(/function render\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.notEqual(openingPage, '', 'falta la pantalla animada posterior al QR');
  assert.match(openingPage, /station-loader-arc/);
  assert.match(openingPage, /stationName\(\)/);
  assert.match(render, /state\.screen\s*===\s*['"]station-opening['"]\s*\)\s*content\s*=\s*stationOpeningPage\(\)/);
  assert.match(appSource, /prefers-reduced-motion/);
});

test('un QR abierto desde la cámara del teléfono también muestra la transición de estación', () => {
  const initializer = appSource.match(/async function initializeApp\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  const routeActivator = appSource.match(/function activateRoute\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(routeActivator, /return\s+(?:openedFromQrUrl|fromQrUrl|routeFromUrl)/,
    'la carga debe distinguir un QR recién abierto desde su URL de un avance recuperado');
  assert.match(initializer, /(?:openedFromQrUrl|fromQrUrl|routeFromUrl)\s*=\s*activateRoute\(\)/,
    'la carga inicial debe detectar un enlace QR directo');
  assert.match(initializer, /if\s*\(openedFromQrUrl\)[\s\S]*?render\(\)[\s\S]*?setTimeout\([\s\S]*?station-opening[\s\S]*?initializeApp\(\)/,
    'un enlace QR directo debe mostrar la misma transición breve antes de identificación');
});

test('el enlace Administración abre la pantalla DETECO de inicio de sesión', () => {
  const header = appSource.match(/function header\(\) \{[\s\S]*?\n\}/)?.[0] || '';

  assert.match(header, /href="\.\/admin-login\.html"/);
  assert.doesNotMatch(header, /adminLoginUrl/);
  assert.doesNotMatch(header, /admin-link[^\n]*appConfig\.bridgeEndpoint/);
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
  assert.match(identity, /data-action="rescan-qr"/);
  assert.match(clickHandler, /rescan-qr/);
  assert.doesNotMatch(clickHandler, /retry-qr-validation/);
  assert.doesNotMatch(onlineHandler, /initializeApp\(\)/,
    'al recuperar internet no debe disparar una consulta bloqueante antes de que el inspector inicie');
});

test('la ruta QR restaurada desde sessionStorage valida estación y token', () => {
  const routeReader = appSource.match(/function storageReadFromSession\(key\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(routeReader, /parseQrRoute/);
  assert.match(routeReader, /STATIONS\.some/,
    'la ruta guardada solo puede recuperar una estación conocida');
});

test('la estación aparece sin una consulta previa al servidor; iniciar realiza la reserva validada', () => {
  const initializer = appSource.match(/async function initializeApp\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  const start = appSource.match(/async function start\(\) \{[\s\S]*?\n\}/)?.[0] || '';

  assert.ok(initializer.indexOf('render()') >= 0, 'el acceso QR debe dibujar la pantalla enseguida');
  assert.doesNotMatch(initializer, /await draftLoad\(\)/,
    'el nuevo flujo no retoma borradores');
  assert.doesNotMatch(initializer, /readState\(\)/,
    'no debe esperar una consulta de estado para mostrar la estación');
  assert.match(start, /sendNow\('begin-final'/,
    'el servidor debe validar el QR y reservar en el mismo paso al iniciar');
  assert.match(start, /qrValidationPending\s*=\s*true/,
    'la pantalla debe indicar que está comprobando y reservando durante la petición');
  assert.doesNotMatch(appSource, /setInterval\(refreshServerState/,
    'no hay sincronización periódica de respuestas');
});
