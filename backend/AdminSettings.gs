const APP5S_SCHEDULE_PROPERTY = 'APP5S_INSPECTION_SCHEDULE';

function app5sScheduleConfig_() {
  const value = PropertiesService.getScriptProperties().getProperty(APP5S_SCHEDULE_PROPERTY);
  if (!value) return normalizeInspectionSchedule(DEFAULT_INSPECTION_SCHEDULE);
  try {
    return normalizeInspectionSchedule(JSON.parse(value));
  } catch {
    throw new Error('La configuración de horarios guardada es inválida.');
  }
}

function app5sAdminSettings() {
  const adminEmail = app5sRequireAdminEmail_('view');
  return {
    schedule: app5sScheduleConfig_(),
    permissions: app5sAdminPermissions_(adminEmail),
    adminEmail,
  };
}

function app5sAdminSaveSchedule(payload) {
  const adminEmail = app5sRequireAdminEmail_('configure');
  const schedule = normalizeInspectionSchedule(payload?.schedule);
  return app5sWithLock_(() => {
    const previous = app5sScheduleConfig_();
    if (JSON.stringify(previous) !== JSON.stringify(schedule)) {
      PropertiesService.getScriptProperties().setProperty(APP5S_SCHEDULE_PROPERTY, JSON.stringify(schedule));
      app5sSheet_('Auditoria').appendRow([new Date().toISOString(), 'HORARIO_CAMBIADO', '', '', '', '', '', adminEmail, 'Horario general actualizado (America/Santiago).']);
    }
    return { schedule, permissions: app5sAdminPermissions_(adminEmail), adminEmail };
  });
}

function app5sAdminUpdateOwner(payload) {
  const adminEmail = app5sRequireAdminEmail_('configure');
  if (!payload || typeof payload.stationId !== 'string' || typeof payload.owner !== 'string' || typeof payload.expectedOwner !== 'string') throw new Error('Datos de encargado inválidos.');
  const stationId = app5sValidStation_(payload.stationId);
  const owner = payload.owner.trim().replace(/\s+/g, ' ');
  if (owner.length > 100 || owner && (owner.length < 2 || /^[=+\-@]/.test(owner) || /[\x00-\x1f\x7f<>]/.test(owner))) throw new Error('Nombre del encargado inválido.');
  return app5sWithLock_(() => {
    const sheet = app5sSheet_('Configuracion');
    const last = sheet.getLastRow();
    const rows = last > 1 ? sheet.getRange(2, 1, last - 1, 4).getValues() : [];
    const matches = rows.map((row, index) => ({ row, index })).filter(item => String(item.row[0]).trim() === stationId);
    if (matches.length !== 1) throw new Error('Configuración de estación inválida o duplicada.');
    const current = String(matches[0].row[3] || '').trim();
    if (current !== payload.expectedOwner.trim()) throw new Error('El encargado fue cambiado por otra persona. Actualiza el panel.');
    if (current !== owner) {
      sheet.getRange(matches[0].index + 2, 4).setValue(owner);
      app5sSheet_('Auditoria').appendRow([new Date().toISOString(), 'ENCARGADO_CAMBIADO', stationId, '', '', '', '', adminEmail, `Encargado del área: ${current || '(vacío)'} → ${owner || '(vacío)'}`]);
    }
    return app5sAdminSnapshot_(adminEmail, isoWeekChile(app5sNow_()).key);
  });
}
