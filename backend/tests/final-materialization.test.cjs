const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildCoreSource } = require('../build-core.cjs');

function harness() {
  const rows = new Map();
  const opens = new Map();
  let failScores = false;
  const table = name => {
    if (!rows.has(name)) rows.set(name, []);
    opens.set(name, (opens.get(name) || 0) + 1);
    const data = rows.get(name);
    return {
      getLastRow: () => data.length + 1,
      getMaxRows: () => Math.max(100, data.length + 1),
      insertRowsAfter() {},
      getRange(row, column, height, width) {
        return {
          getValues: () => Array.from({ length: height }, (_, index) =>
            (data[row - 2 + index] || []).slice(column - 1, column - 1 + width)),
          setValues(values) {
            if (name === 'Puntajes modulo' && failScores) {
              failScores = false;
              throw new Error('fallo parcial');
            }
            values.forEach((value, index) => {
              const target = row - 2 + index;
              const original = data[target] || [];
              value.forEach((cell, offset) => { original[column - 1 + offset] = cell; });
              data[target] = original;
            });
          },
        };
      },
      appendRow(value) { data.push(value); },
    };
  };
  const context = vm.createContext({ Date, Intl, Object, JSON, Map, Set });
  vm.runInContext(buildCoreSource() + fs.readFileSync(path.join(__dirname, '../Code.gs'), 'utf8'), context);
  context.app5sSheet_ = table;
  context.app5sStationById_ = () => ({ id: 'oficina', name: 'OFICINA' });
  context.app5sSaveState_ = () => {};
  const state = vm.runInContext("reserveInspection(createInspection({stationId:'oficina',week:'2026-W40'}),{clientId:'phone-a',inspectorName:'Ana',at:'2026-09-30T14:00:00Z'})", context);
  state.dailyManagementApplicable = false;
  state.answers = Object.fromEntries(vm.runInContext('QUESTIONS.map(q=>[q.id,0])', context));
  const closed = context.closeInspection(state, { clientId: 'phone-a', at: '2026-09-30T15:00:00Z' });
  return { context, closed, rows, opens, failNextScores: () => { failScores = true; } };
}

test('cierre final escribe cada tabla base una vez y evita respuestas duplicadas', () => {
  const h = harness();
  h.context.app5sMaterializeFinal_(h.closed);
  assert.equal(h.rows.get('Respuestas').length, 25);
  assert.equal(h.rows.get('Inspecciones').length, 1);
  assert.equal(h.rows.get('Puntajes modulo').length, 6);
  assert.equal(h.opens.get('Respuestas'), 1);
  assert.equal(h.opens.get('Inspecciones'), 1);
  h.context.app5sMaterializeFinal_(h.closed);
  assert.equal(h.rows.get('Respuestas').length, 25);
  assert.equal(h.rows.get('Inspecciones').length, 1);
});

test('reintento tras fallo parcial completa tablas sin duplicar filas anteriores', () => {
  const h = harness();
  h.failNextScores();
  assert.throws(() => h.context.app5sMaterializeFinal_(h.closed), /fallo parcial/);
  assert.equal(h.rows.get('Respuestas').length, 25);
  h.context.app5sMaterializeFinal_(h.closed);
  assert.equal(h.rows.get('Respuestas').length, 25);
  assert.equal(h.rows.get('Puntajes modulo').length, 6);
});

test('filas históricas ajenas permanecen intactas aunque tengan claves duplicadas', () => {
  const h = harness();
  const historical = ['otra:2025-W01:separar-1', 'otra:2025-W01', 'otra', '2025-W01', 'separar-1', 1, 4, 'separar'];
  h.rows.set('Respuestas', [historical.slice(), historical.slice()]);
  h.context.app5sMaterializeFinal_(h.closed);
  assert.deepEqual(h.rows.get('Respuestas').slice(0, 2), [historical, historical]);
  assert.equal(h.rows.get('Respuestas').length, 27);
});

test('estado público distingue cierre persistido de materialización pendiente', () => {
  const h = harness();
  assert.equal(h.context.app5sPublicState_({ ...h.closed, finalMaterialized: false }).finalMaterialized, false);
  assert.equal(h.context.app5sPublicState_({ ...h.closed, finalMaterialized: true }).finalMaterialized, true);
});
