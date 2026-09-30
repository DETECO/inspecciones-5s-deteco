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
