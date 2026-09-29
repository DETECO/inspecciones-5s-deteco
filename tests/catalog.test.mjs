import test from 'node:test';
import assert from 'node:assert/strict';
import { STATIONS, MODULES, QUESTIONS, getQuestion } from '../domain/catalog.mjs';

test('las nueve estaciones iniciales tienen una sola entrada por obra', () => {
  assert.equal(STATIONS.length, 9);
  assert.equal(new Set(STATIONS.map(station => station.id)).size, 9);
  assert.deepEqual(STATIONS.filter(station => station.kind === 'obra').map(station => station.name), ['OBRA SANTA JULIA']);
});

test('las cinco S contienen exactamente las 25 preguntas aprobadas', () => {
  assert.deepEqual(MODULES.map(module => module.questions.length), [4, 5, 5, 6, 5]);
  assert.deepEqual(MODULES.map(module => module.title), ['SEPARAR', 'ORGANIZAR', 'LIMPIAR', 'ESTANDARIZAR', 'SUSTENTAR']);
  assert.equal(QUESTIONS.length, 25);
  assert.equal(new Set(QUESTIONS.map(question => question.id)).size, 25);
});

test('Limpiar 1 combina las dos verificaciones en un ítem y una nota', () => {
  const question = getQuestion('LIM-01');
  assert.match(question.text, /áreas de trabajo limpias/i);
  assert.match(question.text, /mantiene la limpieza durante la jornada/i);
  assert.equal(QUESTIONS.filter(item => item.id === 'LIM-01').length, 1);
});

test('cada identificador responde al módulo correcto', () => {
  assert.equal(getQuestion('SEP-04').moduleId, 'separar');
  assert.equal(getQuestion('ORG-05').moduleId, 'organizar');
  assert.equal(getQuestion('EST-06').moduleId, 'estandarizar');
  assert.equal(getQuestion('SUS-05').moduleId, 'sustentar');
  assert.equal(getQuestion('INEXISTENTE'), null);
});
