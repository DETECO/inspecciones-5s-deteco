/* Configuración privada: se consulta únicamente al abrir su sección. */
(() => {
  const el = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const labels = {Mon:'Lunes',Tue:'Martes',Wed:'Miércoles',Thu:'Jueves',Fri:'Viernes',Sat:'Sábado',Sun:'Domingo'};
  let generation = 0;
  let currentView = '';
  let currentSnapshot = null;
  let unlockControls = () => {};
  function call(method, payload, success, failure) {
    const runner = google.script.run.withSuccessHandler(success).withFailureHandler(failure);
    if (payload === undefined) runner[method]();
    else runner[method](payload);
  }
  function errorText(error) { return String(error?.message || error || 'No se pudo guardar. Inténtalo nuevamente.').replace(/^Exception:\s*/, ''); }
  function message(text, error = false) {
    const box = el('settings-result');
    if (!box) return;
    box.className = error ? 'notice settings-error' : 'notice settings-success';
    box.textContent = text;
    box.hidden = false;
  }
  function confirmSave(text, action) {
    const controls = [...el('settings-view').querySelectorAll('input,textarea')].map(input => ({input,disabled:input.disabled}));
    controls.forEach(({input}) => {input.disabled = true;});
    unlockControls = () => {controls.forEach(({input,disabled}) => {input.disabled = disabled;});};
    const box = el('settings-result');
    box.className = 'notice';
    box.innerHTML = '<p>' + escapeHtml(text) + '</p><div class="buttons"><button id="settings-cancel-confirm" class="cancel" type="button">Cancelar</button><button id="settings-confirm" class="confirm" type="button">Confirmar cambios</button></div>';
    box.hidden = false;
    el('settings-save').disabled = true;
    el('settings-cancel-confirm').addEventListener('click', () => { unlockControls();box.hidden = true;el('settings-save').disabled = false; });
    el('settings-confirm').addEventListener('click', () => { el('settings-confirm').disabled = true;el('settings-save').disabled = false;box.hidden = true;action(); });
    box.scrollIntoView({block:'nearest'});
  }
  function show(view, snapshot) {
    currentView = view;
    currentSnapshot = snapshot;
    const request = ++generation;
    const container = el('settings-view');
    if (!snapshot?.permissions?.canConfigure) { container.textContent = 'Tu cuenta no tiene permiso para cambiar esta configuración.'; return; }
    container.innerHTML = '<div class="message loading" role="status">Cargando configuración…</div>';
    const method = view === 'schedule' ? 'app5sAdminSettings' : 'app5sAdminNotificationSettings';
    call(method, undefined, result => {
      if (request !== generation) return;
      if (view === 'schedule') renderSchedule(result);
      else renderNotifications(result);
    }, error => {
      if (request !== generation) return;
      container.innerHTML = '<div class="message error" role="alert">' + escapeHtml(errorText(error)) + '</div><button id="retry-settings" class="cancel" type="button">Reintentar</button>';
      el('retry-settings').addEventListener('click', () => show(view, snapshot));
    });
  }
  function renderSchedule(result) {
    el('settings-view').innerHTML = `<section class="settings-card"><h2>Días y horarios habilitados</h2><p>Zona horaria: <strong>America/Santiago</strong>. Solo afectan las inspecciones nuevas; una inspección ya iniciada conserva su horario de cierre. No se permiten franjas que crucen medianoche ni otra semana ISO.</p><form id="schedule-form"><div class="schedule-head"><span>Día</span><span>Desde</span><span>Último inicio</span><span>Cierre</span></div>${result.schedule.days.map(day => `<div class="schedule-row" data-day="${escapeHtml(day.day)}"><label class="day-toggle"><input type="checkbox" name="enabled" ${day.enabled ? 'checked' : ''}> ${labels[day.day]}</label>${['start','lastStart','end'].map(field => `<label class="time-field"><span>${{start:'Desde',lastStart:'Último inicio',end:'Cierre'}[field]}</span><input type="time" name="${field}" value="${escapeHtml(day[field])}" aria-label="${labels[day.day]}: ${{start:'desde',lastStart:'último inicio',end:'cierre'}[field]}" required ${day.enabled ? '' : 'disabled'}></label>`).join('')}</div>`).join('')}<div id="settings-result" class="notice" role="status" hidden></div><div class="settings-save"><button id="settings-save" class="confirm" type="submit">Guardar horarios</button></div></form></section>`;
    el('schedule-form').querySelectorAll('[name="enabled"]').forEach(input => input.addEventListener('change', () => {
      input.closest('.schedule-row').querySelectorAll('input[type="time"]').forEach(time => { time.disabled = !input.checked; });
    }));
    el('schedule-form').addEventListener('submit', event => {
      event.preventDefault();
      const days = [...el('schedule-form').querySelectorAll('[data-day]')].map(row => ({day:row.dataset.day,enabled:row.querySelector('[name="enabled"]').checked,...Object.fromEntries(['start','lastStart','end'].map(field => [field,row.querySelector('[name="' + field + '"]').value]))}));
      if (!days.some(day => day.enabled) || days.some(day => day.enabled && (!day.start || !day.lastStart || !day.end || day.start >= day.lastStart || day.lastStart > day.end))) { message('Habilita al menos un día y revisa los límites: desde < último inicio ≤ cierre.', true); return; }
      confirmSave('¿Guardar estos horarios para las inspecciones nuevas? Las inspecciones ya iniciadas no cambian.', () => save('app5sAdminSaveSchedule', {schedule:{days}}, result => { renderSchedule(result); message('Horarios guardados. Se aplicarán al iniciar nuevas inspecciones.'); }));
    });
  }
  function renderNotifications(result) {
    const config = result.config;
    const stations = currentSnapshot.stations || [];
    const recipientList = values => escapeHtml((values || []).join(', '));
    const authorization = result.authorizationRequired ? '<div class="notice">Falta autorizar el envío en Google. El propietario debe ejecutar <strong>autorizarAvisosApp5S</strong> en Apps Script y aceptar los permisos. Guardar destinatarios no envía correos de prueba.</div>' : '';
    el('settings-view').innerHTML = `<section class="settings-card"><h2>Destinatarios y programación</h2><p>Los avisos están deshabilitados hasta que los actives. Los envíos se realizan individualmente, sin mostrar la lista de destinatarios. Horario de Chile (America/Santiago).</p>${authorization}<form id="notifications-form"><label class="setting-toggle"><input id="weekly-enabled" type="checkbox" ${config.weeklyEnabled ? 'checked' : ''}> Enviar resumen semanal los viernes</label><label class="field setting-hour">Hora del viernes<input id="weekly-hour" type="number" min="0" max="23" step="1" required value="${config.weeklyHour}"></label><p class="settings-help">Google programa el envío dentro de la hora seleccionada, no en un minuto exacto. Si aún hay horarios habilitados después del envío, el resumen se identifica como parcial.</p><label class="setting-toggle"><input id="closed-enabled" type="checkbox" ${config.closedEnabled ? 'checked' : ''}> Avisar cuando se cierre una inspección</label><label class="field">Destinatarios generales<textarea id="general-recipients" rows="2" placeholder="nombre@deteco.cl, otro@deteco.cl">${recipientList(config.generalRecipients)}</textarea></label><p class="settings-help">Separa los correos con coma, punto y coma o salto de línea. Máximo 50 destinatarios distintos. Los destinatarios por estación reciben únicamente la información de esas estaciones.</p><h3>Destinatarios por estación</h3>${stations.map(station => `<label class="field">${escapeHtml(station.stationName)}<textarea rows="2" data-station-recipients="${escapeHtml(station.stationId)}" placeholder="Opcional">${recipientList(config.stationRecipients?.[station.stationId])}</textarea></label>`).join('')}<div id="settings-result" class="notice" role="status" hidden></div><div class="settings-save"><button id="settings-save" class="confirm" type="submit">Guardar avisos</button></div></form><p class="settings-help" id="notifications-status"></p></section>`;
    el('notifications-status').textContent = result.lastStatus ? 'Estado de envíos: ' + (typeof result.lastStatus === 'string' ? result.lastStatus : JSON.stringify(result.lastStatus)) : 'Todavía no hay envíos registrados.';
    const processing = document.createElement('p');
    processing.className = 'settings-help';
    processing.textContent = 'El aviso de cierre se procesa en la siguiente revisión automática (aproximadamente cada 5 minutos), sin retrasar el guardado de la inspección.';
    el('notifications-form').before(processing);
    const recipients = text => [...new Set(text.split(/[,;\n]+/).map(value => value.trim().toLowerCase()).filter(Boolean))];
    el('notifications-form').addEventListener('submit', event => {
      event.preventDefault();
      const generalRecipients = recipients(el('general-recipients').value);
      const stationRecipients = Object.fromEntries([...el('notifications-form').querySelectorAll('[data-station-recipients]')].map(input => [input.dataset.stationRecipients, recipients(input.value)]));
      const addresses = [...new Set([...generalRecipients, ...Object.values(stationRecipients).flat()])];
      if (addresses.length > 50 || addresses.some(value => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value))) { message('Revisa los correos: deben ser direcciones válidas, sin espacios, con un máximo de 50 destinatarios distintos.', true); return; }
      const nextConfig = {weeklyEnabled:el('weekly-enabled').checked,closedEnabled:el('closed-enabled').checked,weeklyHour:Number(el('weekly-hour').value),generalRecipients,stationRecipients};
      if ((nextConfig.weeklyEnabled || nextConfig.closedEnabled) && !addresses.length) { message('Agrega al menos un destinatario antes de activar avisos.', true); return; }
      confirmSave('¿Guardar estos destinatarios y opciones? Si activas los avisos, se enviarán correos reales según esta configuración.', () => save('app5sAdminSaveNotifications', {config:nextConfig}, result => { renderNotifications(result); message(result.authorizationRequired ? 'Configuración guardada. Falta la autorización de Google del propietario para activar los envíos.' : 'Configuración de avisos guardada. No se envió ningún correo de prueba.'); }));
    });
  }
  function save(method, payload, done) {
    const button = el('settings-save');
    if (button.disabled) return;
    const request = generation;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Guardando…';
    call(method, payload, result => {
      if (request !== generation) return;
      done(result);
    }, error => {
      if (request !== generation) return;
      unlockControls();
      button.disabled = false;
      button.textContent = label;
      message(errorText(error), true);
    });
  }
  window.app5sAdminConfig = {show, hide(){generation++;currentView='';}, refresh(){if(currentView)show(currentView,currentSnapshot);}};
})();
