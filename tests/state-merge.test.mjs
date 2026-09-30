import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeServerState } from '../client/state-merge.mjs';

test('una confirmación anterior no borra respuestas todavía pendientes, incluido cero', () => {
  const merged = mergeServerState({ answers: { 'SEP-01': 1 } }, {
    answers: { 'SEP-01': 1, 'SEP-02': 0, 'SEP-03': 2 },
  }, [
    { operation: 'save-answer', payload: { questionId: 'SEP-02', count: 0 } },
    { operation: 'save-answer', payload: { questionId: 'SEP-03', count: 2 } },
  ]);
  assert.deepEqual(merged.answers, { 'SEP-01': 1, 'SEP-02': 0, 'SEP-03': 2 });
});

test('prevalece la última selección pendiente de la misma pregunta', () => {
  const merged = mergeServerState({ answers: { 'SEP-01': 1 } }, { answers: { 'SEP-01': 0 } }, [
    { operation: 'save-answer', payload: { questionId: 'SEP-01', count: 3 } },
    { operation: 'save-answer', payload: { questionId: 'SEP-01', count: 0 } },
  ]);
  assert.equal(merged.answers['SEP-01'], 0);
});

test('un cambio pendiente de foto y nota no se sustituye por la foto anterior', () => {
  const local = { findings: { 'SEP-01': [{ id: 'H-1', photoId: 'local-new', preview: 'new-photo', dataUri: 'new-photo', note: 'Nota nueva' }] } };
  const remote = { findings: { 'SEP-01': [{ id: 'H-1', photoId: 'drive-old', note: 'Nota anterior' }] } };
  const merged = mergeServerState(remote, local, [{ operation: 'save-finding', payload: { questionId: 'SEP-01', ordinal: 1, finding: { id: 'H-1', dataUri: 'new-photo', note: 'Nota nueva' } } }]);
  assert.deepEqual(merged.findings['SEP-01'][0], local.findings['SEP-01'][0]);
});

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

test('el cierre confirmado y la liberación de un editor no se revierten con cambios pendientes', () => {
  const local = { editor: { clientId: 'phone-a' }, answers: { 'SEP-01': 0 } };
  const pending = [{ operation: 'save-answer', payload: { questionId: 'SEP-01', count: 0 } }];
  for (const remote of [
    { status: 'closed', answers: { 'SEP-01': 1 }, editor: null },
    { status: 'open', answers: { 'SEP-01': 1 }, editor: { clientId: 'phone-b' } },
  ]) assert.equal(mergeServerState(remote, local, pending).answers['SEP-01'], 1);
});

test('una foto confirmada conserva los datos locales necesarios para guardar su nota', () => {
  const merged = mergeServerState({ findings: { 'SEP-01': [{ id: 'H-1', photoId: 'drive-1' }] } }, {
    findings: { 'SEP-01': [{ id: 'H-1', photoId: 'local-1', preview: 'photo', dataUri: 'photo' }] },
  });
  assert.equal(merged.findings['SEP-01'][0].photoId, 'drive-1');
  assert.equal(merged.findings['SEP-01'][0].dataUri, 'photo');
});

test('una foto pendiente conserva su número de hallazgo aunque se adjunte la segunda primero', () => {
  const items = [];
  items[1] = { id: 'H-2', photoId: 'local-2', preview: 'photo' };
  const merged = mergeServerState({ answers: { 'SEP-01': 2 }, findings: {} }, {
    findings: { 'SEP-01': items },
  }, [{ operation: 'save-finding', payload: { questionId: 'SEP-01', ordinal: 2, finding: { id: 'H-2' } } }]);
  assert.equal(merged.findings['SEP-01'][0], undefined);
  assert.equal(merged.findings['SEP-01'][1].id, 'H-2');
});

test('reducir y luego agregar otro hallazgo no borra su fotografía pendiente', () => {
  const photo = { id: 'H-new', photoId: 'local-new', preview: 'new' };
  const merged = mergeServerState({ answers: { 'SEP-01': 1 }, findings: { 'SEP-01': [{ id: 'H-old', photoId: 'drive-old' }] } }, {
    findings: { 'SEP-01': [photo] },
  }, [
    { operation: 'save-answer', payload: { questionId: 'SEP-01', count: 0 } },
    { operation: 'discard-extra-findings', payload: { questionId: 'SEP-01' } },
    { operation: 'save-answer', payload: { questionId: 'SEP-01', count: 1 } },
    { operation: 'save-finding', payload: { questionId: 'SEP-01', ordinal: 1, finding: { id: 'H-new' } } },
  ]);
  assert.equal(merged.answers['SEP-01'], 1);
  assert.equal(merged.findings['SEP-01'][0].photoId, 'local-new');
});
