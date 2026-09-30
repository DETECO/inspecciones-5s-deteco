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
import { submitFinalInspection } from '../client/final-submit.mjs';

function harness(send = async () => { throw new Error('No debe enviar'); }) {
  const listeners = {};
  const appElement = { innerHTML: '', addEventListener: (event, fn) => { listeners[event] = fn; }, querySelector: () => ({ value: 'Inspector prueba' }) };
  const draft = { saves: 0, loads: 0, async save() { this.saves++; }, async load() { this.loads++; return { inspection: { status: 'open' } }; } };
  const storage = { getItem: () => 'phone-a', setItem() {} };
  class WorkDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-30T15:00:00Z'])); } }
  const context = vm.createContext({
    ...catalog, ...calendar, ...inspection, validateInspection, validateKaizenReviews, createBridgeSession, mergeServerState, submitFinalInspection,
    readImageForUpload: async () => 'data:image/jpeg;base64,AAAA', resolveAppConfig: () => ({ mode: 'bridge', bridgeEndpoint: 'test' }),
    createIndexedDraftStore: () => draft, createFormBridge: () => ({ send }),
    localStorage: storage, sessionStorage: storage, crypto: { randomUUID: () => 'test-session-12345678' }, navigator: { onLine: true }, Date: WorkDate,
    document: { querySelector: selector => selector === '#app' ? appElement : selector === '#inspector-name' ? { value: 'Inspector prueba' } : null, hidden: false, activeElement: null },
    window: { DETECO_5S_CONFIG: {}, addEventListener: (event, fn) => { listeners[event] = fn; }, setInterval() {}, confirm: () => true },
  });
  const source = readFileSync(new URL('../client/app.mjs', import.meta.url), 'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '').replace(/initializeApp\(\);\s*$/, '');
  vm.runInContext(`${source}\nglobalThis.api = { state, start, changeAnswer, close, addFindingPhoto, ensureBridgeSession, render, draftLoad };`, context);
  const api = context.api;
  Object.assign(api.state, { route: { stationId: 'oficina', accessToken: 't'.repeat(32) }, station: { id: 'oficina', name: 'OFICINA' }, screen: 'module', qrAccessValidated: true,
    inspection: inspection.reserveInspection(inspection.createInspection({ stationId: 'oficina', week: '2026-W40' }), { clientId: 'phone-a', inspectorName: 'Inspector prueba', at: '2026-09-30T14:30:00Z' }) });
  return { ...api, appElement, draft, listeners, navigator: context.navigator };
}
test('contestar25y cambiar módulos no envía ni escribe borradores retomables', async () => {
  const app = harness();
  for (const question of catalog.QUESTIONS) await app.changeAnswer(question.id, 0);
  app.listeners.click({ target: { closest: () => ({ dataset: { action: 'module', index: '4' } }) } });
  app.listeners.click({ target: { closest: () => ({ dataset: { action: 'module', index: '0' } }) } });
  assert.equal(Object.keys(app.state.inspection.answers).length, 25);
  assert.equal(app.draft.saves, 0);
});
test('la foto queda local y no inicia envío hasta cerrar', async () => {
  const app = harness();
  const question = catalog.QUESTIONS[0];
  await app.changeAnswer(question.id, 1);
  await app.addFindingPhoto({ files: [{}], dataset: { question: question.id, ordinal: '1' } });
  assert.match(app.state.inspection.findings[question.id][0].dataUri, /base64/);
  assert.equal(app.state.error, '');
  assert.equal(app.draft.saves, 0);
});
test('cierre fallido conserva25respuestas y reintento confirma snapshot completo', async () => {
  let fail = true;
  const calls = [];
  const app = harness(async request => {
    calls.push(request);
    if (fail) throw new Error('timeout');
    assert.equal(request.operation, 'submit-final');
    return { state: { ...app.state.inspection, status: 'closed', finalSessionId: request.payload.sessionId, result: { finalScore: 5, moduleScores: Object.fromEntries(catalog.MODULES.map(module => [module.id, 5])), completionStatus: 'cumplida' } } };
  });
  for (const question of catalog.QUESTIONS) await app.changeAnswer(question.id, 0);
  app.state.screen = 'review';
  await app.close();
  assert.equal(app.state.inspection.status, 'open');
  assert.equal(app.state.screen, 'review');
  assert.equal(Object.keys(app.state.inspection.answers).length, 25);
  fail = false;
  await app.close();
  assert.equal(app.state.inspection.status, 'closed');
  assert.equal(app.state.screen, 'summary');
  assert.equal(calls[0].payload.occurredAt, calls[1].payload.occurredAt);
});
test('no retoma el borrador antiguo', async () => {
  const app = harness();
  await app.draftLoad();
  assert.equal(app.draft.loads, 0);
  assert.equal(Object.keys(app.state.inspection.answers).length, 0);
});
test('sin internet no marca cierre exitoso ni pierde respuestas', async () => {
  const app = harness();
  for (const question of catalog.QUESTIONS) await app.changeAnswer(question.id, 0);
  app.navigator.onLine = false;
  await app.close();
  assert.equal(app.state.inspection.status, 'open');
  assert.match(app.state.error, /internet/);
  assert.equal(app.state.completedAt, '2026-09-30T15:00:00.000Z');
});

test('una semana cerrada por otra sesión bloquea el inicio sin mostrar un cierre propio', async () => {
  const app = harness(async () => ({ state: { ...app.state.inspection, status: 'closed', finalSessionId: 'another-session' } }));
  app.state.screen = 'identity';
  await app.start();
  assert.equal(app.state.screen, 'identity');
  assert.match(app.appElement.innerHTML, /ya está cerrada/);
  assert.doesNotMatch(app.appElement.innerHTML, /Registro guardado en/);
});
