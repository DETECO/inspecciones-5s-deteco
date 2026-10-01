const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildCoreSource } = require('../build-core.cjs');

function harness(permission = 'configure') {
  const properties = {};
  const config = [['oficina', 'OFICINA', 'obra', '', true, '', '', 100]];
  const audit = [];
  const sheet = {
    getLastRow: () => config.length + 1,
    getRange: (row, col, count) => ({
      getValues: () => config.slice(row - 2, row - 2 + count).map(item => item.slice(col - 1)),
      setValue: value => { config[row - 2][col - 1] = value; },
    }),
  };
  const context = vm.createContext({
    Date, Intl, Object, JSON, Map, Set,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] || null, setProperty: (key, value) => { properties[key] = value; } }) },
    app5sRequireAdminEmail_: required => { if (required === 'configure' && permission !== 'configure') throw new Error('Sin permiso'); return 'admin@deteco.cl'; },
    app5sAdminPermissions_: () => ({ canView: true, canConfigure: permission === 'configure', canRelease: false }),
    app5sWithLock_: action => action(),
    app5sAdminSnapshot_: () => ({ stations: [{ stationId: 'oficina', owner: config[0][3] }] }),
    app5sSheet_: name => name === 'Configuracion' ? sheet : { appendRow: row => audit.push(row) },
    app5sStationById_: id => id === 'oficina' ? { id } : null,
    app5sValidStation_: id => { if (id !== 'oficina') throw new Error('Estación inválida'); return id; },
    app5sNow_: () => new Date('2026-10-01T15:00:00Z'),
  });
  vm.runInContext(buildCoreSource(), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'AdminSettings.gs'), 'utf8'), context);
  return { context, properties, config, audit };
}

test('horario administrativo conserva valores iniciales y valida permisos antes de guardar', () => {
  const h = harness();
  const before = h.context.app5sAdminSettings();
  assert.equal(before.schedule.days[3].lastStart, '12:00');
  assert.equal(before.permissions.canConfigure, true);
  const changed = { days: before.schedule.days.map(day => day.day === 'Fri' ? { day: 'Fri', enabled: true, start: '08:15', lastStart: '12:00', end: '17:00' } : day) };
  h.context.app5sAdminSaveSchedule({ schedule: changed });
  assert.equal(h.context.app5sScheduleConfig_().days[4].enabled, true);
  assert.equal(h.audit.length, 1);
  assert.throws(() => h.context.app5sAdminSaveSchedule({ schedule: { days: [] } }), /siete/i);
  assert.throws(() => harness('view').context.app5sAdminSaveSchedule({ schedule: changed }), /permiso/);
});

test('encargado solo cambia Configuracion D, admite quitarlo y audita', () => {
  const h = harness();
  const snapshot = h.context.app5sAdminUpdateOwner({ stationId: 'oficina', owner: 'Ana Pérez', expectedOwner: '' });
  assert.equal(h.config[0][3], 'Ana Pérez');
  assert.equal(snapshot.stations[0].owner, 'Ana Pérez');
  assert.equal(h.audit.length, 1);
  assert.throws(() => h.context.app5sAdminUpdateOwner({ stationId: 'oficina', owner: '=HYPERLINK("x")', expectedOwner: 'Ana Pérez' }), /nombre|encargado/i);
  assert.throws(() => h.context.app5sAdminUpdateOwner({ stationId: 'oficina', owner: 'Juan', expectedOwner: '' }), /cambiado/i);
  h.context.app5sAdminUpdateOwner({ stationId: 'oficina', owner: '', expectedOwner: 'Ana Pérez' });
  assert.equal(h.config[0][3], '');
});

test('una reserva conserva su horario de cierre tras cambiar la configuración', () => {
  const properties = {};
  let now = new Date('2026-09-30T15:00:00Z');
  let schedule;
  const context = vm.createContext({
    Date, Intl, Object, JSON, Map, Set,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties[key] || null,
      setProperty: (key, value) => { properties[key] = value; },
      deleteProperty: key => { delete properties[key]; },
      getProperties: () => ({ ...properties }),
    }) },
    app5sNow_: () => now,
    app5sScheduleConfig_: () => schedule,
    app5sValidClient_: value => value,
    app5sLoadState_: () => null,
    app5sLoadPendingKaizen_: () => [],
    app5sStationById_: id => ({ id, name: 'OFICINA' }),
    app5sInspectorNames_: () => [],
    app5sPublicState_: state => state,
  });
  vm.runInContext(buildCoreSource(), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'FinalSubmission.gs'), 'utf8'), context);
  schedule = vm.runInContext('DEFAULT_INSPECTION_SCHEDULE', context);
  const payload = { clientId: 'phone-123456', sessionId: 'session-123456789', inspectorName: 'Ana' };
  const started = context.app5sFinalHandle_('begin-final', payload, 'oficina', {});
  assert.equal(started.state.schedule.days[2].end, '17:00');
  schedule = vm.runInContext('normalizeInspectionSchedule({ days: DEFAULT_INSPECTION_SCHEDULE.days.map(day => day.day === "Wed" ? { ...day, end: "15:30", lastStart: "15:30" } : day) })', context);
  now = new Date('2026-09-30T16:00:00Z');
  const answers = Object.fromEntries(vm.runInContext('QUESTIONS.map(q => [q.id, 0])', context));
  const lease = JSON.parse(properties['APP5S_FINAL:LEASE:oficina:2026-W40']);
  const closed = context.app5sFinalSnapshot_(lease, { answers, findings: {}, kaizenReviews: {}, occurredAt: now.toISOString() }, now);
  assert.equal(closed.status, 'closed');
  assert.equal(closed.schedule.days[2].end, '17:00');
});

test('snapshot administrativo agrupa Estado y Accesos en una lectura por pestaña', () => {
  const data = {
    Configuracion: [['oficina', 'OFICINA', 'obra', 'Ana', true, '', '', 100], ['bodega', 'BODEGA', 'obra', 'Luis', true, '', '', 100]],
    Estado: [['oficina', '2026-W40', 'open', JSON.stringify({ status: 'open', startedBy: 'Inspector' }), '']],
    Accesos: [['oficina', 'a'.repeat(32), true], ['bodega', 'b'.repeat(32), true]],
  };
  const reads = {};
  let opens = 0;
  const book = { getSheetByName: name => ({
    getLastRow: () => data[name].length + 1,
    getRange: () => ({ getValues: () => { reads[name] = (reads[name] || 0) + 1; return data[name]; } }),
  }) };
  const context = vm.createContext({
    Date, Intl, Object, JSON, Map, Set,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => ({ APP5S_OWNER_EMAIL: 'admin@deteco.cl', APP5S_SHEET_ID: 'book', APP5S_FRONTEND_URL: 'https://deteco.github.io/app/' })[key] || null }) },
    SpreadsheetApp: { openById: () => { opens++; return book; } },
  });
  vm.runInContext(buildCoreSource(), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), context);
  const result = context.app5sAdminSnapshot_('admin@deteco.cl', '2026-W40');
  assert.equal(opens, 1);
  assert.deepEqual(reads, { Configuracion: 1, Estado: 1, Accesos: 1 });
  assert.equal(result.stations[0].owner, 'Ana');
  assert.equal(result.stations[1].owner, 'Luis');
  assert.equal(result.stations[0].status, 'open');
});
