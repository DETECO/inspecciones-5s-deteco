import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../client/app.mjs', import.meta.url), 'utf8');

test('el nombre y la selección del inspector sobreviven a una actualización de pantalla', () => {
  assert.match(source, /if\s*\(target\.id\s*===\s*'inspector-name'\)\s*state\.inspectorName\s*=\s*target\.value/);
  assert.match(source, /const\s+activeElement\s*=\s*document\.activeElement/);
  assert.match(source, /setSelectionRange\(selectionStart, selectionEnd\)/);
});

test('el nombre queda guardado en el estado antes de solicitar reserva al servidor', () => {
  const start = source.slice(source.indexOf('async function start()'), source.indexOf('async function requestTakeoverFromCurrentEditor()'));
  assert.match(start, /state\.inspectorName\s*=\s*name/);
  assert.ok(start.indexOf('state.inspectorName = name') < start.indexOf("sendNow('reserve'"));
});

test('un tiempo de espera con internet no se etiqueta como falta de conexión', () => {
  const refresh = source.slice(source.indexOf('async function refreshServerState()'), source.indexOf('async function changeAnswer('));
  assert.match(refresh, /state\.syncStatus\s*=\s*navigator\.onLine\s*\?\s*'Sin respuesta'\s*:\s*'Sin conexión'/);
});
