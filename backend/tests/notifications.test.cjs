const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.existsSync(path.join(__dirname, '..', 'Notifications.gs'))
  ? fs.readFileSync(path.join(__dirname, '..', 'Notifications.gs'), 'utf8') : '';

function harness() {
  const props = { APP5S_OWNER_EMAIL: 'owner@deteco.cl' };
  const sent = [];
  const rows = { Kaizen: [] };
  const stations = [
    { id: 'oficina', name: 'OFICINA', active: true },
    { id: 'bodega', name: 'BODEGA', active: true },
  ];
  const states = {};
  let now = new Date('2026-10-02T19:30:00Z');
  let admin = true;
  let quota = 50;
  let fail = false;
  let lockHeld = false;
  const triggers = [];
  const context = {
    Date, Intl, JSON, console,
    app5sRequireAdminEmail_: () => { if (!admin) throw new Error('Sin permiso de configuración'); return 'owner@deteco.cl'; },
    app5sStationRegistry_: () => stations,
    app5sSheet_: name => ({ getLastRow: () => (rows[name] || []).length + 1, getRange: () => ({ getValues: () => rows[name] || [] }) }),
    app5sLoadState_: (station, week) => states[`${station}:${week}`] || null,
    app5sNow_: () => now,
    app5sScheduleConfig_: () => ({ days: [
      { day: 'Mon', enabled: true, end: '17:00' }, { day: 'Tue', enabled: true, end: '17:00' },
      { day: 'Wed', enabled: true, end: '17:00' }, { day: 'Thu', enabled: true, end: '17:00' },
      { day: 'Fri', enabled: false, end: '17:00' }, { day: 'Sat', enabled: false, end: '17:00' },
      { day: 'Sun', enabled: false, end: '17:00' },
    ] }),
    DEFAULT_INSPECTION_SCHEDULE: { days: [{ day: 'Thu', enabled: true, end: '17:00' }] },
    isoWeekChile: date => ({ key: date.toISOString().startsWith('2026-12-31') ? '2026-W53' : '2026-W40' }),
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props[key] || '', setProperty: (key, value) => { props[key] = value; },
      deleteProperty: key => { delete props[key]; }, getProperties: () => ({ ...props }),
    }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@deteco.cl' }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (lockHeld) return false; lockHeld = true; return true; }, releaseLock: () => { lockHeld = false; } }) },
    MailApp: { getRemainingDailyQuota: () => { if (lockHeld) throw new Error('quota while locked'); return quota; }, sendEmail: message => { if (lockHeld) throw new Error('mail while locked'); if (fail) throw new Error('Mail unavailable'); sent.push(message); quota--; } },
    ScriptApp: { getProjectTriggers: () => triggers, newTrigger: handler => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => triggers.push({ getHandlerFunction: () => handler }) }) }) }) },
  };
  const api = vm.runInNewContext(`${source}\n({app5sAdminNotificationSettings,app5sAdminSaveNotifications,app5sNotifyClosedSafe_,app5sProcessNotifications,autorizarAvisosApp5S})`, context);
  return { api, props, sent, rows, states, stations, triggers, setNow: value => { now = new Date(value); }, setAdmin: value => { admin = value; }, setQuota: value => { quota = value; }, setFailure: value => { fail = value; }, context };
}

test('por defecto está deshabilitado y no envía al cerrar ni por programación', () => {
  const h = harness();
  const settings = h.api.app5sAdminNotificationSettings();
  assert.equal(settings.config.weeklyEnabled, false);
  assert.equal(settings.config.closedEnabled, false);
  h.api.app5sNotifyClosedSafe_({ stationId: 'oficina', week: '2026-W40', status: 'closed' });
  h.api.app5sProcessNotifications();
  assert.equal(h.sent.length, 0);
});

test('configuración exige permiso y rechaza inyección, estaciones ajenas y más de 50 destinatarios', () => {
  const h = harness();
  const base = { weeklyEnabled: true, closedEnabled: true, weeklyHour: 16, generalRecipients: ['a@deteco.cl'], stationRecipients: {} };
  h.setAdmin(false);
  assert.throws(() => h.api.app5sAdminNotificationSettings(), /permiso/);
  assert.throws(() => h.api.app5sAdminSaveNotifications({ config: base }), /permiso/);
  h.setAdmin(true);
  assert.throws(() => h.api.app5sAdminSaveNotifications({ config: { ...base, generalRecipients: ['a@deteco.cl\nBcc:evil@example.com'] } }), /correo|destinatario/i);
  assert.throws(() => h.api.app5sAdminSaveNotifications({ config: { ...base, stationRecipients: { desconocida: ['a@deteco.cl'] } } }), /estación/i);
  assert.throws(() => h.api.app5sAdminSaveNotifications({ config: { ...base, generalRecipients: Array.from({ length: 51 }, (_, i) => `a${i}@deteco.cl`) } }), /50/);
});

test('habilitar solicita autorización del propietario hasta instalar programación', () => {
  const h = harness();
  const config = { weeklyEnabled: true, closedEnabled: false, weeklyHour: 16, generalRecipients: ['a@deteco.cl'], stationRecipients: {} };
  assert.equal(h.api.app5sAdminSaveNotifications({ config }).authorizationRequired, true);
  h.api.app5sProcessNotifications();
  assert.equal(h.sent.length, 0);
  assert.equal(h.triggers.length, 0);
  assert.equal(h.api.autorizarAvisosApp5S().authorizationRequired, false);
  assert.equal(h.triggers.length, 1);
});

test('cierre envía individualmente una vez por destinatario y mantiene GD separado', () => {
  const h = harness();
  const config = { weeklyEnabled: false, closedEnabled: true, weeklyHour: 16, generalRecipients: ['general@deteco.cl'], stationRecipients: { oficina: ['area@deteco.cl'], bodega: ['other@deteco.cl'] } };
  h.api.app5sAdminSaveNotifications({ config });
  h.api.autorizarAvisosApp5S();
  const state = { stationId: 'oficina', week: '2026-W40', status: 'closed', result: { finalScore: 4.2, dailyManagement: { applicable: true, score: 3.5 } }, findings: { Q1: [{ id: 'f1' }] }, pendingKaizen: [{ id: 'k1' }], closedAt: '2026-10-01T18:00:00Z' };
  h.states['oficina:2026-W40'] = state;
  h.api.app5sNotifyClosedSafe_(state);
  h.api.app5sNotifyClosedSafe_(state);
  assert.equal(h.sent.length, 0, 'el cierre solo debe dejar una tarea durable');
  h.api.app5sProcessNotifications();
  h.api.app5sProcessNotifications();
  assert.equal(h.sent.length, 2);
  assert.deepEqual(h.sent.map(x => x.to).sort(), ['area@deteco.cl', 'general@deteco.cl']);
  assert.match(h.sent[0].body, /GD: 3,5/);
  assert.match(h.sent[0].body, /5S: 4,2/);
  assert.ok(h.sent.every(x => !x.body.includes('other@deteco.cl')));
});

test('fallo y cuota no bloquean cierre ni repiten a ciegas un envío incierto', () => {
  const h = harness();
  h.api.app5sAdminSaveNotifications({ config: { weeklyEnabled: false, closedEnabled: true, weeklyHour: 16, generalRecipients: ['a@deteco.cl'], stationRecipients: {} } });
  h.api.autorizarAvisosApp5S();
  const state = { stationId: 'oficina', week: '2026-W40', status: 'closed', result: { finalScore: 4 }, findings: {} };
  h.states['oficina:2026-W40'] = state;
  h.setFailure(true);
  assert.doesNotThrow(() => h.api.app5sNotifyClosedSafe_(state));
  assert.equal(h.sent.length, 0);
  h.api.app5sProcessNotifications();
  h.setFailure(false);
  h.api.app5sProcessNotifications();
  assert.equal(h.sent.length, 0);
  assert.match(h.api.app5sAdminNotificationSettings().lastStatus.error, /Mail unavailable/);
  h.setQuota(0);
  h.states['bodega:2026-W40'] = { ...state, stationId: 'bodega' };
  assert.doesNotThrow(() => h.api.app5sNotifyClosedSafe_(h.states['bodega:2026-W40']));
  h.api.app5sProcessNotifications();
  assert.equal(h.sent.length, 0);
});

test('resumen viernes ISO es parcial con turnos futuros, filtra estaciones y no convierte faltantes en cero', () => {
  const h = harness();
  h.context.app5sScheduleConfig_ = () => ({ days: [
    { day: 'Thu', enabled: true, end: '17:00' }, { day: 'Fri', enabled: true, end: '18:00' }, { day: 'Sat', enabled: true, end: '12:00' },
  ] });
  h.states['oficina:2026-W40'] = { status: 'closed', stationId: 'oficina', week: '2026-W40', result: { finalScore: 4.5, dailyManagement: { applicable: false } }, findings: {}, closedAt: '2026-10-01T18:00:00Z' };
  h.api.app5sAdminSaveNotifications({ config: { weeklyEnabled: true, closedEnabled: false, weeklyHour: 16, generalRecipients: ['general@deteco.cl'], stationRecipients: { oficina: ['office@deteco.cl'] } } });
  h.api.autorizarAvisosApp5S();
  h.api.app5sProcessNotifications();
  h.api.app5sProcessNotifications();
  assert.equal(h.sent.length, 2);
  const general = h.sent.find(x => x.to === 'general@deteco.cl');
  const office = h.sent.find(x => x.to === 'office@deteco.cl');
  assert.match(general.subject, /parcial/i);
  assert.match(general.body, /Cerradas: 1/);
  assert.match(general.body, /Sin cierre: 1/);
  assert.doesNotMatch(general.body, /BODEGA.*5S: 0/);
  assert.doesNotMatch(office.body, /BODEGA/);
  assert.match(office.body, /GD: No aplica/);
});

test('cuota agotada conserva en cola el destinatario pendiente y luego envía solo ese', () => {
  const h = harness();
  h.api.app5sAdminSaveNotifications({ config: { weeklyEnabled: false, closedEnabled: true, weeklyHour: 16, generalRecipients: ['a@deteco.cl', 'b@deteco.cl'], stationRecipients: {} } });
  h.api.autorizarAvisosApp5S();
  const state = { stationId: 'oficina', week: '2026-W40', status: 'closed', result: { finalScore: 4 }, findings: {} };
  h.states['oficina:2026-W40'] = state;
  h.api.app5sNotifyClosedSafe_(state);
  h.setQuota(1);
  h.api.app5sProcessNotifications();
  assert.equal(h.sent.length, 1);
  h.setQuota(50);
  h.api.app5sProcessNotifications();
  assert.deepEqual(h.sent.map(message => message.to).sort(), ['a@deteco.cl', 'b@deteco.cl']);
});

test('el worker libera el bloqueo global antes de consultar cuota y enviar', () => {
  const h = harness();
  h.api.app5sAdminSaveNotifications({ config: { weeklyEnabled: false, closedEnabled: true, weeklyHour: 16, generalRecipients: ['a@deteco.cl'], stationRecipients: {} } });
  h.api.autorizarAvisosApp5S();
  h.states['oficina:2026-W40'] = { stationId: 'oficina', week: '2026-W40', status: 'closed', result: { finalScore: 4 }, findings: {} };
  h.api.app5sNotifyClosedSafe_(h.states['oficina:2026-W40']);
  h.api.app5sProcessNotifications();
  assert.equal(h.sent.length, 1);
  assert.equal(h.api.app5sAdminNotificationSettings().lastStatus.state, 'sent');
});

test('un error al consultar cuota conserva el aviso para reintentar sin marcar envío incierto', () => {
  const h = harness();
  h.api.app5sAdminSaveNotifications({ config: { weeklyEnabled: false, closedEnabled: true, weeklyHour: 16, generalRecipients: ['a@deteco.cl'], stationRecipients: {} } });
  h.api.autorizarAvisosApp5S();
  h.states['oficina:2026-W40'] = { stationId: 'oficina', week: '2026-W40', status: 'closed', result: { finalScore: 4 }, findings: {} };
  h.api.app5sNotifyClosedSafe_(h.states['oficina:2026-W40']);
  const quota = h.context.MailApp.getRemainingDailyQuota;
  h.context.MailApp.getRemainingDailyQuota = () => { throw new Error('Quota unavailable'); };
  assert.doesNotThrow(() => h.api.app5sProcessNotifications());
  assert.equal(h.sent.length, 0);
  assert.equal(h.api.app5sAdminNotificationSettings().lastStatus.state, 'error');
  h.context.MailApp.getRemainingDailyQuota = quota;
  h.api.app5sProcessNotifications();
  assert.equal(h.sent.length, 1);
});
