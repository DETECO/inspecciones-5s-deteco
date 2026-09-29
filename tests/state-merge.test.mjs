import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeServerState } from '../client/state-merge.mjs';

test('la respuesta segura del servidor conserva solo la miniatura local de la misma foto', () => {
  const local = {
    findings: { 'SEP-01': [{ id: 'H-1', photoId: 'local-1', preview: 'data:image/jpeg;base64,AAAA' }] },
    kaizenReviews: { 'K-1': { decision: 'solved', photoId: 'local-k', preview: 'data:image/jpeg;base64,BBBB' } },
  };
  const remote = {
    findings: { 'SEP-01': [{ id: 'H-1', photoId: 'drive-1' }] },
    kaizenReviews: { 'K-1': { decision: 'solved', photoId: 'drive-k' } },
  };
  const merged = mergeServerState(remote, local);
  assert.equal(merged.findings['SEP-01'][0].photoId, 'drive-1');
  assert.equal(merged.findings['SEP-01'][0].preview, 'data:image/jpeg;base64,AAAA');
  assert.equal(merged.kaizenReviews['K-1'].photoId, 'drive-k');
  assert.equal(merged.kaizenReviews['K-1'].preview, 'data:image/jpeg;base64,BBBB');
});

test('no transfiere una miniatura a un hallazgo distinto', () => {
  const merged = mergeServerState({ findings: { 'SEP-01': [{ id: 'H-2', photoId: 'drive-2' }] }, kaizenReviews: {} }, { findings: { 'SEP-01': [{ id: 'H-1', preview: 'data:image/jpeg;base64,AAAA' }] }, kaizenReviews: {} });
  assert.equal(merged.findings['SEP-01'][0].preview, undefined);
});

test('conserva una foto local nueva mientras su envío siga pendiente', () => {
  const local = { findings: { 'SEP-01': [{ id: 'H-2', preview: 'data:image/jpeg;base64,BBBB', dataUri: 'data:image/jpeg;base64,BBBB' }] } };
  const remote = { findings: { 'SEP-01': [] } };
  const pending = [{ operation: 'save-finding', payload: { finding: { id: 'H-2' } } }];
  const merged = mergeServerState(remote, local, pending);
  assert.equal(merged.findings['SEP-01'][0].preview, 'data:image/jpeg;base64,BBBB');
});

test('descarta una foto local que ya no está en la respuesta ni pendiente de envío', () => {
  const local = { findings: { 'SEP-01': [{ id: 'H-2', preview: 'data:image/jpeg;base64,BBBB' }] } };
  const merged = mergeServerState({ findings: { 'SEP-01': [] } }, local, []);
  assert.deepEqual(merged.findings['SEP-01'], []);
});
