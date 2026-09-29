import test from 'node:test';
import assert from 'node:assert/strict';
import { createIndexedDraftStore } from '../client/draft-store.mjs';

function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function fakeIndexedDb() {
  const values = new Map();
  let created = false;
  const database = {
    objectStoreNames: { contains: () => created },
    createObjectStore: () => { created = true; },
    transaction: () => ({
      objectStore: () => ({
        get: key => request(values.has(key) ? clone(values.get(key)) : undefined),
        put: (value, key) => request(undefined, () => values.set(key, clone(value))),
        delete: key => request(undefined, () => values.delete(key)),
      }),
    }),
  };
  function request(result, onSuccess) {
    const output = {};
    queueMicrotask(() => {
      onSuccess?.();
      output.result = result;
      output.onsuccess?.({ target: output });
    });
    return output;
  }
  return {
    open: () => {
      const output = {};
      queueMicrotask(() => {
        output.result = database;
        output.onupgradeneeded?.({ target: output });
        output.onsuccess?.({ target: output });
      });
      return output;
    },
  };
}

test('persiste el borrador y las fotos locales fuera de localStorage', async () => {
  const store = createIndexedDraftStore({ indexedDBApi: fakeIndexedDb() });
  const draft = { inspection: { findings: { 'SEP-01': [{ id: 'H-1', dataUri: 'data:image/jpeg;base64,AAAA' }] } } };
  await store.save('bodega:2026-W39', draft);
  draft.inspection.findings['SEP-01'][0].dataUri = 'changed';

  assert.deepEqual(await store.load('bodega:2026-W39'), {
    inspection: { findings: { 'SEP-01': [{ id: 'H-1', dataUri: 'data:image/jpeg;base64,AAAA' }] } },
  });
});

test('eliminar un borrador no afecta los demás borradores de estaciones', async () => {
  const store = createIndexedDraftStore({ indexedDBApi: fakeIndexedDb() });
  await store.save('bodega:2026-W39', { answer: 1 });
  await store.save('oficina:2026-W39', { answer: 2 });
  await store.remove('bodega:2026-W39');
  assert.equal(await store.load('bodega:2026-W39'), null);
  assert.deepEqual(await store.load('oficina:2026-W39'), { answer: 2 });
});
