import test from 'node:test';
import assert from 'node:assert/strict';
import { submitFinalInspection } from '../client/final-submit.mjs';

function data() {
  return { answers: { 'SEP-01': 1 }, findings: { 'SEP-01': [{ id: 'finding-12345678', photoId: 'local-test', dataUri: 'data:image/jpeg;base64,AAAA', note: 'Nota' }] }, kaizenReviews: { 'kaizen-12345678': { decision: 'solved', dataUri: 'data:image/jpeg;base64,AAAA' } } };
}
test('cierre envía fotos y luego snapshot sin base64 ni resultados calculados por cliente', async () => {
  const original = data();
  const calls = [];
  const receipt = await submitFinalInspection({ session: { async sendNow(operation, payload) { calls.push({ operation, payload }); return operation === 'submit-final' ? { state: { status: 'closed', finalSessionId: payload.sessionId } } : { photoId: `drive-${calls.length}` }; } }, inspection: original, sessionId: 'session-12345678', occurredAt: '2026-09-30T15:00:00Z', uploadCache: new Map() });
  assert.deepEqual(calls.map(item => item.operation), ['upload-final-photo', 'upload-final-photo', 'submit-final']);
  assert.equal(calls[2].payload.findings['SEP-01'][0].photoId, 'drive-1');
  assert.equal(calls[2].payload.kaizenReviews['kaizen-12345678'].photoId, 'drive-2');
  assert.ok(!JSON.stringify(calls[2].payload).includes('base64'));
  assert.equal(original.findings['SEP-01'][0].photoId, 'local-test');
  assert.equal(receipt.state.status, 'closed');
});
test('reintentar cierre conserva ID de fotos y reutiliza uploads confirmados', async () => {
  const cache = new Map();
  const calls = [];
  let fail = true;
  const args = { session: { async sendNow(operation, payload) { calls.push({ operation, payload }); if (operation === 'submit-final' && fail) throw new Error('timeout'); return operation === 'submit-final' ? { state: { status: 'closed', finalSessionId: payload.sessionId } } : { photoId: `drive-${calls.length}` }; } }, inspection: data(), sessionId: 'session-12345678', occurredAt: '2026-09-30T15:00:00Z', uploadCache: cache };
  await assert.rejects(submitFinalInspection(args), /timeout/);
  fail = false;
  await submitFinalInspection(args);
  assert.equal(calls.filter(item => item.operation === 'upload-final-photo').length, 2);
  assert.deepEqual(calls[2].payload, calls[3].payload);
});
test('sin cierre confirmado no se anuncia éxito', async () => {
  await assert.rejects(submitFinalInspection({ session: { async sendNow() { return {}; } }, inspection: { answers: {}, findings: {}, kaizenReviews: {} }, sessionId: 'session-12345678', occurredAt: '2026-09-30T15:00:00Z', uploadCache: new Map() }), /confirmación/);
});

test('snapshot final incluye decisión GD explícita sin nota calculada por cliente', async () => {
  let sent;
  await submitFinalInspection({ session: { async sendNow(operation, payload) { sent = payload; return { state: { status: 'closed', finalSessionId: payload.sessionId } }; } }, inspection: { answers: {}, findings: {}, kaizenReviews: {}, dailyManagementApplicable: false }, sessionId: 'session-12345678', occurredAt: '2026-09-30T15:00:00Z', uploadCache: new Map() });
  assert.equal(sent.dailyManagementApplicable, false);
  assert.equal(sent.result, undefined);
});

test('progreso cuenta solo fotos confirmadas y termina con confirmación, no porcentaje ficticio', async () => {
  const progress = [];
  const inspection = data();
  await submitFinalInspection({ session: { async sendNow(operation, payload) {
    if (operation === 'upload-final-photo') return { photoId: payload.photoId };
    return { state: { status: 'closed', finalSessionId: payload.sessionId, finalMaterialized: true } };
  } }, inspection, sessionId: 'session-12345678', uploadCache: new Map(), onProgress: (message, detail) => progress.push({ message, detail }) });
  assert.ok(progress.some(p => p.detail?.phase === 'photos' && p.detail.completed === 0 && p.detail.total === 2));
  assert.ok(progress.some(p => p.detail?.phase === 'photos' && p.detail.completed === 1));
  assert.ok(progress.some(p => p.detail?.phase === 'saving' && p.detail.completed === 2));
  assert.equal(progress.at(-1).detail.phase, 'confirmed');
});

test('acuse perdido se comprueba con lectura y recupera cierre materializado de la misma sesión', async () => {
  const calls = [];
  const progress = [];
  const state = { status: 'closed', stationId: 'oficina', week: '2026-W40', finalSessionId: 'session-12345678', finalMaterialized: true };
  const result = await submitFinalInspection({ session: { async sendNow(operation) {
    calls.push(operation);
    if (operation === 'submit-final') throw Object.assign(new Error('timeout'), { code: 'BRIDGE_TIMEOUT' });
    return { state };
  } }, inspection: { stationId: 'oficina', week: '2026-W40', answers: {}, findings: {}, kaizenReviews: {} }, sessionId: state.finalSessionId, uploadCache: new Map(), onProgress: (_, detail) => progress.push(detail) });
  assert.equal(result.state, state);
  assert.deepEqual(calls, ['submit-final', 'final-state']);
  assert.ok(progress.some(p => p?.phase === 'checking'));
});

test('recuperación rechaza cerrado incompleto, otra sesión, otra estación o semana', async () => {
  for (const change of [{ finalMaterialized: false }, { finalSessionId: 'other-session-12345' }, { stationId: 'bodega' }, { week: '2026-W41' }]) {
    const calls = [];
    const state = { status: 'closed', stationId: 'oficina', week: '2026-W40', finalSessionId: 'session-12345678', finalMaterialized: true, ...change };
    await assert.rejects(submitFinalInspection({ session: { async sendNow(operation) {
      calls.push(operation);
      if (operation === 'submit-final') throw Object.assign(new Error('timeout'), { code: 'BRIDGE_TIMEOUT' });
      return { state };
    } }, inspection: { stationId: 'oficina', week: '2026-W40', answers: {}, findings: {}, kaizenReviews: {} }, sessionId: 'session-12345678', uploadCache: new Map() }), /confirm|complet|otra/);
    assert.deepEqual(calls, ['submit-final', 'final-state']);
  }
});

test('reintento consulta antes de reenviar y no duplica un cierre confirmado tardíamente', async () => {
  const submissionState = {};
  const calls = [];
  let completed = false;
  const inspection = { stationId: 'oficina', week: '2026-W40', answers: {}, findings: {}, kaizenReviews: {} };
  const args = { session: { async sendNow(operation) {
    calls.push(operation);
    if (operation === 'submit-final') throw Object.assign(new Error('timeout'), { code: 'BRIDGE_TIMEOUT' });
    return { state: completed ? { ...inspection, status: 'closed', finalSessionId: 'session-12345678', finalMaterialized: true } : { ...inspection, status: 'open' } };
  } }, inspection, sessionId: 'session-12345678', uploadCache: new Map(), submissionState };
  await assert.rejects(submitFinalInspection(args), /confirm/);
  completed = true;
  const result = await submitFinalInspection(args);
  assert.equal(result.state.status, 'closed');
  assert.deepEqual(calls, ['submit-final', 'final-state', 'final-state']);
});
