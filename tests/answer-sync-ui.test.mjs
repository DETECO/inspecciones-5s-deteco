import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as catalog from '../domain/catalog.mjs';
import * as calendar from '../domain/calendar.mjs';
import * as inspection from '../domain/inspection.mjs';
import { validateInspection } from '../domain/scoring.mjs';
import { validateKaizenReviews } from '../domain/kaizen.mjs';
import { createBridgeSession } from '../client/bridge-session.mjs';
import { mergeServerState } from '../client/state-merge.mjs';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function appHarness(send, readImageForUpload = async () => 'data:image/jpeg;base64,AAAA') {
  const listeners = {};
  const appElement = { innerHTML: '', addEventListener: (event, fn) => { listeners[event] = fn; }, querySelector: () => null };
  const draft = { saved: null, async save(key, value) { this.saved = structuredClone(value); }, async load() { return this.saved; } };
  const storage = { getItem: () => 'phone-a', setItem() {} };
  class WorkDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-30T15:00:00.000Z'])); } }
  const context = vm.createContext({
    ...catalog, ...calendar, ...inspection, validateInspection, validateKaizenReviews, mergeServerState, createBridgeSession, readImageForUpload,
    resolveAppConfig: () => ({ mode: 'bridge', bridgeEndpoint: 'test' }),
    createIndexedDraftStore: () => draft, createFormBridge: () => ({ send }),
    localStorage: storage, sessionStorage: storage, crypto: { randomUUID: () => 'test-uuid' },
    navigator: { onLine: true }, Date: WorkDate,
    document: { querySelector: selector => selector === '#app' ? appElement : null, hidden: false, activeElement: null },
    window: { DETECO_5S_CONFIG: {}, addEventListener() {}, setInterval() {}, confirm: () => true },
  });
  const source = readFileSync(new URL('../client/app.mjs', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
    .replace(/initializeApp\(\);\s*$/, '');
  vm.runInContext(`${source}\nglobalThis.api = { state, changeAnswer, close, addFindingPhoto, refreshServerState, ensureBridgeSession, render };`, context);
  const api = context.api;
  Object.assign(api.state, {
    route: { stationId: 'oficina', accessToken: 't'.repeat(32) },
    station: { id: 'oficina', name: 'OFICINA' }, screen: 'module', qrAccessValidated: true,
    inspection: inspection.reserveInspection(inspection.createInspection({ stationId: 'oficina', week: '2026-W40' }), {
      clientId: 'phone-a', inspectorName: 'Inspector prueba', at: '2026-09-30T14:30:00Z',
    }),
  });
  api.ensureBridgeSession();
  return { ...api, appElement, draft, listeners };
}

test('25 respuestas rápidas permanecen seleccionadas entre módulos y cierran después de guardar', async () => {
  const firstSend = deferred();
  const releaseFirst = deferred();
  const secondSend = deferred();
  const releaseSecond = deferred();
  let remote;
  let callCount = 0;
  const app = appHarness(async request => {
    if (request.operation === 'save-answer') {
      remote = inspection.saveAnswer(remote, { ...request.payload });
      const snapshot = structuredClone(remote);
      if (++callCount === 1) { firstSend.resolve(); await releaseFirst.promise; }
      if (callCount === 2) { secondSend.resolve(); await releaseSecond.promise; }
      return { state: snapshot };
    }
    if (request.operation === 'close') {
      remote = inspection.closeInspection(remote, { ...request.payload, at: request.payload.occurredAt });
    }
    return { state: structuredClone(remote) };
  });
  remote = structuredClone(app.state.inspection);
  const saves = catalog.QUESTIONS.map(question => app.changeAnswer(question.id, 0));
  await firstSend.promise;
  app.listeners.click({ target: { closest: () => ({ dataset: { action: 'module', index: '4' } }) } });
  assert.equal(Object.keys(app.state.inspection.answers).length, 25);
  app.state.screen = 'review';
  const closing = app.close();
  releaseFirst.resolve();
  await secondSend.promise;
  try {
    assert.equal(Object.keys(app.state.inspection.answers).length, 25, 'La primera confirmación no debe borrar las otras 24 selecciones');
  } finally {
    releaseSecond.resolve();
    await Promise.all([...saves, closing]);
  }
  assert.equal(Object.keys(app.state.inspection.answers).length, 25);
  assert.equal(app.state.inspection.status, 'closed', app.state.error);
  assert.equal(app.state.screen, 'summary');
  assert.equal(remote.status, 'closed');
  assert.equal(app.draft.saved.inspection.status, 'closed');
});

test('una lectura antigua no borra respuestas confirmadas mientras esa lectura esperaba', async () => {
  const readStarted = deferred();
  const readRelease = deferred();
  let remote;
  const app = appHarness(async request => {
    if (request.operation === 'state') {
      const snapshot = structuredClone(remote);
      readStarted.resolve();
      await readRelease.promise;
      return { state: snapshot };
    }
    remote = inspection.saveAnswer(remote, request.payload);
    return { state: structuredClone(remote) };
  });
  remote = structuredClone(app.state.inspection);
  const refresh = app.refreshServerState();
  await readStarted.promise;
  await app.changeAnswer(catalog.QUESTIONS[0].id, 0);
  readRelease.resolve();
  await refresh;
  assert.equal(app.state.inspection.answers[catalog.QUESTIONS[0].id], 0);
});

test('la actualización periódica no devuelve al módulo cuando se está revisando el cierre', async () => {
  let remote;
  const app = appHarness(async () => ({ state: structuredClone(remote) }));
  remote = structuredClone(app.state.inspection);
  app.state.screen = 'review';
  await app.refreshServerState();
  assert.equal(app.state.screen, 'review');
});

test('un error de envío conserva las respuestas y la cola; reintentar permite cerrar', async () => {
  let remote;
  let fail = true;
  const app = appHarness(async request => {
    if (fail) throw new Error('Red temporalmente interrumpida');
    if (request.operation === 'save-answer') remote = inspection.saveAnswer(remote, request.payload);
    if (request.operation === 'close') remote = inspection.closeInspection(remote, { ...request.payload, at: request.payload.occurredAt });
    return { state: structuredClone(remote) };
  });
  remote = structuredClone(app.state.inspection);
  await Promise.all(catalog.QUESTIONS.map(question => app.changeAnswer(question.id, 0)));
  assert.equal(Object.keys(app.state.inspection.answers).length, 25);
  assert.equal(app.ensureBridgeSession().pending().length, 25);
  app.state.screen = 'review';
  fail = false;
  await app.close();
  assert.equal(app.state.inspection.status, 'closed', app.state.error);
  assert.equal(app.ensureBridgeSession().pending().length, 0);
});

test('doble clic en cerrar produce un solo cierre y bloquea nuevas selecciones', async () => {
  const releaseClose = deferred();
  const closeStarted = deferred();
  let closeCalls = 0;
  let remote;
  const app = appHarness(async request => {
    if (request.operation === 'close') {
      closeCalls += 1;
      closeStarted.resolve();
      await releaseClose.promise;
      remote = inspection.closeInspection(remote, { ...request.payload, at: request.payload.occurredAt });
    }
    return { state: structuredClone(remote) };
  });
  app.state.inspection.answers = Object.fromEntries(catalog.QUESTIONS.map(question => [question.id, 0]));
  remote = structuredClone(app.state.inspection);
  app.state.screen = 'review';
  const closing = app.close();
  await closeStarted.promise;
  await app.close();
  await app.changeAnswer(catalog.QUESTIONS[0].id, 3);
  assert.equal(app.state.inspection.answers[catalog.QUESTIONS[0].id], 0);
  releaseClose.resolve();
  await closing;
  assert.equal(closeCalls, 1);
  assert.equal(app.state.closing, false);
  assert.equal(app.state.inspection.status, 'closed');
});

test('una foto grande se prepara, se guarda y permite cerrar sin perder las 25 respuestas', async () => {
  const photoReady = deferred();
  const conversionStarted = deferred();
  let remote;
  const app = appHarness(async request => {
    if (request.operation === 'save-finding') remote = inspection.saveFinding(remote, {
      ...request.payload, finding: { id: request.payload.finding.id, photoId: 'drive-photo', note: request.payload.finding.note },
    });
    if (request.operation === 'close') remote = inspection.closeInspection(remote, { ...request.payload, at: request.payload.occurredAt });
    return { state: structuredClone(remote) };
  }, async file => {
    assert.equal(file.size, 5000000);
    conversionStarted.resolve();
    await photoReady.promise;
    return 'data:image/jpeg;base64,AAAA';
  });
  app.state.inspection.answers = Object.fromEntries(catalog.QUESTIONS.map((question, index) => [question.id, index === 0 ? 1 : 0]));
  remote = structuredClone(app.state.inspection);
  const uploading = app.addFindingPhoto({ files: [{ size: 5000000, type: 'image/jpeg' }], dataset: { question: catalog.QUESTIONS[0].id, ordinal: '1' } });
  await conversionStarted.promise;
  await app.close();
  assert.match(app.state.error, /fotografía/);
  assert.equal(app.state.inspection.status, 'open');
  photoReady.resolve();
  await uploading;
  assert.equal(app.state.photoUploads, 0);
  assert.equal(app.state.inspection.findings[catalog.QUESTIONS[0].id][0].photoId, 'drive-photo');
  assert.equal(Object.keys(app.state.inspection.answers).length, 25);
  await app.close();
  assert.equal(app.state.inspection.status, 'closed', app.state.error);
});

test('una lectura iniciada antes del cierre no puede reabrir la inspección ni su borrador', async () => {
  const readStarted = deferred();
  const releaseRead = deferred();
  let remote;
  const app = appHarness(async request => {
    if (request.operation === 'state') {
      const snapshot = structuredClone(remote);
      readStarted.resolve();
      await releaseRead.promise;
      return { state: snapshot };
    }
    if (request.operation === 'close') remote = inspection.closeInspection(remote, { ...request.payload, at: request.payload.occurredAt });
    return { state: structuredClone(remote) };
  });
  app.state.inspection.answers = Object.fromEntries(catalog.QUESTIONS.map(question => [question.id, 0]));
  remote = structuredClone(app.state.inspection);
  app.state.screen = 'review';
  const refresh = app.refreshServerState();
  await readStarted.promise;
  await app.close();
  releaseRead.resolve();
  await refresh;
  assert.equal(app.state.inspection.status, 'closed');
  assert.equal(app.draft.saved.inspection.status, 'closed');
  assert.equal(app.state.inspection.result.finalScore, 5);
});
