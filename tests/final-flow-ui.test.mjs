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
import * as dailyManagement from '../domain/daily-management.mjs';
import { inspectionStatus } from '../client/inspection-status.mjs';

function harness(send = async () => { throw new Error('No debe enviar'); }) {
  const listeners = {};
  const confirmations = [];
  const appElement = { innerHTML: '', addEventListener: (event, fn) => { listeners[event] = fn; }, querySelector: () => ({ value: 'Inspector prueba' }) };
  const draft = { saves: 0, loads: 0, async save() { this.saves++; }, async load() { this.loads++; return { inspection: { status: 'open' } }; } };
  const storage = { getItem: () => 'phone-a', setItem() {} };
  class WorkDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-30T15:00:00Z'])); } }
  const context = vm.createContext({
    ...catalog, ...calendar, ...inspection, ...dailyManagement, inspectionStatus, validateInspection, validateKaizenReviews, createBridgeSession, mergeServerState, submitFinalInspection,
    readImageForUpload: async () => 'data:image/jpeg;base64,AAAA', resolveAppConfig: () => ({ mode: 'bridge', bridgeEndpoint: 'test' }),
    createIndexedDraftStore: () => draft, createFormBridge: () => ({ send }),
    localStorage: storage, sessionStorage: storage, crypto: { randomUUID: () => 'test-session-12345678' }, navigator: { onLine: true }, Date: WorkDate,
    document: { querySelector: selector => selector === '#app' ? appElement : selector === '#inspector-name' ? { value: 'Inspector prueba' } : null, hidden: false, activeElement: null },
    window: { DETECO_5S_CONFIG: {}, addEventListener: (event, fn) => { listeners[event] = fn; }, setInterval() {}, confirm: message => { confirmations.push(message); return true; } },
  });
  const source = readFileSync(new URL('../client/app.mjs', import.meta.url), 'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '').replace(/initializeApp\(\);\s*$/, '');
  vm.runInContext(`${source}\nglobalThis.api = { state, start, changeAnswer, close, addFindingPhoto, ensureBridgeSession, render, draftLoad };`, context);
  const api = context.api;
  Object.assign(api.state, { route: { stationId: 'oficina', accessToken: 't'.repeat(32) }, station: { id: 'oficina', name: 'OFICINA' }, screen: 'module', qrAccessValidated: true,
    inspection: inspection.reserveInspection(inspection.createInspection({ stationId: 'oficina', week: '2026-W40' }), { clientId: 'phone-a', inspectorName: 'Inspector prueba', at: '2026-09-30T14:30:00Z' }) });
  return { ...api, appElement, draft, listeners, navigator: context.navigator, confirmations, setConfirm: answer => { context.window.confirm = message => { confirmations.push(message); return answer; }; } };
}
test('contestar25y cambiar módulos no envía ni escribe borradores retomables', async () => {
  const app = harness();
  for (const question of catalog.QUESTIONS) await app.changeAnswer(question.id, 0);
  app.listeners.click({ target: { closest: () => ({ dataset: { action: 'module', index: '4' } }) } });
  app.listeners.click({ target: { closest: () => ({ dataset: { action: 'module', index: '0' } }) } });
  assert.equal(Object.keys(app.state.inspection.answers).length, 25);
  assert.equal(app.draft.saves, 0);
});

test('cierre muestra avance de fotos y espera de Sheet en lugar de revisión inmóvil', () => {
  const app = harness();
  app.state.screen = 'review';
  app.state.closing = true;
  app.state.closeProgress = { phase: 'photos', completed: 1, total: 3, message: 'Fotos confirmadas: 1 de 3' };
  app.render();
  assert.match(app.appElement.innerHTML, /Fotos confirmadas: 1 de 3/);
  assert.match(app.appElement.innerHTML, /<progress[^>]*value="1"[^>]*max="3"/);
  assert.doesNotMatch(app.appElement.innerHTML, /Revisa los faltantes/);
  app.state.closeProgress = { phase: 'saving', completed: 3, total: 3, message: 'Guardando en Google Sheets…' };
  app.render();
  assert.match(app.appElement.innerHTML, /<progress[^>]*aria-label="Guardado en el servidor"/);
  assert.doesNotMatch(app.appElement.innerHTML.match(/<progress[^>]*>/)?.[0] || '', /value=/);
});

test('preguntas usan marca desplazable y franja compacta; navegación no tapa contenido', () => {
  const app = harness();
  app.render();
  assert.match(app.appElement.innerHTML, /class="inspection-brand"/);
  assert.match(app.appElement.innerHTML, /class="header compact-header"/);
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.inspection-shell \.footer\s*\{[^}]*position:\s*static/s);
  assert.match(css, /\.compact-header \.header-inner\s*\{[^}]*padding:\s*8px/s);
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
    if (request.operation === 'final-state') return { state: app.state.inspection };
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
  const submissions = calls.filter(request => request.operation === 'submit-final');
  assert.equal(submissions[0].payload.occurredAt, submissions[1].payload.occurredAt);
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

test('el primer intento de cierre usa el reloj confirmado, no la hora incorrecta del teléfono',async()=>{
  const app=harness(async()=>{throw new Error('timeout');});
  app.state.serverTime=new Date('2026-09-30T14:59:00Z').getTime();
  app.state.serverCheckedAt=new Date('2026-09-30T15:00:00Z').getTime();
  for(const question of catalog.QUESTIONS)await app.changeAnswer(question.id,0);
  await app.close();
  assert.equal(app.state.completedAt,'2026-09-30T14:59:00.000Z');
});

test('una semana cerrada por otra sesión bloquea el inicio sin mostrar un cierre propio', async () => {
  const app = harness(async () => ({ state: { ...app.state.inspection, status: 'closed', finalSessionId: 'another-session' } }));
  app.state.screen = 'identity';
  await app.start();
  assert.equal(app.state.screen, 'identity');
  assert.match(app.appElement.innerHTML, /ya está cerrada/);
  assert.doesNotMatch(app.appElement.innerHTML, /Registro guardado en/);
});

const click = (app, action, extra = {}) => app.listeners.click({ target: { closest: () => ({ dataset: { action, ...extra } }) } });
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('después de25preguntas ofrece decisión GD sin escribir en Google', async () => {
  const app = harness();
  app.state.inspection.dailyManagementApplicable = null;
  click(app, 'review');
  assert.equal(app.state.screen, 'module', 'no debe preguntar antes de las25');
  for (const question of catalog.QUESTIONS) await app.changeAnswer(question.id, 0);
  click(app, 'review');
  assert.equal(app.state.screen, 'daily-management-choice');
  assert.match(app.appElement.innerHTML, /¿Corresponde/);
  assert.equal(app.draft.saves, 0);
});

test('No solicita confirmación y cancelar conserva respuestas sin cerrar', async () => {
  const calls = [];
  const app = harness(async request => { calls.push(request); throw new Error('No debe cerrar'); });
  app.state.inspection.dailyManagementApplicable = null;
  for (const question of catalog.QUESTIONS) await app.changeAnswer(question.id, 0);
  click(app, 'review');
  app.setConfirm(false);
  click(app, 'daily-management-no');
  await settle();
  assert.equal(calls.length, 0);
  assert.equal(app.confirmations.length, 1);
  assert.match(app.confirmations[0], /Confirmas cerrar/);
  assert.equal(app.state.screen, 'daily-management-choice');
  assert.equal(app.state.inspection.status, 'open');
  assert.equal(Object.keys(app.state.inspection.answers).length, 25);
});

test('Sí muestra ocho GD, exige respuestas y conserva25al navegar', async () => {
  const app = harness();
  for (const question of catalog.QUESTIONS) await app.changeAnswer(question.id, 0);
  click(app, 'daily-management-yes');
  assert.equal(app.state.moduleIndex, 5);
  assert.equal(app.state.inspection.dailyManagementApplicable, true);
  assert.match(app.appElement.innerHTML, /GD-08/);
  await app.close();
  assert.match(app.state.error, /respuesta/);
  for (const question of catalog.DAILY_MANAGEMENT.questions) await app.changeAnswer(question.id, 0);
  click(app, 'module', { index: '0' });
  click(app, 'module', { index: '5' });
  assert.equal(Object.keys(app.state.inspection.answers).length, 33);
  assert.match(app.appElement.innerHTML, /33 de 33/);
});

test('No confirmado envía25y confirma cierre; Sí con fotoGD envía33en snapshot único', async () => {
  for (const applicable of [false, true]) {
    const calls = [];
    const app = harness(async request => {
      calls.push(request);
      if (request.operation === 'upload-final-photo') return { photoId: 'drive-gd' };
      assert.equal(request.operation, 'submit-final');
      assert.equal(request.payload.dailyManagementApplicable, applicable);
      assert.equal(Object.keys(request.payload.answers).length, applicable ? 33 : 25);
      return { state: { ...inspection.closeInspection(app.state.inspection, { clientId: 'phone-a', at: '2026-09-30T15:00:00Z' }), finalSessionId: request.payload.sessionId } };
    });
    app.state.inspection.dailyManagementApplicable = null;
    for (const q of catalog.QUESTIONS) await app.changeAnswer(q.id, 0);
    click(app, 'review');
    if (applicable) {
      click(app, 'daily-management-yes');
      for (const q of catalog.DAILY_MANAGEMENT.questions) await app.changeAnswer(q.id, 0);
      await app.changeAnswer('GD-01', 1);
      await app.addFindingPhoto({ files: [{}], dataset: { question: 'GD-01', ordinal: '1' } });
      assert.equal(calls.length, 0);
      await app.close();
      assert.equal(app.state.inspection.result.dailyManagement.score, 4.875);
    } else {
      click(app, 'daily-management-no');
      await settle();
      await settle();
    }
    assert.equal(app.confirmations.length, 1);
    assert.equal(app.state.screen, 'summary');
    assert.equal(app.state.syncStatus, 'Guardado confirmado');
    assert.equal(calls.filter(r => r.operation === 'submit-final').length, 1);
    assert.equal(app.state.inspection.result.finalScore, 5);
  }
});
