const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { buildCoreSource } = require('../build-core.cjs');

function harness() {
  const props = {};
  let saved = null;
  let writes = 0;
  let materializations = 0;
  let fail = false;
  let uploads = 0;
  const context = vm.createContext({
    Date, Intl, Set, Map, Object, JSON,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; }, getProperties: () => ({ ...props }) }) },
    app5sNow_: () => new Date('2026-09-30T15:00:00Z'),
    app5sValidClient_: value => value,
    app5sLoadState_: () => saved,
    app5sLoadPendingKaizen_: () => [],
    app5sStationById_: id => ({ id, name: 'OFICINA' }),
    app5sInspectorNames_: () => [],
    app5sPublicState_: state => state,
    app5sSaveState_: state => { writes++; saved = JSON.parse(JSON.stringify(state)); },
    app5sMaterializeFinal_: () => { materializations++; if (fail) throw new Error('interrupted'); writes++; },
    app5sRememberInspector_: () => { writes++; },
    app5sSavePhoto_: (_, data, name) => { uploads++; assert.match(data, /^data:image/); return 'drive-' + name; },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (_, value) => [...crypto.createHash('sha256').update(value).digest()] },
  });
  vm.runInContext(buildCoreSource(), context);
  const modulePath = path.join(__dirname, '..', 'FinalSubmission.gs');
  if (fs.existsSync(modulePath)) vm.runInContext(fs.readFileSync(modulePath, 'utf8'), context);
  const payload = { stationId: 'oficina', clientId: 'phone-1234567890', sessionId: 'session-1234567890', inspectorName: 'Prueba' };
  const call = (operation, extra = {}) => context.app5sFinalHandle_(operation, { ...payload, ...extra }, 'oficina', {});
  return { call, context, payload, props, writes: () => writes, uploads: () => uploads, materializations: () => materializations, setSaved: s => { saved = s; }, fail: v => { fail = v; } };
}

test('inicio final reserva sin escribir Sheet ni retomar respuestas antiguas', () => {
  const h = harness();
  h.setSaved({ stationId: 'oficina', week: '2026-W40', status: 'open', editor: null, answers: { 'separar-1': 5 }, adminRevokedClientIds: [h.payload.clientId] });
  const result = h.call('begin-final');
  assert.equal(result.state.status, 'open');
  assert.equal(Object.keys(result.state.answers).length, 0);
  assert.equal(h.writes(), 0);
  assert.throws(() => h.call('begin-final', { clientId: 'other-phone-1234' }), /reserv/);
});

test('cierre completo calcula en servidor y reintenta materialización sin cambiar snapshot', () => {
  const h = harness();
  h.call('begin-final');
  const answers = Object.fromEntries(vm.runInContext('QUESTIONS.map(q => [q.id, 0])', h.context));
  const input = { answers, findings: {}, kaizenReviews: {}, occurredAt: '2026-09-30T15:00:00Z' };
  h.fail(true);
  assert.throws(() => h.call('submit-final', input), /interrupted/);
  h.fail(false);
  const result = h.call('submit-final', input);
  assert.equal(result.state.status, 'closed');
  assert.equal(result.state.finalSessionId, h.payload.sessionId);
  assert.equal(result.state.result.finalScore, 5);
  const beforeRetry = h.writes();
  h.call('submit-final', input);
  assert.equal(h.writes(), beforeRetry);
  assert.throws(() => h.call('submit-final', { ...input, sessionId: 'other-session-1234' }), /cerrad/);
});

test('foto confirmada no se duplica y referencia ajena se rechaza antes de escribir', () => {
  const h = harness();
  h.call('begin-final');
  const photo = { photoId: 'finding-1234567890', dataUri: 'data:image/jpeg;base64,AAAA', category: 'Hallazgos' };
  const receipt = h.call('upload-final-photo', photo);
  assert.equal(h.call('upload-final-photo', photo).photoId, receipt.photoId);
  assert.equal(h.uploads(), 1);
  assert.equal(h.writes(), 0);
  const answers = Object.fromEntries(vm.runInContext('QUESTIONS.map(q => [q.id, 0])', h.context));
  const questionId = Object.keys(answers)[0];
  answers[questionId] = 1;
  const payload = { answers, findings: { [questionId]: [{ id: photo.photoId, photoId: 'foreign-drive-id' }] }, kaizenReviews: {}, occurredAt: '2026-09-30T15:00:00Z' };
  assert.throws(() => h.call('submit-final', payload), /propia/);
  assert.equal(h.writes(), 0);
  payload.findings[questionId][0].photoId = receipt.photoId;
  const closed = h.call('submit-final', payload).state;
  assert.equal(closed.status, 'closed');
  assert.notEqual(closed.findings[questionId][0].id, photo.photoId, 'ID final debe estar aislado por estación/semana/sesión');
});

test('cierre incompleto no escribe datos y estado es solo lectura', () => {
  const h = harness();
  h.call('begin-final');
  h.call('final-state');
  assert.throws(() => h.call('submit-final', { answers: {}, findings: {}, kaizenReviews: {}, occurredAt: '2026-09-30T15:00:00Z' }), /respuesta/);
  assert.equal(h.writes(), 0);
});

test('cierre GD guarda33respuestas con nota independiente y no admite decisión inválida', () => {
  const h = harness();
  h.call('begin-final');
  const answers = Object.fromEntries(vm.runInContext('QUESTIONS.map(q => [q.id, 0])', h.context));
  for (let i = 1; i <= 8; i++) answers[`GD-0${i}`] = 0;
  const input = { answers, dailyManagementApplicable: true, findings: {}, kaizenReviews: {}, occurredAt: '2026-09-30T15:00:00Z' };
  assert.throws(() => h.call('submit-final', { ...input, dailyManagementApplicable: 'true' }), /Gerenciamiento Diario/);
  assert.equal(h.writes(), 0);
  const result = h.call('submit-final', input).state;
  assert.equal(Object.keys(result.answers).length, 33);
  assert.equal(result.result.finalScore, 5);
  assert.equal(result.result.dailyManagement.score, 5);
});

test('No aplica registra decisión explícita y no exige las ocho GD', () => {
  const h = harness();
  h.call('begin-final');
  const answers = Object.fromEntries(vm.runInContext('QUESTIONS.map(q => [q.id, 0])', h.context));
  const result = h.call('submit-final', { answers, dailyManagementApplicable: false, findings: {}, kaizenReviews: {}, occurredAt: '2026-09-30T15:00:00Z' }).state;
  assert.equal(result.result.dailyManagement.applicable, false);
  assert.equal(result.result.dailyManagement.score, null);
});

test('aviso de cierre solo se encola después de confirmar materialización completa', () => {
  const h = harness();
  const queued = [];
  h.context.app5sNotifyClosedSafe_ = state => queued.push({status:state.status,materialized:state.finalMaterialized});
  h.call('begin-final');
  const answers = Object.fromEntries(vm.runInContext('QUESTIONS.map(q => [q.id, 0])', h.context));
  const input = {answers,dailyManagementApplicable:false,findings:{},kaizenReviews:{},occurredAt:'2026-09-30T15:00:00Z'};
  h.fail(true);
  assert.throws(() => h.call('submit-final', input), /interrupted/);
  assert.equal(queued.length,0);
  h.fail(false);
  h.call('submit-final', input);
  assert.deepEqual(queued,[{status:'closed',materialized:true}]);
});

test('cierre valida hora del servidor y no permite saltar el horario con fecha retroactiva', () => {
  const h = harness();
  h.call('begin-final');
  const answers = Object.fromEntries(vm.runInContext('QUESTIONS.map(q=>[q.id,0])',h.context));
  h.context.app5sNow_ = () => new Date('2026-09-30T20:01:00Z');
  assert.throws(()=>h.call('submit-final',{answers,dailyManagementApplicable:false,findings:{},kaizenReviews:{},occurredAt:'2026-09-30T15:00:00Z'}),/horario permitido/);
  assert.equal(h.writes(),0);
});
