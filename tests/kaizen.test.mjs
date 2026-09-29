import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKaizenReviews, classifyNewFinding } from '../domain/kaizen.mjs';

const pending = [{ id: 'K-1', stationId: 'bodega', status: 'open' }, { id: 'K-2', stationId: 'bodega', status: 'open' }];

test('cada kaizen pendiente exige decisión semanal antes de las preguntas', () => {
  const result = validateKaizenReviews(pending, { 'K-1': { decision: 'pending', reason: 'Esperando repuesto' } });
  assert.deepEqual(result.missingDecisions, ['K-2']);
  assert.equal(result.canContinue, false);
});

test('resolver exige foto de solución ya sincronizada; nota es opcional', () => {
  const reviews = { 'K-1': { decision: 'solved' }, 'K-2': { decision: 'pending', reason: 'Falta material' } };
  assert.deepEqual(validateKaizenReviews(pending, reviews).missingEvidence, ['K-1']);
  reviews['K-1'].photoId = 'drive-solution-1';
  assert.equal(validateKaizenReviews(pending, reviews).canContinue, true);
});

test('dejar pendiente exige una justificación escrita ahora, incluso si es igual a la anterior', () => {
  const reviews = { 'K-1': { decision: 'pending', reason: '   ' }, 'K-2': { decision: 'pending', reason: 'Esperando repuesto' } };
  assert.deepEqual(validateKaizenReviews(pending, reviews).missingReasons, ['K-1']);
  reviews['K-1'].reason = 'Esperando repuesto';
  assert.equal(validateKaizenReviews(pending, reviews).canContinue, true);
});

test('un hallazgo repetido se vincula a un kaizen abierto sin duplicarlo', () => {
  const result = classifyNewFinding('bodega', { kind: 'existing', kaizenId: 'K-1' }, pending);
  assert.deepEqual(result, { action: 'link', kaizenId: 'K-1' });
  assert.throws(() => classifyNewFinding('oficina', { kind: 'existing', kaizenId: 'K-1' }, pending), /estación/i);
});

test('si reaparece uno ya cerrado, crea un kaizen nuevo ligado al anterior', () => {
  const previous = [{ id: 'K-3', stationId: 'bodega', status: 'closed' }];
  assert.deepEqual(classifyNewFinding('bodega', { kind: 'new', recurrenceOf: 'K-3' }, previous), { action: 'create', recurrenceOf: 'K-3' });
  assert.deepEqual(classifyNewFinding('bodega', { kind: 'new' }, previous), { action: 'create', recurrenceOf: null });
  assert.throws(() => classifyNewFinding('bodega', { kind: 'existing', kaizenId: 'K-3' }, previous), /abierto/i);
});
