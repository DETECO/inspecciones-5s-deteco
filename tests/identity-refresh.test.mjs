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
  const start = source.slice(source.indexOf('async function start()'), source.indexOf('async function changeAnswer('));
  assert.match(start, /state\.inspectorName\s*=\s*name/);
  assert.ok(start.indexOf('state.inspectorName = name') < start.indexOf("sendNow('begin-final'"));
});

test('no existe actualización periódica que pueda reemplazar respuestas', () => {
  assert.doesNotMatch(source, /setInterval\(refreshServerState/);
  assert.doesNotMatch(source, /sendNow\('save-answer'/);
});
