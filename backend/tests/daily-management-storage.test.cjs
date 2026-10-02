const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildCoreSource } = require('../build-core.cjs');

function harness(applicable) {
  const rows = [];
  const finding = { id: 'gd-finding-123', photoId: 'drive-photo', note: 'GD' };
  const context = vm.createContext({});
  vm.runInContext(buildCoreSource() + fs.readFileSync(path.join(__dirname, '../Code.gs'), 'utf8'), context);
  const state = vm.runInContext("reserveInspection(createInspection({stationId:'oficina',week:'2026-W40'}),{clientId:'phone-a',inspectorName:'Inspector',at:'2026-09-30T14:00:00Z'})", context);
  state.dailyManagementApplicable = applicable;
  state.answers = Object.fromEntries(vm.runInContext('QUESTIONS.map(q=>[q.id,0])', context));
  if (applicable) {
    for (let i = 1; i <= 8; i++) state.answers[`GD-0${i}`] = 0;
    state.answers['GD-01'] = 1;
    state.findings['GD-01'] = [finding];
  }
  const closed = context.closeInspection(state, { clientId: 'phone-a', at: '2026-09-30T15:00:00Z' });
  Object.assign(context, {
    app5sUpsert_: (table, keyColumn, id, values) => rows.push({ table, id, values }),
    app5sBatchUpsert_: (table, keyColumn, records) => records.forEach(values => rows.push({ table, id: values[keyColumn - 1], values })),
    app5sSaveState_: () => {}, app5sMaterializeKaizenReviews_: () => {}, app5sMaterializeKaizen_: () => {},
    app5sSheet_: () => ({ getLastRow: () => 1 }), app5sStationById_: () => ({ name: 'OFICINA' }),
  });
  return { context, closed, rows };
}

test('materializa las ocho GD y no descarta su evidencia al sincronizar cierre', () => {
  const h = harness(true);
  h.context.app5sMaterializeClosed_(h.closed);
  assert.equal(h.rows.filter(r => r.table === 'Respuestas' && r.values[7] === 'gerenciamiento-diario').length, 8);
  h.context.app5sSyncProgress_(h.closed);
  const score = h.rows.find(r => r.table === 'Puntajes modulo' && r.values[4] === 'GERENCIAMIENTO DIARIO');
  assert.equal(score?.values[5], 4.875);
  assert.equal(h.rows.find(r => r.table === 'Inspecciones').values[8], 5);
  assert.ok(h.rows.some(r => r.table === 'Hallazgos' && r.values[4] === 'GD-01'));
  assert.equal(h.context.app5sPublicState_(h.closed).dailyManagementApplicable, true);
});

test('No aplica se registra sin nota cero ni ocho respuestas ficticias', () => {
  const h = harness(false);
  h.context.app5sMaterializeClosed_(h.closed);
  h.context.app5sSyncProgress_(h.closed);
  const score = h.rows.find(r => r.table === 'Puntajes modulo' && r.values[4] === 'GERENCIAMIENTO DIARIO');
  assert.equal(score?.values[5], '');
  assert.equal(score?.values[6], 'No aplica');
  assert.equal(h.rows.filter(r => r.table === 'Respuestas' && r.values[7] === 'gerenciamiento-diario').length, 0);
});
