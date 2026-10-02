const APP5S_FINAL_PREFIX = 'APP5S_FINAL:';

function app5sFinalSession_(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,160}$/.test(value)) throw new Error('Sesión de inspección inválida.');
  return value;
}

function app5sFinalLeaseKey_(stationId, week) {
  return APP5S_FINAL_PREFIX + 'LEASE:' + stationId + ':' + week;
}

function app5sFinalLease_(stationId, week) {
  const raw = PropertiesService.getScriptProperties().getProperty(app5sFinalLeaseKey_(stationId, week));
  return raw ? JSON.parse(raw) : null;
}

function app5sFinalPhotoPrefix_(lease) {
  return APP5S_FINAL_PREFIX + 'PHOTO:' + lease.stationId + ':' + lease.week + ':' + lease.sessionId + ':';
}

function app5sFinalId_(lease, value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, lease.stationId + ':' + lease.week + ':' + lease.sessionId + ':' + value);
  return 'final-' + digest.map(byte => (byte & 255).toString(16).padStart(2, '0')).join('').slice(0, 40);
}

function app5sFinalClearPhotos_(lease) {
  const props = PropertiesService.getScriptProperties();
  const prefix = app5sFinalPhotoPrefix_(lease);
  Object.keys(props.getProperties()).filter(key => key.startsWith(prefix)).forEach(key => props.deleteProperty(key));
}

function app5sFinalRelease_(stationId, week) {
  const lease = app5sFinalLease_(stationId, week);
  if (!lease) return false;
  app5sFinalClearPhotos_(lease);
  PropertiesService.getScriptProperties().deleteProperty(app5sFinalLeaseKey_(stationId, week));
  return true;
}

function app5sFinalPrune_(week) {
  const props = PropertiesService.getScriptProperties();
  Object.entries(props.getProperties()).filter(([key]) => key.startsWith(APP5S_FINAL_PREFIX)).forEach(([key, value]) => {
    let item;
    try { item = JSON.parse(value); } catch { return; }
    // Solo recibos y reservas temporales de este protocolo. Nunca Sheet ni archivos Drive.
    if (typeof item.week === 'string' && /^\d{4}-W\d{2}$/.test(item.week) && item.week < week) props.deleteProperty(key);
  });
}

function app5sFinalState_(stationId, week, lease) {
  const state = createInspection({ stationId, week, pendingKaizen: app5sLoadPendingKaizen_(stationId) });
  state.schedule = lease?.schedule || (typeof app5sScheduleConfig_ === 'function' ? app5sScheduleConfig_() : DEFAULT_INSPECTION_SCHEDULE);
  return lease ? reserveInspection(state, { clientId: lease.clientId, inspectorName: lease.inspectorName, at: lease.startedAt }) : state;
}

function app5sFinalReply_(state, stationId, meta) {
  const station = app5sStationById_(stationId, true);
  return {
    state: app5sPublicState_(state),
    station: station ? { id: station.id, name: station.name, kind: station.kind } : null,
    inspectorNames: app5sInspectorNames_(),
    requestId: meta.requestId,
    receivedAt: meta.receivedAt,
  };
}

function app5sFinalRequireLease_(lease, clientId, sessionId) {
  if (!lease || lease.clientId !== clientId || lease.sessionId !== sessionId) throw new Error('La reserva ya no pertenece a esta inspección. Comienza una nueva o solicita liberación al administrador.');
}

function app5sFinalPhotos_(lease) {
  const prefix = app5sFinalPhotoPrefix_(lease);
  return Object.entries(PropertiesService.getScriptProperties().getProperties())
    .filter(([key]) => key.startsWith(prefix)).map(([, value]) => JSON.parse(value))
    .filter(item => item.stationId === lease.stationId && item.week === lease.week);
}

function app5sFinalSnapshot_(lease, payload, now) {
  const at = new Date(payload.occurredAt);
  if (!Number.isFinite(at.getTime()) || at > now || at < new Date(lease.startedAt) || isoWeekChile(at).key !== lease.week) throw new Error('La hora de cierre no corresponde a esta inspección.');
  const windowState = inspectionWindow(now, true, lease.schedule || DEFAULT_INSPECTION_SCHEDULE);
  if (windowState === 'closed') throw new Error('La inspección no puede cerrarse fuera del horario permitido.');
  const answers = payload.answers;
  const questions = inspectionQuestions(payload);
  if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).length !== questions.length || questions.some(q => !Object.hasOwn(answers, q.id) || !Number.isInteger(answers[q.id]) || answers[q.id] < 0 || answers[q.id] > 5)) throw new Error('Faltan respuestas o hay valores inválidos antes del cierre.');
  const state = app5sFinalState_(lease.stationId, lease.week, lease);
  state.dailyManagementApplicable = payload.dailyManagementApplicable;
  const proofs = app5sFinalPhotos_(lease);
  const usedPhotos = new Set();
  const usedIds = new Set();
  const findingMap = payload.findings || {};
  if (Array.isArray(findingMap) || Object.keys(findingMap).some(id => !questions.some(q => q.id === id))) throw new Error('Hallazgos inválidos.');
  function ownPhoto(photoId, category) {
    if (!proofs.some(item => item.photoId === photoId && item.category === category) || usedPhotos.has(photoId)) throw new Error('Falta una fotografía propia y distinta por cada hallazgo o solución.');
    usedPhotos.add(photoId);
    return photoId;
  }
  state.answers = { ...answers };
  questions.forEach(question => {
    const items = findingMap[question.id] || [];
    if (!Array.isArray(items) || items.length !== answers[question.id]) throw new Error('Falta una fotografía por cada hallazgo o hay fotografías sobrantes.');
    state.findings[question.id] = items.map(item => {
      if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{8,160}$/.test(item.id) || usedIds.has(item.id)) throw new Error('Identificador de hallazgo inválido o repetido.');
      usedIds.add(item.id);
      return { id: app5sFinalId_(lease, item.id), photoId: ownPhoto(item.photoId, 'Hallazgos'), note: typeof item.note === 'string' ? item.note.trim().slice(0, 500) : '' };
    });
  });
  const reviews = payload.kaizenReviews || {};
  if (Array.isArray(reviews) || Object.keys(reviews).some(id => !state.pendingKaizen.some(item => item.id === id))) throw new Error('Revisión de Kaizen inválida.');
  state.pendingKaizen.forEach(item => {
    const review = reviews[item.id];
    if (!review || !['solved', 'pending'].includes(review.decision)) throw new Error('Falta resolver o justificar todos los Kaizen pendientes.');
    state.kaizenReviews[item.id] = review.decision === 'solved'
      ? { decision: 'solved', photoId: ownPhoto(review.photoId, 'Cierres kaizen') }
      : { decision: 'pending', reason: typeof review.reason === 'string' ? review.reason.trim().slice(0, 500) : '' };
  });
  const closed = closeInspection(state, { clientId: lease.clientId, at: at.toISOString(), completionStatus: windowState === 'late-continuation' ? 'cumplida-con-atraso' : 'cumplida' });
  closed.finalSessionId = lease.sessionId;
  closed.finalClientId = lease.clientId;
  return closed;
}

function app5sFinalFinish_(state) {
  if (state.finalMaterialized === true) {
    app5sFinalRelease_(state.stationId, state.week);
    if (typeof app5sNotifyClosedSafe_ === 'function') app5sNotifyClosedSafe_(state);
    return;
  }
  app5sMaterializeFinal_(state);
  app5sRememberInspector_(state.closedBy);
  state.finalMaterialized = true;
  app5sSaveState_(state);
  app5sFinalRelease_(state.stationId, state.week);
  if (typeof app5sNotifyClosedSafe_ === 'function') app5sNotifyClosedSafe_(state);
}

function app5sFinalHandle_(operation, payload, stationId, meta) {
  const now = app5sNow_();
  const week = isoWeekChile(now).key;
  const clientId = app5sValidClient_(payload.clientId);
  const sessionId = app5sFinalSession_(payload.sessionId);
  const stored = app5sLoadState_(stationId, week);
  let lease = app5sFinalLease_(stationId, week);
  if (operation === 'final-state') {
    const state = stored && ['closed', 'expired'].includes(stored.status) ? stored : app5sFinalState_(stationId, week, lease);
    if (!lease && stored?.status === 'open' && stored.editor) state.editor = { ...stored.editor };
    return app5sFinalReply_(state, stationId, meta);
  }
  if (stored && ['closed', 'expired'].includes(stored.status)) {
    if (operation === 'begin-final') return app5sFinalReply_(stored, stationId, meta);
    if (operation === 'submit-final' && stored.status === 'closed' && stored.finalSessionId === sessionId && stored.finalClientId === clientId) {
      app5sFinalFinish_(stored);
      return app5sFinalReply_(stored, stationId, meta);
    }
    throw new Error('La inspección de esta semana ya está cerrada.');
  }
  if (operation === 'begin-final') {
    const schedule = typeof app5sScheduleConfig_ === 'function' ? app5sScheduleConfig_() : DEFAULT_INSPECTION_SCHEDULE;
    if ((!lease || lease.sessionId !== sessionId) && inspectionWindow(now, false, schedule) !== 'open') throw new Error('No se puede iniciar una inspección fuera del horario permitido.');
    if (lease && lease.clientId !== clientId || !lease && stored?.editor && stored.editor.clientId !== clientId) throw new Error('La estación tiene una reserva activa. Solicita su liberación al administrador.');
    if (!lease || lease.sessionId !== sessionId) {
      app5sFinalPrune_(week);
      if (lease) app5sFinalClearPhotos_(lease);
      const state = reserveInspection(createInspection({ stationId, week }), { clientId, inspectorName: payload.inspectorName, at: now.toISOString() });
      lease = { stationId, week, clientId, sessionId, inspectorName: state.startedBy, startedAt: state.startedAt, schedule };
      PropertiesService.getScriptProperties().setProperty(app5sFinalLeaseKey_(stationId, week), JSON.stringify(lease));
    }
    return app5sFinalReply_(app5sFinalState_(stationId, week, lease), stationId, meta);
  }
  app5sFinalRequireLease_(lease, clientId, sessionId);
  if (operation === 'upload-final-photo') {
    if (typeof payload.photoId !== 'string' || !/^[A-Za-z0-9_-]{8,160}$/.test(payload.photoId) || !['Hallazgos', 'Cierres kaizen'].includes(payload.category)) throw new Error('Fotografía inválida.');
    const props = PropertiesService.getScriptProperties();
    const key = app5sFinalPhotoPrefix_(lease) + payload.photoId;
    const existing = props.getProperty(key);
    if (existing) {
      const receipt = JSON.parse(existing);
      if (receipt.category !== payload.category) throw new Error('La fotografía pertenece a otra categoría.');
      return { photoId: receipt.photoId };
    }
    if (app5sFinalPhotos_(lease).length >= 180) throw new Error('Se alcanzó el máximo de fotografías de esta inspección.');
    const filename = app5sFinalId_(lease, payload.photoId);
    const photoId = app5sSavePhoto_(lease, payload.dataUri, filename, payload.category);
    props.setProperty(key, JSON.stringify({ stationId, week, photoId, category: payload.category }));
    return { photoId };
  }
  if (operation === 'submit-final') {
    const state = app5sFinalSnapshot_(lease, payload, now);
    app5sSaveState_(state); // Recuperable incluso si una tabla falla durante materialización.
    app5sFinalFinish_(state);
    return app5sFinalReply_(state, stationId, meta);
  }
  throw new Error('Operación inválida.');
}
