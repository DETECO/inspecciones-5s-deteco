const APP5S_NOTICE_CONFIG = 'APP5S_NOTICE_CONFIG_V1';
const APP5S_NOTICE_STATUS = 'APP5S_NOTICE_STATUS_V1';
const APP5S_NOTICE_READY = 'APP5S_NOTICE_READY_V1';
const APP5S_NOTICE_RECEIPT = 'APP5S_NOTICE_RECEIPT_V1:';
const APP5S_NOTICE_QUEUE = 'APP5S_NOTICE_QUEUE_V1:';

function app5sNoticeDefault_() {
  return { weeklyEnabled: false, closedEnabled: false, weeklyHour: 16, generalRecipients: [], stationRecipients: {} };
}

function app5sNoticeConfig_() {
  const raw = PropertiesService.getScriptProperties().getProperty(APP5S_NOTICE_CONFIG);
  return raw ? JSON.parse(raw) : app5sNoticeDefault_();
}

function app5sNoticeValidate_(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuración de avisos inválida.');
  if (typeof value.weeklyEnabled !== 'boolean' || typeof value.closedEnabled !== 'boolean') throw new Error('Interruptores de avisos inválidos.');
  if (!Number.isInteger(value.weeklyHour) || value.weeklyHour < 0 || value.weeklyHour > 23) throw new Error('Hora del resumen inválida.');
  if (!Array.isArray(value.generalRecipients) || !value.stationRecipients || typeof value.stationRecipients !== 'object' || Array.isArray(value.stationRecipients)) throw new Error('Destinatarios inválidos.');
  const registry = app5sStationRegistry_();
  const active = new Set(registry.filter(item => item.active).map(item => item.id));
  const normalize = list => {
    if (!Array.isArray(list)) throw new Error('Destinatarios inválidos.');
    return [...new Set(list.map(item => {
      if (typeof item !== 'string' || item.length > 254 || /[\r\n\u0000-\u001f\u007f]/.test(item)) throw new Error('Correo destinatario inválido.');
      const email = item.trim().toLowerCase();
      if (!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(email)) throw new Error('Correo destinatario inválido.');
      return email;
    }))];
  };
  const generalRecipients = normalize(value.generalRecipients);
  const stationRecipients = {};
  Object.keys(value.stationRecipients).forEach(id => {
    if (!active.has(id)) throw new Error('Estación de destinatarios inválida.');
    stationRecipients[id] = normalize(value.stationRecipients[id]);
  });
  const unique = new Set([...generalRecipients, ...Object.values(stationRecipients).flat()]);
  if (unique.size > 50) throw new Error('Máximo 50 destinatarios únicos.');
  if ((value.weeklyEnabled || value.closedEnabled) && unique.size === 0) throw new Error('Agrega al menos un destinatario antes de habilitar avisos.');
  return { weeklyEnabled: value.weeklyEnabled, closedEnabled: value.closedEnabled, weeklyHour: value.weeklyHour, generalRecipients, stationRecipients };
}

function app5sNoticeAuthorized_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(APP5S_NOTICE_READY) !== 'true') return false;
  if (typeof ScriptApp === 'undefined' || typeof ScriptApp.getProjectTriggers !== 'function') return false;
  if (!ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === 'app5sProcessNotifications')) return false;
  if (typeof ScriptApp.getAuthorizationInfo === 'function') {
    const info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    if (info.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) return false;
  }
  return true;
}

function app5sNoticeStatus_(status) {
  PropertiesService.getScriptProperties().setProperty(APP5S_NOTICE_STATUS, JSON.stringify({ at: app5sNow_().toISOString(), ...status }));
}

function app5sNoticeSettings_() {
  const config = app5sNoticeConfig_();
  const enabled = config.weeklyEnabled || config.closedEnabled;
  let authorizationRequired = false;
  if (enabled) {
    try { authorizationRequired = !app5sNoticeAuthorized_(); }
    catch { authorizationRequired = true; }
  }
  const raw = PropertiesService.getScriptProperties().getProperty(APP5S_NOTICE_STATUS);
  return { config, lastStatus: raw ? JSON.parse(raw) : null, authorizationRequired };
}

function app5sAdminNotificationSettings() {
  app5sRequireAdminEmail_('configure');
  return app5sNoticeSettings_();
}

function app5sAdminSaveNotifications(payload) {
  app5sRequireAdminEmail_('configure');
  const config = app5sNoticeValidate_(payload && payload.config);
  PropertiesService.getScriptProperties().setProperty(APP5S_NOTICE_CONFIG, JSON.stringify(config));
  return app5sNoticeSettings_();
}

function autorizarAvisosApp5S() {
  const adminEmail = app5sRequireAdminEmail_('configure');
  const ownerEmail = String(PropertiesService.getScriptProperties().getProperty('APP5S_OWNER_EMAIL') || '').trim().toLowerCase();
  const effectiveEmail = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!ownerEmail || adminEmail !== ownerEmail || effectiveEmail !== ownerEmail) throw new Error('El propietario debe ejecutar esta función con su cuenta autorizada.');
  const config = app5sNoticeConfig_();
  if (!config.weeklyEnabled && !config.closedEnabled) throw new Error('Primero habilita un aviso con destinatarios configurados.');
  MailApp.getRemainingDailyQuota();
  if (typeof ScriptApp.getAuthorizationInfo === 'function' && ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL).getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) {
    throw new Error('Autoriza los permisos de correo y programación en Apps Script y vuelve a ejecutar esta función.');
  }
  if (!ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === 'app5sProcessNotifications')) {
    ScriptApp.newTrigger('app5sProcessNotifications').timeBased().everyMinutes(5).create();
  }
  PropertiesService.getScriptProperties().setProperty(APP5S_NOTICE_READY, 'true');
  return app5sNoticeSettings_();
}

function app5sNoticeRecipients_(config, stationIds) {
  const scopes = new Map();
  config.generalRecipients.forEach(email => scopes.set(email, new Set(stationIds)));
  stationIds.forEach(id => (config.stationRecipients[id] || []).forEach(email => {
    if (!scopes.has(email)) scopes.set(email, new Set());
    scopes.get(email).add(id);
  }));
  return scopes;
}

function app5sNoticeNumber_(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1).replace('.', ',') : 'Sin nota';
}

function app5sNoticeStateLine_(station, state, pendingKaizen) {
  if (!state || state.status !== 'closed') return `${station.name}: ${state?.status === 'expired' ? 'Vencida' : 'Sin cierre'}; 5S: Sin nota; GD: Sin nota`;
  const gd = state.result?.dailyManagement;
  const gdText = gd?.applicable === true ? app5sNoticeNumber_(gd.score) : gd?.applicable === false ? 'No aplica' : 'Sin nota';
  const findings = Object.values(state.findings || {}).reduce((count, items) => count + (Array.isArray(items) ? items.length : 0), 0);
  return `${station.name}: Cerrada; 5S: ${app5sNoticeNumber_(state.result?.finalScore)}; GD: ${gdText}; Hallazgos: ${findings}; Kaizen pendientes: ${pendingKaizen}`;
}

function app5sNoticePendingKaizen_() {
  const sheet = app5sSheet_('Kaizen');
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues() : [];
  const counts = {};
  rows.forEach(row => { if (row[2] === 'open') counts[row[1]] = (counts[row[1]] || 0) + 1; });
  return counts;
}

function app5sNoticeSend_(kind, week, stationId, recipient, subject, body) {
  const props = PropertiesService.getScriptProperties();
  const key = APP5S_NOTICE_RECEIPT + kind + ':' + week + ':' + stationId + ':' + recipient;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return false;
  try {
    const receipt = props.getProperty(key);
    if (receipt === 'sent' || receipt === 'uncertain') return true;
    if (receipt === 'attempted') return false;
    props.setProperty(key, 'attempted');
  } finally {
    lock.releaseLock();
  }
  // MailApp puede tardar; nunca retener el bloqueo usado por inspecciones y administración.
  try {
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Cuota diaria de correo agotada.');
  } catch (error) {
    // Este proceso posee el intento y aún no ha llamado a sendEmail: es seguro reintentar.
    props.setProperty(key, 'quota');
    app5sNoticeStatus_({ kind, week, stationId, state: 'error', error: String(error.message || error).slice(0, 180) });
    return false;
  }
  // El intento queda durable antes del envío: si el resultado es incierto, no se reenvía a ciegas.
  try {
    MailApp.sendEmail({ to: recipient, subject, body, name: 'Inspecciones 5S DETECO' });
    props.setProperty(key, 'sent');
    app5sNoticeStatus_({ kind, week, stationId, state: 'sent', error: '' });
    return true;
  } catch (error) {
    props.setProperty(key, 'uncertain');
    app5sNoticeStatus_({ kind, week, stationId, state: 'uncertain', error: String(error.message || error).slice(0, 180) });
    return true;
  }
}

function app5sNotifyClosedSafe_(state) {
  try {
    const config = app5sNoticeConfig_();
    if (!config.closedEnabled || !state || state.status !== 'closed' || !/^[A-Za-z0-9_-]{1,100}$/.test(state.stationId) || !/^\d{4}-W\d{2}$/.test(state.week)) return;
    PropertiesService.getScriptProperties().setProperty(APP5S_NOTICE_QUEUE + state.week + ':' + state.stationId, 'pending');
  } catch (error) {
    try { app5sNoticeStatus_({ kind: 'closed', week: state?.week || '', stationId: state?.stationId || '', state: 'error', error: String(error.message || error).slice(0, 180) }); } catch {}
  }
}

function app5sNoticeChileClock_(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = type => parts.find(item => item.type === type).value;
  return { day: get('weekday'), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function app5sNoticePartial_(schedule, minutes) {
  const days = schedule?.days || [];
  const order = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return days.some(slot => slot.enabled && (order[slot.day] > 4 || (slot.day === 'Fri' && Number(String(slot.end).slice(0, 2)) * 60 + Number(String(slot.end).slice(3, 5)) > minutes)));
}

function app5sProcessNotifications() {
  app5sProcessNotifications_();
}

function app5sProcessNotifications_() {
  const config = app5sNoticeConfig_();
  if ((!config.weeklyEnabled && !config.closedEnabled) || !app5sNoticeAuthorized_()) return;
  const props = PropertiesService.getScriptProperties();
  if (config.closedEnabled) {
    const queue = Object.keys(props.getProperties()).filter(key => key.startsWith(APP5S_NOTICE_QUEUE));
    const registry = app5sStationRegistry_();
    const pending = app5sNoticePendingKaizen_();
    queue.forEach(key => {
      const match = /^APP5S_NOTICE_QUEUE_V1:(\d{4}-W\d{2}):([A-Za-z0-9_-]{1,100})$/.exec(key);
      if (!match) return;
      const [, week, stationId] = match;
      const station = registry.find(item => item.active && item.id === stationId);
      const state = station && app5sLoadState_(stationId, week);
      if (!state || state.status !== 'closed') return;
      const body = `Inspección 5S cerrada · ${week}\n${app5sNoticeStateLine_(station, state, pending[stationId] || 0)}`;
      const recipients = app5sNoticeRecipients_(config, [stationId]);
      let complete = true;
      recipients.forEach((scope, email) => {
        if (!app5sNoticeSend_('closed', week, stationId, email, `Inspección 5S cerrada · ${station.name} · ${week}`, body)) complete = false;
      });
      if (complete) props.deleteProperty(key);
    });
  }
  app5sNoticePruneReceipts_(app5sNow_());
  if (!config.weeklyEnabled) return;
  const now = app5sNow_();
  const clock = app5sNoticeChileClock_(now);
  if (clock.day !== 'Fri' || clock.minutes < config.weeklyHour * 60) return;
  const week = isoWeekChile(now).key;
  const stations = app5sStationRegistry_().filter(item => item.active);
  const states = new Map(stations.map(item => [item.id, app5sLoadState_(item.id, week)]));
  const pending = app5sNoticePendingKaizen_();
  const schedule = typeof app5sScheduleConfig_ === 'function' ? app5sScheduleConfig_() : DEFAULT_INSPECTION_SCHEDULE;
  const partial = app5sNoticePartial_(schedule, clock.minutes);
  const recipients = app5sNoticeRecipients_(config, stations.map(item => item.id));
  recipients.forEach((scope, email) => {
    const selected = stations.filter(item => scope.has(item.id));
    const closed = selected.filter(item => states.get(item.id)?.status === 'closed');
    const expired = selected.filter(item => states.get(item.id)?.status === 'expired');
    const withoutClose = selected.length - closed.length;
    const overdue = partial ? expired.length : withoutClose;
    const scores = closed.map(item => states.get(item.id)?.result?.finalScore).filter(value => typeof value === 'number' && Number.isFinite(value));
    const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const lines = [
      `Resumen 5S · ${week}${partial ? ' · PARCIAL' : ''}`,
      `Estaciones activas: ${selected.length}; Cerradas: ${closed.length}; Sin cierre: ${withoutClose}; Vencidas: ${overdue}`,
      `Cierre: ${selected.length ? Math.round(closed.length / selected.length * 100) : 0}%; Promedio 5S cerradas: ${app5sNoticeNumber_(average)}`,
      partial ? 'Resumen parcial: hay horarios habilitados después de esta hora.' : 'Resumen de los datos disponibles al envío.',
      ...selected.map(item => app5sNoticeStateLine_(item, states.get(item.id), pending[item.id] || 0)),
    ];
    app5sNoticeSend_('weekly', week, 'all', email, `Resumen 5S ${week}${partial ? ' · parcial' : ''}`, lines.join('\n'));
  });
}

function app5sNoticePruneReceipts_(now) {
  const props = PropertiesService.getScriptProperties();
  const cutoff = isoWeekChile(new Date(now.getTime() - 56 * 86400000)).key;
  Object.keys(props.getProperties()).forEach(key => {
    if (!key.startsWith(APP5S_NOTICE_RECEIPT)) return;
    const match = /^APP5S_NOTICE_RECEIPT_V1:(?:closed|weekly):(\d{4}-W\d{2}):/.exec(key);
    if (match && match[1] < cutoff) props.deleteProperty(key);
  });
}
