const APP5S_BRIDGE_CHANNEL = 'deteco-5s-bridge-v1';
const APP5S_REQUEST_ID = /^[A-Za-z0-9_-]{16,160}$/;

function app5sDecodePayload_(encoded) {
  try {
    if (typeof encoded !== 'string' || !encoded) throw new Error('missing');
    const bytes = Utilities.base64Decode(encoded);
    const payload = JSON.parse(Utilities.newBlob(bytes).getDataAsString('UTF-8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('shape');
    if (typeof payload.accessToken !== 'string' || !/^[A-Za-z0-9_-]{24,160}$/.test(payload.accessToken)) throw new Error('access');
    return payload;
  } catch (error) {
    throw new Error('Payload de solicitud inválido.');
  }
}

function app5sFrontendOrigin_() {
  const properties = PropertiesService.getScriptProperties();
  const configuredOrigin = String(properties.getProperty('APP5S_FRONTEND_ORIGIN') || '').trim();
  const frontendUrl = String(properties.getProperty('APP5S_FRONTEND_URL') || '').trim();
  const inferredOrigin = (frontendUrl.match(/^https:\/\/[A-Za-z0-9-]+\.github\.io/) || [])[0] || '';
  const origin = configuredOrigin || inferredOrigin;
  if (!/^https:\/\/[A-Za-z0-9-]+\.github\.io$/.test(origin)) {
    throw new Error('El origen público de la app no está configurado.');
  }
  return origin;
}

function app5sRequestId_(value, label) {
  if (typeof value !== 'string' || !APP5S_REQUEST_ID.test(value)) throw new Error(`${label} inválido.`);
  return value;
}

function app5sEncodeResult_(result) {
  return Utilities.base64Encode(Utilities.newBlob(JSON.stringify(result), 'application/json').getBytes());
}

function app5sBridgeReceipt_(requestId, nonce, result) {
  const receipt = {
    channel: APP5S_BRIDGE_CHANNEL,
    requestId: app5sRequestId_(requestId, 'Identificador de solicitud'),
    nonce: app5sRequestId_(nonce, 'Nonce'),
    encodedResult: app5sEncodeResult_(result),
  };
  const origin = app5sFrontendOrigin_();
  const html = `<script>window.top.postMessage(${JSON.stringify(receipt)}, ${JSON.stringify(origin)});</script>`;
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function app5sSafeBridgeError_(error) {
  const message = String(error && error.message || '');
  if (/^(Acceso|Estación|Horario|Inspección|Reserva|Pregunta|Hallazgos|Kaizen|Falta|Payload|No hay|La inspección|La reserva)/i.test(message)) return message;
  return 'No fue posible completar la operación. Reintenta o avisa al administrador.';
}

function doPost(e) {
  const parameter = (e && e.parameter) || {};
  const requestId = parameter.requestId;
  const nonce = parameter.nonce;
  try {
    app5sRequestId_(requestId, 'Identificador de solicitud');
    app5sRequestId_(nonce, 'Nonce');
    const payload = app5sDecodePayload_(parameter.payload);
    const result = app5sHandle_(String(parameter.operation || ''), payload, {
      requestId,
      nonce,
      receivedAt: new Date().toISOString(),
    });
    return app5sBridgeReceipt_(requestId, nonce, { ok: true, ...result });
  } catch (error) {
    return app5sBridgeReceipt_(requestId, nonce, { ok: false, error: app5sSafeBridgeError_(error) });
  }
}

function doGet() {
  const serviceUrl = String(ScriptApp.getService().getUrl() || '');
  const deploymentId = serviceUrl.match(/\/s\/([A-Za-z0-9_-]+)\/(?:exec|dev)(?:[/?#]|$)/)?.[1];
  if (!deploymentId) throw new Error('No se encontró la dirección publicada del panel.');
  const continuation = 'https://script.google.com/a/macros/deteco.cl/s/' + deploymentId + '/exec';
  const accountUrl = 'https://accounts.google.com/AccountChooser?continue=' + encodeURIComponent(continuation);
  const html = HtmlService.createHtmlOutputFromFile('Admin').getContent()
    .replace('__APP5S_ADMIN_ACCOUNT_URL__', accountUrl);
  return HtmlService.createHtmlOutput(html)
    .setTitle('Administración 5S DETECO')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Generado por build-core.cjs desde app/domain/. No editar directamente.

const station = (id, name, kind) => Object.freeze({ id, name, kind });
const module = (id, title, rows) => Object.freeze({
  id,
  title,
  questions: Object.freeze(rows.map(([questionId, text]) => Object.freeze({ id: questionId, moduleId: id, text }))),
});

const STATIONS = Object.freeze([
  station('oficina', 'OFICINA', 'planta'),
  station('hormigon', 'HORMIGON', 'planta'),
  station('soldadura', 'SOLDADURA', 'planta'),
  station('electricidad', 'ELECTRICIDAD', 'planta'),
  station('bodega', 'BODEGA', 'planta'),
  station('mantencion', 'MANTENCION', 'planta'),
  station('carpinteria', 'CARPINTERIA', 'planta'),
  station('enfierradura', 'ENFIERRADURA', 'planta'),
  station('obra-santa-julia', 'OBRA SANTA JULIA', 'obra'),
]);

const MODULES = Object.freeze([
  module('separar', 'SEPARAR', [
    ['SEP-01', '¿Está el área de trabajo libre de artículos innecesarios?'],
    ['SEP-02', '¿Están las vías, pasillos y sectores de trabajo libres de estorbos?'],
    ['SEP-03', '¿Los artículos se encuentran en la cantidad necesaria?'],
    ['SEP-04', '¿Se utiliza el sistema de tarjetas naranjas?'],
  ]),
  module('organizar', 'ORGANIZAR', [
    ['ORG-01', '¿Existe un lugar específico para cada elemento y está marcado visualmente?'],
    ['ORG-02', '¿Los insumos están claramente rotulados y organizados?'],
    ['ORG-03', '¿Se indica la demanda semanal para cada tipo de material?'],
    ['ORG-04', '¿Existe un mapa visible para localizar los insumos?'],
    ['ORG-05', '¿Se vuelven a colocar las cosas en su lugar después de utilizarlas?'],
  ]),
  module('limpiar', 'LIMPIAR', [
    ['LIM-01', '¿Son las áreas de trabajo limpias? ¿Se mantiene la limpieza durante la jornada laboral?'],
    ['LIM-02', '¿Los equipos y/o herramientas se mantienen en buenas condiciones y limpios?'],
    ['LIM-03', '¿Existe un lugar definido para útiles de aseo?'],
    ['LIM-04', '¿Los basureros o contenedores de reciclaje se encuentran debidamente identificados?'],
    ['LIM-05', '¿Existe un programa de limpieza conocido por todos?'],
  ]),
  module('estandarizar', 'ESTANDARIZAR', [
    ['EST-01', '¿Se encuentran los sectores demarcados correctamente?'],
    ['EST-02', '¿Se encuentran identificados con su nombre los elementos de almacenaje?'],
    ['EST-03', '¿Se utiliza un sistema de alerta visual para quiebres de stock según el estándar definido?'],
    ['EST-04', '¿Existe un estándar definido por la organización para identificar todos los elementos?'],
    ['EST-05', '¿Existe señalética de seguridad actualizada y acorde a la infraestructura?'],
    ['EST-06', '¿Se encuentra actualizada ZN Online según el estándar definido?'],
  ]),
  module('sustentar', 'SUSTENTAR', [
    ['SUS-01', '¿El personal del área comprende la metodología 5S? (Realizar encuesta al personal).'],
    ['SUS-02', '¿Se identifica compromiso y disciplina en 5S por parte del personal del área y jefatura?'],
    ['SUS-03', '¿Se realiza una rutina de revisión de alerta visual para quiebres de stock?'],
    ['SUS-04', '¿Se encuentra publicada la última auditoría 5S en el panel de gestión del área?'],
    ['SUS-05', '¿Existe un cierre de las no conformidades de la auditoría anterior?'],
  ]),
]);

const QUESTIONS = Object.freeze(MODULES.flatMap(item => item.questions));
const DAILY_MANAGEMENT = module('gerenciamiento-diario', 'GERENCIAMIENTO DIARIO', [
  ['GD-01', '¿Existe tablero GD logístico según el estándar definido por la organización?'],
  ['GD-02', '¿Está el calendario de abastecimiento actualizado y según el estándar definido por la organización?'],
  ['GD-03', '¿Se encuentra el control de inventario actualizado en el panel de GD logístico?'],
  ['GD-04', '¿Se encuentra actualizado el nivel de servicio en el panel GD logístico, según el estándar definido?'],
  ['GD-05', '¿Se encuentra actualizado el nivel de inventario en el panel GD logístico, según el estándar definido?'],
  ['GD-06', '¿Se utiliza activamente la solución de problemas en el panel GD logístico, según el estándar definido?'],
  ['GD-07', '¿Se realiza la reunión de GD logística de manera diaria?'],
  ['GD-08', '¿Participa al menos uno de VO/AO/OT en la reunión de GD una vez a la semana?'],
]);
const questionsById = new Map([...QUESTIONS, ...DAILY_MANAGEMENT.questions].map(question => [question.id, question]));

function getQuestion(id) {
  return questionsById.get(id) ?? null;
}


const validCount = value => Number.isInteger(value) && value >= 0 && value <= 5;

function scoreInspection(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new TypeError('La inspección está incompleta: se requieren 25 respuestas.');
  }

  const moduleScores = {};
  for (const module of MODULES) {
    let points = 0;
    for (const question of module.questions) {
      if (!Object.hasOwn(answers, question.id)) {
        throw new Error('La inspección está incompleta: se requieren 25 respuestas.');
      }
      const count = answers[question.id];
      if (!validCount(count)) {
        throw new RangeError(`Los hallazgos de ${question.id} deben ser un entero de 0 a 5.`);
      }
      points += 5 - count;
    }
    moduleScores[module.id] = points / module.questions.length;
  }

  return {
    moduleScores,
    finalScore: Object.values(moduleScores).reduce((sum, score) => sum + score, 0) / MODULES.length,
  };
}

function validateInspection(answers, findings = {}, questions = QUESTIONS) {
  const questionIds = new Set(questions.map(question => question.id));
  const missingQuestions = [];
  const invalidQuestions = [];
  const missingPhotos = [];
  const extraFindings = [];
  const answerMap = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  const findingMap = findings && typeof findings === 'object' && !Array.isArray(findings) ? findings : {};

  for (const question of questions) {
    if (!Object.hasOwn(answerMap, question.id) || answerMap[question.id] === null || answerMap[question.id] === '') {
      missingQuestions.push(question.id);
      continue;
    }
    const count = answerMap[question.id];
    if (!validCount(count)) {
      invalidQuestions.push(question.id);
      continue;
    }

    const items = Array.isArray(findingMap[question.id]) ? findingMap[question.id] : [];
    for (let index = 0; index < count; index += 1) {
      if (typeof items[index]?.photoId !== 'string' || !items[index].photoId.trim()) {
        missingPhotos.push({ questionId: question.id, ordinal: index + 1 });
      }
    }
    if (items.length > count) {
      extraFindings.push({ questionId: question.id, count: items.length - count });
    }
  }

  for (const [id, items] of Object.entries(findingMap)) {
    if (!questionIds.has(id) && Array.isArray(items) && items.length > 0) {
      extraFindings.push({ questionId: id, count: items.length });
    }
  }

  return {
    missingQuestions,
    invalidQuestions,
    missingPhotos,
    extraFindings,
    canClose: !missingQuestions.length && !invalidQuestions.length && !missingPhotos.length && !extraFindings.length,
  };
}

function validateKaizenReviews(pending, reviews = {}) {
  const pendingItems = Array.isArray(pending) ? pending : [];
  const reviewMap = reviews && typeof reviews === 'object' && !Array.isArray(reviews) ? reviews : {};
  const pendingIds = new Set(pendingItems.map(item => item.id));
  const missingDecisions = [];
  const missingEvidence = [];
  const missingReasons = [];
  const unknownDecisions = Object.keys(reviewMap).filter(id => !pendingIds.has(id));

  for (const kaizen of pendingItems) {
    const review = reviewMap[kaizen.id];
    if (!review || !['solved', 'pending'].includes(review.decision)) {
      missingDecisions.push(kaizen.id);
    } else if (review.decision === 'solved') {
      if (typeof review.photoId !== 'string' || !review.photoId.trim()) missingEvidence.push(kaizen.id);
    } else if (typeof review.reason !== 'string' || !review.reason.trim()) {
      missingReasons.push(kaizen.id);
    }
  }

  return {
    missingDecisions,
    missingEvidence,
    missingReasons,
    unknownDecisions,
    canContinue: !missingDecisions.length && !missingEvidence.length && !missingReasons.length && !unknownDecisions.length,
  };
}

function classifyNewFinding(stationId, choice, knownKaizen) {
  if (!stationId || !choice || !Array.isArray(knownKaizen)) throw new Error('Faltan datos del hallazgo.');
  if (choice.kind === 'existing') {
    const item = knownKaizen.find(kaizen => kaizen.id === choice.kaizenId);
    if (!item) throw new Error('No se encontró el kaizen elegido.');
    if (item.stationId !== stationId) throw new Error('El kaizen pertenece a otra estación.');
    if (item.status !== 'open') throw new Error('Solo se puede vincular con un kaizen abierto.');
    return { action: 'link', kaizenId: item.id };
  }
  if (choice.kind === 'new') {
    if (!choice.recurrenceOf) return { action: 'create', recurrenceOf: null };
    const item = knownKaizen.find(kaizen => kaizen.id === choice.recurrenceOf);
    if (!item || item.stationId !== stationId || item.status !== 'closed') {
      throw new Error('La recurrencia debe referirse a un kaizen cerrado de la misma estación.');
    }
    return { action: 'create', recurrenceOf: item.id };
  }
  throw new Error('Elige si el hallazgo es nuevo o corresponde a un kaizen abierto.');
}


function inspectionQuestions(state) {
  const applicable = state.dailyManagementApplicable;
  // Undefined identifies a legacy client, not an explicit No.
  if (applicable !== undefined && typeof applicable !== 'boolean') {
    throw new Error('Falta indicar si corresponde Gerenciamiento Diario.');
  }
  return applicable === true ? [...QUESTIONS, ...DAILY_MANAGEMENT.questions] : QUESTIONS;
}

function dailyManagementResult(state) {
  inspectionQuestions(state);
  if (state.dailyManagementApplicable !== true) {
    if (DAILY_MANAGEMENT.questions.some(q => Object.hasOwn(state.answers, q.id) || state.findings[q.id]?.length)) {
      throw new Error('Gerenciamiento Diario no corresponde; hay respuestas o fotos de ese módulo.');
    }
    return { applicable: state.dailyManagementApplicable ?? null, score: null };
  }
  return { applicable: true, score: DAILY_MANAGEMENT.questions.reduce((total, q) => total + 5 - state.answers[q.id], 0) / DAILY_MANAGEMENT.questions.length };
}





const completionStatuses = new Set(['cumplida', 'cumplida-con-atraso']);

function copyState(state, changes = {}) {
  return {
    ...state,
    answers: { ...state.answers },
    findings: Object.fromEntries(Object.entries(state.findings).map(([id, items]) => [id, items.map(item => ({ ...item }))])),
    kaizenReviews: Object.fromEntries(Object.entries(state.kaizenReviews).map(([id, review]) => [id, { ...review }])),
    pendingKaizen: state.pendingKaizen.map(item => ({ ...item })),
    continuedBy: [...state.continuedBy],
    ...changes,
  };
}

function requireClient(clientId) {
  if (typeof clientId !== 'string' || clientId.trim().length < 3) throw new Error('Identificador de teléfono inválido.');
}

function requireInspectorName(inspectorName) {
  if (typeof inspectorName !== 'string' || inspectorName.trim().length < 2 || inspectorName.trim().length > 80) {
    throw new Error('El nombre del inspector debe tener entre 2 y 80 caracteres.');
  }
  return inspectorName.trim().replace(/\s+/g, ' ');
}

function requireEditor(state, clientId) {
  requireClient(clientId);
  if (state.status === 'closed' || state.status === 'expired') throw new Error('La inspección ya está cerrada.');
  if (state.adminRevokedClientIds?.includes(clientId)) throw new Error('La reserva de este teléfono fue liberada por administración. Sus cambios locales no se pueden sincronizar; continúa desde otro dispositivo.');
  if (state.status !== 'open' || !state.editor || state.editor.clientId !== clientId) {
    throw new Error('El teléfono no tiene la reserva activa de esta estación.');
  }
}

function timestamp(value) {
  if (!value) return '';
  if (!Number.isFinite(new Date(value).getTime())) throw new Error('Fecha de operación inválida.');
  return new Date(value).toISOString();
}

function createInspection({ stationId, week, pendingKaizen = [] }) {
  if (typeof stationId !== 'string' || !stationId.trim()) throw new Error('Falta la estación.');
  if (typeof week !== 'string' || !/^\d{4}-W\d{2}$/.test(week)) throw new Error('Semana ISO inválida.');
  if (!Array.isArray(pendingKaizen)) throw new Error('La lista de kaizen pendientes es inválida.');
  return {
    stationId: stationId.trim(),
    week,
    status: 'new',
    startedAt: '',
    startedBy: '',
    editor: null,
    takeover: null,
    continuedBy: [],
    answers: {},
    findings: {},
    pendingKaizen: pendingKaizen.map(item => ({ ...item })),
    kaizenReviews: {},
    result: null,
    responsibleName: '',
    expiredEditor: null,
    expiredByDeadline: false,
    adminRevokedClientIds: [],
    closedAt: '',
    closedBy: '',
  };
}

function reserveInspection(state, { clientId, inspectorName, at } = {}) {
  requireClient(clientId);
  const name = requireInspectorName(inspectorName);
  if (state.status === 'closed' || state.status === 'expired') throw new Error('La inspección de esta semana ya está cerrada.');
  if (state.adminRevokedClientIds?.includes(clientId)) throw new Error('La reserva de este teléfono fue liberada por administración. Sus cambios locales no se pueden sincronizar; continúa desde otro dispositivo.');
  if (state.editor && state.editor.clientId !== clientId) throw new Error('La estación tiene una reserva activa.');
  if (state.editor?.clientId === clientId) {
    const continuedBy = name === state.startedBy || state.continuedBy.includes(name)
      ? [...state.continuedBy]
      : [...state.continuedBy, name];
    return copyState(state, { editor: { clientId, inspectorName: name }, continuedBy });
  }
  const startedAt = state.startedAt || timestamp(at);
  return copyState(state, {
    status: 'open',
    startedAt,
    startedBy: state.startedBy || name,
    editor: { clientId, inspectorName: name },
  });
}

function requestTakeover(state, { clientId, inspectorName, at } = {}) {
  requireClient(clientId);
  const name = requireInspectorName(inspectorName);
  if (state.status !== 'open' || !state.editor) throw new Error('No hay una inspección en curso para retomar.');
  if (state.editor.clientId === clientId) return copyState(state);
  if (state.takeover && state.takeover.requestedBy !== clientId) throw new Error('Otro teléfono ya solicitó tomar el control.');
  return copyState(state, {
    takeover: {
      requestedBy: clientId,
      inspectorName: name,
      requestedAt: timestamp(at),
    },
  });
}

function acknowledgeTakeover(state, { clientId, pendingSyncOps, at } = {}) {
  requireEditor(state, clientId);
  if (!Number.isInteger(pendingSyncOps) || pendingSyncOps < 0) throw new Error('La cola local de sincronización es inválida.');
  if (!state.takeover || pendingSyncOps > 0) return copyState(state);
  const nextEditor = {
    clientId: state.takeover.requestedBy,
    inspectorName: state.takeover.inspectorName,
  };
  const continuedBy = state.continuedBy.includes(nextEditor.inspectorName)
    ? [...state.continuedBy]
    : [...state.continuedBy, nextEditor.inspectorName];
  return copyState(state, {
    editor: nextEditor,
    takeover: null,
    continuedBy,
    lastHandoverAt: timestamp(at),
  });
}

function saveAnswer(state, { clientId, questionId, count } = {}) {
  requireEditor(state, clientId);
  if (!getQuestion(questionId)) throw new Error('Pregunta de inspección inválida.');
  if (!Number.isInteger(count) || count < 0 || count > 5) throw new Error('Los hallazgos deben ser un entero de 0 a 5.');
  const next = copyState(state);
  next.answers[questionId] = count;
  return next;
}

function saveFinding(state, { clientId, questionId, ordinal, finding } = {}) {
  requireEditor(state, clientId);
  const answer = state.answers[questionId];
  if (!getQuestion(questionId) || !Number.isInteger(answer) || answer < 1) throw new Error('Primero define los hallazgos de la pregunta.');
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > answer) throw new Error('El número de hallazgo no corresponde a la respuesta.');
  if (!finding || typeof finding.id !== 'string' || !finding.id.trim()) throw new Error('Falta identificar el hallazgo.');
  const next = copyState(state);
  const items = [...(next.findings[questionId] || [])];
  items[ordinal - 1] = { ...finding };
  next.findings[questionId] = items;
  return next;
}

function discardExtraFindings(state, { clientId, questionId } = {}) {
  requireEditor(state, clientId);
  const answer = state.answers[questionId];
  if (!getQuestion(questionId) || !Number.isInteger(answer) || answer < 0) throw new Error('Pregunta de inspección inválida.');
  const next = copyState(state);
  next.findings[questionId] = (next.findings[questionId] || []).slice(0, answer);
  return next;
}

function releaseInspection(state, { clientId, at } = {}) {
  requireEditor(state, clientId);
  return copyState(state, {
    editor: null,
    takeover: null,
    releasedAt: timestamp(at),
  });
}

function closeInspection(state, { clientId, at, completionStatus = 'cumplida' } = {}) {
  requireEditor(state, clientId);
  if (!completionStatuses.has(completionStatus)) throw new Error('Estado de cumplimiento inválido.');
  const inspectionValidation = validateInspection(state.answers, state.findings, inspectionQuestions(state));
  if (!inspectionValidation.canClose) {
    if (inspectionValidation.missingPhotos.length) throw new Error('Falta una fotografía sincronizada por cada hallazgo.');
    if (inspectionValidation.extraFindings.length) throw new Error('Confirma o elimina los hallazgos sobrantes antes de cerrar.');
    throw new Error('Faltan respuestas o hay valores inválidos antes del cierre.');
  }
  const kaizenValidation = validateKaizenReviews(state.pendingKaizen, state.kaizenReviews);
  if (!kaizenValidation.canContinue) throw new Error('Falta resolver o justificar todos los kaizen pendientes.');
  const scores = scoreInspection(state.answers);
  const closedAt = timestamp(at);
  return copyState(state, {
    status: 'closed',
    editor: null,
    takeover: null,
    closedAt,
    closedBy: state.editor.inspectorName,
    result: { ...scores, completionStatus, dailyManagement: dailyManagementResult(state) },
  });
}

function expireInspection(state, { at, closedBy = '', responsibleName = state.startedBy || '' } = {}) {
  if (!['new', 'open'].includes(state.status)) throw new Error('Solo una inspección abierta puede vencer.');
  const moduleScores = Object.fromEntries(MODULES.map(module => [module.id, 0]));
  return copyState(state, {
    status: 'expired',
    expiredEditor: state.editor ? { ...state.editor } : null,
    expiredByDeadline: true,
    responsibleName,
    editor: null,
    takeover: null,
    closedAt: timestamp(at),
    closedBy,
    result: {
      moduleScores,
      finalScore: 0,
      completionStatus: 'vencida-cerrada-incompleta',
    },
  });
}

const CHILE = 'America/Santiago';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_INSPECTION_SCHEDULE = Object.freeze({ days: DAYS.map((day, index) => Object.freeze({
  day, enabled: index < 4, start: '08:15', lastStart: index === 3 ? '12:00' : '17:00', end: '17:00',
})) });

function normalizeInspectionSchedule(value) {
  if (!value || !Array.isArray(value.days) || value.days.length !== 7) throw new Error('El horario debe contener siete días.');
  const days = value.days.map((item, index) => {
    if (!item || item.day !== DAYS[index] || typeof item.enabled !== 'boolean') throw new Error('Días del horario inválidos.');
    const minutes = field => {
      if (typeof item[field] !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item[field])) throw new Error('Hora de horario inválida.');
      return Number(item[field].slice(0, 2)) * 60 + Number(item[field].slice(3));
    };
    const start = minutes('start'), lastStart = minutes('lastStart'), end = minutes('end');
    if (!(start < lastStart && lastStart <= end)) throw new Error('Límites del horario inválidos.');
    return { day: item.day, enabled: item.enabled, start: item.start, lastStart: item.lastStart, end: item.end };
  });
  if (!days.some(day => day.enabled)) throw new Error('Se requiere al menos un día habilitado.');
  return { days };
}

function chileClock(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return {
    weekday: part('weekday'),
    seconds: Number(part('hour')) * 3600 + Number(part('minute')) * 60 + Number(part('second')),
  };
}

function isoWeekChile(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = type => Number(parts.find(item => item.type === type).value);
  const thursday = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - (firstThursday.getUTCDay() || 7));
  const isoWeek = 1 + Math.round((thursday - firstThursday) / 604800000);
  return { isoYear, isoWeek, key: `${isoYear}-W${String(isoWeek).padStart(2, '0')}` };
}

function inspectionWindow(date, started, schedule = DEFAULT_INSPECTION_SCHEDULE) {
  const { weekday, seconds } = chileClock(date);
  const day = schedule.days.find(item => item.day === weekday);
  if (!day?.enabled) return 'closed';
  const limit = time => (Number(time.slice(0, 2)) * 60 + Number(time.slice(3))) * 60;
  if (seconds < limit(day.start) || seconds >= limit(day.end)) return 'closed';
  return seconds < limit(day.lastStart) ? 'open' : started && day.lastStart !== day.end ? 'late-continuation' : 'closed';
}

function weeklyDeadlinePassed(date, schedule = DEFAULT_INSPECTION_SCHEDULE) {
  const { weekday, seconds } = chileClock(date);
  const last = [...schedule.days].reverse().find(day => day.enabled);
  const today = DAYS.indexOf(weekday), finalDay = DAYS.indexOf(last.day);
  return today > finalDay || today === finalDay && seconds >= (Number(last.end.slice(0, 2)) * 60 + Number(last.end.slice(3))) * 60;
}

function app5sCreateService(deps) {
  function operationTime(occurredAt) {
    if (occurredAt === undefined || occurredAt === null || occurredAt === '') return deps.now();
    const parsed = new Date(occurredAt);
    if (!Number.isFinite(parsed.getTime())) throw new Error('Fecha de operación inválida.');
    return parsed;
  }

  function current(stationId, occurredAt) {
    const now = operationTime(occurredAt);
    const week = isoWeekChile(now).key;
    let state = deps.load(stationId, week);
    if (!state) return createInspection({ stationId, week, pendingKaizen: deps.loadPendingKaizen(stationId) });
    if (occurredAt && state.status === 'expired' && state.expiredByDeadline && state.expiredEditor
      && state.expiredEditor.clientId && new Date(state.closedAt).getTime() > now.getTime()
      && inspectionWindow(now, Boolean(state.startedAt)) !== 'closed') {
      state = {
        ...state,
        status: 'open',
        editor: { ...state.expiredEditor },
        expiredEditor: null,
        expiredByDeadline: false,
        closedAt: '',
        result: null,
      };
      record('RECUPERA_CIERRE_SINCRONIZADO', state);
    }
    if (state.status === 'open' && weeklyDeadlinePassed(now)) {
      state = expireInspection(state, { at: now.toISOString() });
      record('VENCIMIENTO', state);
    }
    return state;
  }

  function record(type, state) {
    deps.save(state);
    deps.event(type, state);
    return state;
  }

  function writable(state, occurredAt) {
    if (inspectionWindow(operationTime(occurredAt), Boolean(state.startedAt)) === 'closed') {
      throw new Error('Horario de edición cerrado.');
    }
  }

  function requireStateEditor(state, clientId) {
    if (state.status === 'closed' || state.status === 'expired') throw new Error('La inspección ya está cerrada.');
    if (!state.editor || state.editor.clientId !== clientId) throw new Error('El teléfono no tiene la reserva activa de esta estación.');
  }

  return {
    getState(stationId, occurredAt) {
      return current(stationId, occurredAt);
    },
    reserve(stationId, clientId, inspectorName, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      if (state.status === 'closed' || state.status === 'expired') throw new Error('La inspección de esta semana ya está cerrada.');
      writable(state, at);
      return record('RESERVA', reserveInspection(state, { clientId, inspectorName, at: at.toISOString() }));
    },
    requestTakeover(stationId, clientId, inspectorName, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      return record('TOMA_SOLICITADA', requestTakeover(state, { clientId, inspectorName, at: at.toISOString() }));
    },
    acknowledgeTakeover(stationId, clientId, pendingSyncOps, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      const next = acknowledgeTakeover(state, { clientId, pendingSyncOps, at: at.toISOString() });
      return record(next.editor?.clientId === clientId ? 'PULSO' : 'TOMA_CONFIRMADA', next);
    },
    saveAnswer(stationId, clientId, questionId, count, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      return record('RESPUESTA', saveAnswer(state, { clientId, questionId, count }));
    },
    saveFinding(stationId, clientId, questionId, ordinal, finding, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      return record('HALLAZGO', saveFinding(state, { clientId, questionId, ordinal, finding }));
    },
    discardExtraFindings(stationId, clientId, questionId, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      return record('HALLAZGOS_DESCARTADOS', discardExtraFindings(state, { clientId, questionId }));
    },
    reviewKaizen(stationId, clientId, kaizenId, review, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      requireStateEditor(state, clientId);
      if (!state.pendingKaizen.some(item => item.id === kaizenId)) throw new Error('Kaizen pendiente inválido.');
      if (!review || !['solved', 'pending'].includes(review.decision)) throw new Error('Decisión de kaizen inválida.');
      const next = {
        ...state,
        kaizenReviews: { ...state.kaizenReviews, [kaizenId]: { ...review } },
      };
      return record('REVISION_KAIZEN', next);
    },
    release(stationId, clientId, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      return record('GUARDAR_Y_SALIR', releaseInspection(state, { clientId, at: at.toISOString() }));
    },
    close(stationId, clientId, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      const late = inspectionWindow(at, Boolean(state.startedAt)) === 'late-continuation';
      return record('CIERRE', closeInspection(state, {
        clientId,
        at: at.toISOString(),
        completionStatus: late ? 'cumplida-con-atraso' : 'cumplida',
      }));
    },
  };
}

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
  app5sMaterializeClosed_(state);
  app5sSyncProgress_(state);
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

const APP5S_PARENT_FOLDER = 'INSPECCIONES 5S';
const APP5S_BOOK = 'CONTROL INSPECCIONES 5S';
const APP5S_DEFAULT_FRONTEND_URL = 'https://deteco.github.io/inspecciones-5s-deteco/';
const APP5S_DEFAULT_FRONTEND_ORIGIN = 'https://deteco.github.io';
const APP5S_TABLES = {
  Configuracion: ['Estación ID', 'Estación', 'Tipo', 'Encargado del área', 'Activa', 'Latitud', 'Longitud', 'Radio m'],
  Administradores: ['Correo Google Workspace', 'Nombre', 'Activo', 'Puede liberar estaciones', 'Puede cambiar configuración', 'Notas'],
  Inspectores: ['Nombre', 'Nombre normalizado', 'Última inspección', 'Veces utilizado'],
  'Política de datos': ['Retención (años)', 'Confirmación antes de eliminar', 'Aplazamiento (días)', 'Última revisión', 'Aplazado hasta'],
  Accesos: ['Estación ID', 'Token QR', 'Activo'],
  Estado: ['Estación ID', 'Semana ISO', 'Estado', 'JSON de estado', 'Actualizado servidor'],
  Inspecciones: ['Inspección ID', 'Estación ID', 'Semana ISO', 'Estado', 'Responsable inicial', 'Cerrada por', 'Inicio', 'Cierre', 'Nota final', 'Estado de cumplimiento', 'Responsable incumplimiento'],
  'Puntajes modulo': ['Registro ID', 'Inspección ID', 'Estación ID', 'Semana ISO', 'Módulo', 'Puntaje', 'Estado de cumplimiento', 'Cierre'],
  Respuestas: ['Respuesta ID', 'Inspección ID', 'Estación ID', 'Semana ISO', 'Pregunta ID', 'Hallazgos', 'Puntos', 'Módulo'],
  Hallazgos: ['Hallazgo ID', 'Inspección ID', 'Estación ID', 'Semana ISO', 'Pregunta ID', 'Orden', 'Foto Drive ID', 'Nota', 'Kaizen ID', 'Estado'],
  Kaizen: ['Kaizen ID', 'Estación ID', 'Estado', 'Pregunta ID', 'Hallazgo origen ID', 'Recurrencia de', 'Responsable', 'Apertura', 'Cierre'],
  'Revision Kaizen': ['Revisión ID', 'Kaizen ID', 'Estación ID', 'Semana ISO', 'Decisión', 'Justificación', 'Foto solución Drive ID', 'Registrada'],
  Auditoria: ['Fecha servidor', 'Evento', 'Estación ID', 'Semana ISO', 'Estado', 'Responsable inicial', 'Editor', 'Correo administrador', 'Motivo'],
};

function app5sSeedStations_() {
  return STATIONS.map(station => [station.id, station.name, station.kind, '', true, '', '', 100]);
}

function app5sStationRegistry_() {
  const sheet = app5sSheet_('Configuracion');
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, APP5S_TABLES.Configuracion.length).getValues()
    .filter(row => row[0] && row[1])
    .map(row => ({
      id: String(row[0]).trim(),
      name: String(row[1]).trim(),
      kind: String(row[2] || 'obra').trim().toLowerCase(),
      owner: String(row[3] || '').trim(),
      active: app5sAdminEnabled_(row[4]),
    }));
}

function app5sStationById_(stationId, requireActive = true) {
  const matches = app5sStationRegistry_().filter(item => item.id === stationId && (!requireActive || item.active));
  if (matches.length !== 1) return null;
  return matches[0];
}

function app5sStationIdForWork_(name) {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) throw new Error('El nombre de la obra debe incluir letras o números.');
  return slug.startsWith('obra-') ? slug : `obra-${slug}`;
}

function app5sQrUrl_(stationId, token) {
  const base = String(PropertiesService.getScriptProperties().getProperty('APP5S_FRONTEND_URL') || '').trim();
  if (!base) return '';
  if (!/^https:\/\/[A-Za-z0-9.-]+\.github\.io(?:\/[A-Za-z0-9._~/-]*)?\/?$/.test(base)) return '';
  return `${base.replace(/\/?$/, '/')}#station=${encodeURIComponent(stationId)}&token=${encodeURIComponent(token)}`;
}

function app5sStationQrUrl_(stationId) {
  const sheet = app5sSheet_('Accesos');
  const last = sheet.getLastRow();
  if (last < 2) return '';
  const rows = sheet.getRange(2, 1, last - 1, 3).getValues()
    .filter(row => row[0] === stationId && app5sAdminEnabled_(row[2]));
  if (rows.length !== 1 || typeof rows[0][1] !== 'string') return '';
  return app5sQrUrl_(stationId, rows[0][1]);
}

function app5sMakeStationToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function app5sPublicState_(state) {
  return {
    stationId: state.stationId,
    week: state.week,
    status: state.status,
    startedAt: state.startedAt || '',
    startedBy: state.startedBy || '',
    editor: state.editor ? { clientId: state.editor.clientId, inspectorName: state.editor.inspectorName } : null,
    takeover: state.takeover ? { ...state.takeover } : null,
    continuedBy: [...(state.continuedBy || [])],
    answers: { ...(state.answers || {}) },
    dailyManagementApplicable: state.dailyManagementApplicable,
    findings: Object.fromEntries(Object.entries(state.findings || {}).map(([id, items]) => [id, items.map(item => ({ ...item, preview: undefined, dataUri: undefined }))])),
    pendingKaizen: (state.pendingKaizen || []).map(item => ({ ...item })),
    kaizenReviews: Object.fromEntries(Object.entries(state.kaizenReviews || {}).map(([id, review]) => [id, { ...review, preview: undefined, dataUri: undefined }])),
    result: state.result ? { ...state.result, moduleScores: { ...state.result.moduleScores } } : null,
    closedAt: state.closedAt || '',
    closedBy: state.closedBy || '',
    finalSessionId: state.finalSessionId || '',
    schedule: state.schedule || null,
  };
}

function app5sPhotoParts_(dataUri) {
  if (typeof dataUri !== 'string' || dataUri.length > 2000000) throw new Error('La foto debe ser JPG, PNG o WebP y pesar menos de 1,5 MB.');
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri);
  if (!match) throw new Error('La foto debe ser JPG, PNG o WebP y pesar menos de 1,5 MB.');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 1500000) throw new Error('La foto debe ser JPG, PNG o WebP y pesar menos de 1,5 MB.');
  return { mime: `image/${match[1]}`, extension: match[1] === 'jpeg' ? 'jpg' : match[1], bytes };
}

function instalarApp5SCompleta() {
  const props = PropertiesService.getScriptProperties();
  const activeEmail = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const effectiveEmail = Session.getEffectiveUser
    ? String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase()
    : activeEmail;
  const registeredOwner = String(props.getProperty('APP5S_OWNER_EMAIL') || '').trim().toLowerCase();
  if (!activeEmail || activeEmail !== effectiveEmail || (registeredOwner && activeEmail !== registeredOwner)) {
    throw new Error('La instalación debe ejecutarla el propietario desde el editor de Apps Script.');
  }
  const existingSheet = props.getProperty('APP5S_SHEET_ID');
  const existingFolder = props.getProperty('APP5S_FOLDER_ID');
  if (existingSheet && existingFolder) {
    const book = SpreadsheetApp.openById(existingSheet);
    const folder = DriveApp.getFolderById(existingFolder);
    if (!book || !folder) throw new Error('No se pudo abrir la hoja o carpeta configurada para 5S.');
    app5sVerifyPreparedBook_(book);
    app5sEnsureStationAccess_(book);
    const firstWeek = props.getProperty('APP5S_FIRST_WEEK') || isoWeekChile(app5sNow_()).key;
    const frontendUrl = props.getProperty('APP5S_FRONTEND_URL') || APP5S_DEFAULT_FRONTEND_URL;
    const frontendOrigin = props.getProperty('APP5S_FRONTEND_ORIGIN') || APP5S_DEFAULT_FRONTEND_ORIGIN;
    props.setProperties({
      APP5S_OWNER_EMAIL: activeEmail,
      APP5S_FIRST_WEEK: firstWeek,
      APP5S_FRONTEND_URL: frontendUrl,
      APP5S_FRONTEND_ORIGIN: frontendOrigin,
    });
    app5sProtectAdminDirectory_(book);
    return { installed: true, reused: true, sheetId: existingSheet, folderId: existingFolder };
  }
  if (existingSheet || existingFolder) throw new Error('La instalación quedó parcial; revísala antes de repetirla.');
  const parent = app5sOnlyFolder_(DriveApp.getRootFolder(), APP5S_PARENT_FOLDER, 'Debe existir una sola carpeta INSPECCIONES 5S en Mi unidad.');
  const existingBook = parent.getFilesByName(APP5S_BOOK);
  if (existingBook.hasNext()) throw new Error(`Ya existe un libro ${APP5S_BOOK} sin instalación registrada; revísalo antes de crear recursos.`);
  const book = SpreadsheetApp.create(APP5S_BOOK);
  app5sCreateTables_(book);
  DriveApp.getFileById(book.getId()).moveTo(parent);
  props.setProperties({
    APP5S_SHEET_ID: book.getId(),
    APP5S_FOLDER_ID: parent.getId(),
    APP5S_OWNER_EMAIL: String(Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || '').trim().toLowerCase(),
    APP5S_FIRST_WEEK: isoWeekChile(app5sNow_()).key,
    APP5S_FRONTEND_URL: props.getProperty('APP5S_FRONTEND_URL') || APP5S_DEFAULT_FRONTEND_URL,
    APP5S_FRONTEND_ORIGIN: props.getProperty('APP5S_FRONTEND_ORIGIN') || APP5S_DEFAULT_FRONTEND_ORIGIN,
  });
  return { installed: true, reused: false, sheetId: book.getId(), folderId: parent.getId() };
}

function app5sVerifyPreparedBook_(book) {
  Object.entries(APP5S_TABLES).forEach(([name, headers]) => {
    const sheet = book.getSheetByName(name);
    if (!sheet) throw new Error(`Falta la pestaña ${name}; no se modificó la hoja.`);
    const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0].map(value => String(value || '').trim());
    if (headers.some((header, index) => actual[index] !== header)) {
      throw new Error(`La estructura de ${name} no coincide con la app; no se modificó la hoja.`);
    }
  });
  STATIONS.forEach(station => {
    const sheet = book.getSheetByName(station.name);
    if (!sheet) throw new Error(`Falta la pestaña de estación ${station.name}; no se modificó la hoja.`);
    const expected = app5sStationHeaders_();
    const actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0].map(value => String(value || '').trim());
    if (expected.some((header, index) => actual[index] !== header)) {
      throw new Error(`La estructura de ${station.name} no coincide con la app; no se modificó la hoja.`);
    }
  });
  const config = book.getSheetByName('Configuracion');
  const rows = config.getLastRow() > 1 ? config.getRange(2, 1, config.getLastRow() - 1, 2).getValues() : [];
  STATIONS.forEach(station => {
    const matches = rows.filter(row => String(row[0]).trim() === station.id && String(row[1]).trim() === station.name);
    if (matches.length !== 1) throw new Error(`Configuracion debe contener una sola fila para ${station.name}; no se modificó la hoja.`);
  });
}

function app5sEnsureStationAccess_(book) {
  const sheet = book.getSheetByName('Accesos');
  const accessRows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues() : [];
  const validatedStations = STATIONS.map(station => {
    const stationRows = accessRows.map((row, index) => ({ row, index })).filter(item => String(item.row[0]).trim() === station.id);
    if (stationRows.length !== 1) throw new Error(`Accesos debe contener una sola fila para ${station.name}; no se generaron códigos QR.`);
    return { station, ...stationRows[0] };
  });
  validatedStations.forEach(({ row, index }) => {
    if (!String(row[1] || '').trim()) sheet.getRange(index + 2, 2).setValue(app5sMakeStationToken_());
    if (!app5sAdminEnabled_(row[2])) sheet.getRange(index + 2, 3).setValue(true);
  });
}

function app5sOnlyFolder_(parent, name, error) {
  const matches = parent.getFoldersByName(name);
  if (!matches.hasNext()) throw new Error(error);
  const folder = matches.next();
  if (matches.hasNext()) throw new Error(error);
  return folder;
}

function app5sCreateTables_(book) {
  const initial = book.getSheets()[0];
  initial.setName('Configuracion');
  Object.entries(APP5S_TABLES).forEach(([name, headers]) => {
    const sheet = name === 'Configuracion' ? initial : book.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  });
  STATIONS.forEach(station => {
    const sheet = book.insertSheet(station.name);
    sheet.getRange(1, 1, 1, app5sStationHeaders_().length).setValues([app5sStationHeaders_()]);
    sheet.setFrozenRows(1);
  });
  book.getSheetByName('Configuracion').getRange(2, 1, STATIONS.length, APP5S_TABLES.Configuracion.length).setValues(app5sSeedStations_());
  app5sFormatConfigurationSheet_(book.getSheetByName('Configuracion'));
  book.getSheetByName('Política de datos').getRange(2, 1, 1, APP5S_TABLES['Política de datos'].length).setValues([[1, true, 30, '', '']]);
  book.getSheetByName('Accesos').getRange(2, 1, STATIONS.length, APP5S_TABLES.Accesos.length).setValues(STATIONS.map(station => [station.id, app5sMakeStationToken_(), true]));
  app5sProtectAdminDirectory_(book);
}

function app5sFormatConfigurationSheet_(sheet) {
  const columns = APP5S_TABLES.Configuracion.length;
  const header = sheet.getRange(1, 1, 1, columns);
  header
    .setBackground('#F26522')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setWrap(true)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, columns, 150);
  sheet.setColumnWidth(1, 135);
  sheet.setColumnWidth(2, 210);
  sheet.setColumnWidth(4, 220);
  sheet.setColumnWidth(5, 90);
  sheet.setColumnWidths(6, 2, 115);
  sheet.setColumnWidth(8, 90);
  sheet.getRange(1, 1, 1, columns).setNotes([[
    'Identificador interno. No modificar; los QR y registros dependen de este valor.',
    'Nombre visible de la estación. No modificar después de iniciar operaciones sin una migración administrativa.',
    'Tipo de lugar: planta u obra. Cada obra se registra como una sola estación.',
    'Encargado responsable si una semana queda sin iniciar. Se puede completar más adelante.',
    'Casilla para habilitar o deshabilitar la estación. No borra su historial.',
    'Coordenada GPS opcional; se usará solo si la validación GPS se aprueba para producción.',
    'Coordenada GPS opcional; se usará solo si la validación GPS se aprueba para producción.',
    'Radio GPS en metros. Valor inicial 100; no activa por sí solo la validación GPS.'
  ]]);

  const rows = Math.max(sheet.getMaxRows() - 1, STATIONS.length);
  const activeValidation = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(2, 5, rows, 1).setDataValidation(activeValidation);
  const latitudeValidation = SpreadsheetApp.newDataValidation().requireNumberBetween(-90, 90).setAllowInvalid(false).build();
  const longitudeValidation = SpreadsheetApp.newDataValidation().requireNumberBetween(-180, 180).setAllowInvalid(false).build();
  const radiusValidation = SpreadsheetApp.newDataValidation().requireNumberBetween(1, 10000).setAllowInvalid(false).build();
  sheet.getRange(2, 6, rows, 1).setDataValidation(latitudeValidation);
  sheet.getRange(2, 7, rows, 1).setDataValidation(longitudeValidation);
  sheet.getRange(2, 8, rows, 1).setDataValidation(radiusValidation);
  const filterRange = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 2), columns);
  if (sheet.getFilter()) sheet.getFilter().setRange(filterRange);
  else filterRange.createFilter();
}

function app5sProtectAdminDirectory_(book) {
  const sheet = book.getSheetByName('Administradores');
  if (typeof sheet.protect !== 'function') return;
  const description = 'Solo el propietario puede administrar la lista de autorizaciones 5S.';
  const protections = typeof sheet.getProtections === 'function' && SpreadsheetApp.ProtectionType
    ? sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET)
    : [];
  const existing = protections.find(item => item.getDescription() === description);
  const protection = (existing || sheet.protect()).setDescription(description);
  protection.setWarningOnly(false);
  protection.removeEditors(protection.getEditors());
  protection.addEditor(Session.getEffectiveUser());
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
}

function app5sInspectorNames_() {
  const sheet = app5sSheet_('Inspectores');
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const seen = new Set();
  return sheet.getRange(2, 1, last - 1, APP5S_TABLES.Inspectores.length).getValues()
    .filter(row => row[0] && row[1])
    .sort((left, right) => new Date(right[2]).getTime() - new Date(left[2]).getTime())
    .map(row => row[0])
    .filter(name => {
      const key = app5sInspectorKey_(name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function app5sInspectorKey_(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function app5sRememberInspector_(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 80) throw new Error('El nombre del inspector debe tener entre 2 y 80 caracteres.');
  const normalized = app5sInspectorKey_(name);
  const sheet = app5sSheet_('Inspectores');
  const last = sheet.getLastRow();
  const rows = last > 1 ? sheet.getRange(2, 1, last - 1, APP5S_TABLES.Inspectores.length).getValues() : [];
  const index = rows.findIndex(row => app5sInspectorKey_(row[0]) === normalized);
  if (index >= 0) {
    const row = rows[index];
    const canonicalName = String(row[0] || name).trim();
    sheet.getRange(index + 2, 1, 1, APP5S_TABLES.Inspectores.length).setValues([[canonicalName, normalized, new Date().toISOString(), Number(row[3] || 0) + 1]]);
    return canonicalName;
  } else {
    sheet.appendRow([name, normalized, new Date().toISOString(), 1]);
  }
  return name;
}

function app5sStationHeaders_() {
  const headers = ['Semana ISO', 'Responsable inicial', 'Cerrada por', 'Inicio', 'Cierre'];
  QUESTIONS.forEach(question => headers.push(`${question.id} · Hallazgos`, `${question.id} · Puntos`));
  MODULES.forEach(module => headers.push(`Puntaje · ${module.title}`));
  headers.push('Nota final', 'Estado de cumplimiento');
  return headers;
}

function app5sBook_() {
  const id = PropertiesService.getScriptProperties().getProperty('APP5S_SHEET_ID');
  if (!id) throw new Error('La app 5S todavía no está instalada.');
  return SpreadsheetApp.openById(id);
}

function app5sSheet_(name) {
  const sheet = app5sBook_().getSheetByName(name);
  if (!sheet) throw new Error(`Falta la pestaña ${name}.`);
  return sheet;
}

function app5sLoadState_(stationId, week) {
  const sheet = app5sSheet_('Estado');
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const rows = sheet.getRange(2, 1, last - 1, 5).getValues();
  const row = rows.find(item => item[0] === stationId && item[1] === week);
  if (!row) return null;
  try {
    return JSON.parse(row[3]);
  } catch {
    throw new Error('El estado guardado de la inspección no se puede leer.');
  }
}

function app5sSaveState_(state) {
  const sheet = app5sSheet_('Estado');
  const values = [state.stationId, state.week, state.status, JSON.stringify(state), new Date().toISOString()];
  const last = sheet.getLastRow();
  if (last > 1) {
    const rows = sheet.getRange(2, 1, last - 1, 2).getValues();
    const index = rows.findIndex(item => item[0] === state.stationId && item[1] === state.week);
    if (index >= 0) {
      sheet.getRange(index + 2, 1, 1, values.length).setValues([values]);
      return;
    }
  }
  sheet.appendRow(values);
}

function app5sLoadPendingKaizen_(stationId) {
  const sheet = app5sSheet_('Kaizen');
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 9).getValues()
    .filter(row => row[1] === stationId && row[2] === 'open')
    .map(row => ({ id: row[0], stationId: row[1], status: row[2], questionId: row[3], ownerName: row[6] || 'Sin encargado asignado' }));
}

function app5sEvent_(type, state) {
  app5sSheet_('Auditoria').appendRow([new Date().toISOString(), type, state.stationId, state.week, state.status, state.startedBy || '', state.editor?.inspectorName || '', '', '']);
}

function app5sAdminSnapshot_(adminEmail, week) {
  const permissions = app5sAdminPermissions_(adminEmail);
  const book = app5sBook_();
  const rows = name => {
    const sheet = book.getSheetByName(name);
    if (!sheet) throw new Error(`Falta la pestaña ${name}.`);
    const last = sheet.getLastRow();
    return last > 1 ? sheet.getRange(2, 1, last - 1, APP5S_TABLES[name].length).getValues() : [];
  };
  const registry = rows('Configuracion').filter(row => row[0] && row[1]).map(row => ({
    id: String(row[0]).trim(), name: String(row[1]).trim(), kind: String(row[2] || 'obra').trim().toLowerCase(),
    owner: String(row[3] || '').trim(), active: app5sAdminEnabled_(row[4]),
  }));
  const stateByStation = new Map();
  rows('Estado').filter(row => row[1] === week).forEach(row => {
    if (stateByStation.has(row[0])) throw new Error('Hay estados duplicados para la semana.');
    try { stateByStation.set(row[0], JSON.parse(row[3])); }
    catch { throw new Error('El estado guardado de la inspección no se puede leer.'); }
  });
  const accessByStation = new Map();
  if (permissions.canConfigure) rows('Accesos').forEach(row => {
    if (!accessByStation.has(row[0])) accessByStation.set(row[0], []);
    accessByStation.get(row[0]).push(row);
  });
  return {
    adminEmail,
    week,
    permissions,
    stations: registry.filter(station => station.active).map(station => {
      const stored = stateByStation.get(station.id);
      const lease = typeof app5sFinalLease_ === 'function' ? app5sFinalLease_(station.id, week) : null;
      const state = lease && !['closed', 'expired'].includes(stored?.status)
        ? { status: 'open', startedBy: lease.inspectorName, startedAt: lease.startedAt, editor: { clientId: lease.clientId, inspectorName: lease.inspectorName } } : stored;
      return {
        stationId: station.id,
        stationName: station.name,
        owner: station.owner,
        week,
        status: state?.status || 'new',
        startedBy: state?.startedBy || '',
        startedAt: state?.startedAt || '',
        editorName: state?.editor?.inspectorName || '',
        editorId: state?.editor?.clientId || '',
        qrUrl: permissions.canConfigure && accessByStation.get(station.id)?.length === 1
          && app5sAdminEnabled_(accessByStation.get(station.id)[0][2])
          && typeof accessByStation.get(station.id)[0][1] === 'string'
          ? app5sQrUrl_(station.id, accessByStation.get(station.id)[0][1]) : '',
      };
    }),
  };
}

function app5sAdminState() {
  const adminEmail = app5sRequireAdminEmail_('view');
  return app5sWithLock_(() => app5sAdminSnapshot_(adminEmail, isoWeekChile(app5sNow_()).key));
}

function app5sAdminKaizenState(filters) {
  const adminEmail = app5sRequireAdminEmail_('view');
  const input = filters && typeof filters === 'object' ? filters : {};
  const stationId = String(input.stationId || 'all');
  const status = String(input.status || 'open');
  if (stationId !== 'all') app5sValidStation_(stationId);
  if (!['all', 'open', 'closed'].includes(status)) throw new Error('Filtro de estado inválido.');

  const registry = app5sStationRegistry_();
  const names = new Map(registry.map(item => [item.id, item.name]));
  const questions = new Map([...QUESTIONS, ...DAILY_MANAGEMENT.questions].map(question => [question.id, question]));
  const moduleTitles = new Map([...MODULES, DAILY_MANAGEMENT].map(module => [module.id, module.title]));
  const kaizenSheet = app5sSheet_('Kaizen');
  const findingSheet = app5sSheet_('Hallazgos');
  const reviewSheet = app5sSheet_('Revision Kaizen');
  const rows = kaizenSheet.getLastRow() > 1
    ? kaizenSheet.getRange(2, 1, kaizenSheet.getLastRow() - 1, APP5S_TABLES.Kaizen.length).getValues()
    : [];
  const findings = findingSheet.getLastRow() > 1
    ? findingSheet.getRange(2, 1, findingSheet.getLastRow() - 1, APP5S_TABLES.Hallazgos.length).getValues()
    : [];
  const reviews = reviewSheet.getLastRow() > 1
    ? reviewSheet.getRange(2, 1, reviewSheet.getLastRow() - 1, APP5S_TABLES['Revision Kaizen'].length).getValues()
    : [];

  const matches = rows.filter(row => row[0] && names.has(String(row[1])) &&
    (stationId === 'all' || String(row[1]) === stationId) &&
    (status === 'all' || String(row[2]) === status));
  matches.sort((a, b) => String(b[7] || '').localeCompare(String(a[7] || '')));
  const truncated = matches.length > 500;
  const items = matches.slice(0, 500).map(row => {
    const id = String(row[0]);
    const question = questions.get(String(row[3]));
    return {
      id,
      stationId: String(row[1]),
      stationName: names.get(String(row[1])) || String(row[1]),
      status: String(row[2] || 'open'),
      questionId: String(row[3] || ''),
      questionText: question?.text || 'Pregunta no disponible',
      moduleTitle: question ? moduleTitles.get(question.moduleId) || '' : '',
      ownerName: String(row[6] || 'Sin encargado asignado'),
      openedAt: row[7] instanceof Date ? row[7].toISOString() : String(row[7] || ''),
      closedAt: row[8] instanceof Date ? row[8].toISOString() : String(row[8] || ''),
      findings: findings.filter(item => String(item[8]) === id).map(item => ({
        id: String(item[0]), evidenceId: String(item[0]), hasPhoto: Boolean(item[6]), week: String(item[3] || ''), note: String(item[7] || ''),
      })).sort((a, b) => a.week.localeCompare(b.week) || a.id.localeCompare(b.id)),
      reviews: reviews.filter(item => String(item[1]) === id).map(item => ({
        evidenceId: String(item[0]), hasPhoto: Boolean(item[6]), week: String(item[3] || ''), decision: String(item[4] || ''), reason: String(item[5] || ''),
        registeredAt: item[7] instanceof Date ? item[7].toISOString() : String(item[7] || ''),
      })).sort((a, b) => b.week.localeCompare(a.week)),
    };
  });
  return {
    adminEmail,
    stationId,
    status,
    truncated,
    stations: registry.filter(item => item.active).map(item => ({ id: item.id, name: item.name })),
    items,
  };
}

function app5sAdminKaizenPhoto(payload) {
  app5sRequireAdminEmail_('view');
  if (!payload || typeof payload !== 'object' || typeof payload.kaizenId !== 'string' ||
      !/^[A-Za-z0-9_-]{8,160}$/.test(payload.kaizenId) || typeof payload.evidenceId !== 'string' ||
      !/^[A-Za-z0-9_-]{8,160}(?::[0-9]{4}-W[0-9]{2})?$/.test(payload.evidenceId)) throw new Error('Solicitud de fotografía inválida.');
  const kaizenId = payload.kaizenId;
  const evidenceId = payload.evidenceId;
  const findingSheet = app5sSheet_('Hallazgos');
  const reviewSheet = app5sSheet_('Revision Kaizen');
  const findEvidence = (sheet, columnCount, evidenceColumn, kaizenColumn, photoColumn) => {
    if (sheet.getLastRow() < 2) return null;
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, columnCount).getValues()
      .find(row => String(row[evidenceColumn]) === evidenceId && String(row[kaizenColumn]) === kaizenId) || null;
  };
  const finding = findEvidence(findingSheet, APP5S_TABLES.Hallazgos.length, 0, 8, 6);
  const review = finding ? null : findEvidence(reviewSheet, APP5S_TABLES['Revision Kaizen'].length, 0, 1, 6);
  const evidence = finding || review;
  if (!evidence) throw new Error('Esta evidencia no pertenece a este Kaizen.');
  const photoId = String(evidence[6] || '');
  if (!photoId) throw new Error('La fotografía ya no está disponible.');
  try {
    const file = DriveApp.getFileById(photoId);
    if (!app5sFileInsideInspectionFolder_(file)) throw new Error('outside-root');
    const blob = file.getBlob();
    const mime = String(blob.getContentType() || '').toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('invalid-mime');
    const bytes = blob.getBytes();
    if (!bytes || bytes.length > 1572864) throw new Error('invalid-size');
    return `data:${mime};base64,${Utilities.base64Encode(bytes)}`;
  } catch (error) {
    if (error.message === 'outside-root') throw new Error('La fotografía no pertenece a la carpeta 5S.');
    if (error.message === 'invalid-mime') throw new Error('El archivo no es una fotografía compatible.');
    if (error.message === 'invalid-size') throw new Error('La fotografía supera el tamaño permitido para visualizarla.');
    console.error(`No se pudo cargar evidencia Kaizen ${evidenceId}: ${error.message}`);
    throw new Error('La fotografía ya no está disponible.');
  }
}

function app5sFileInsideInspectionFolder_(file) {
  const rootId = String(PropertiesService.getScriptProperties().getProperty('APP5S_FOLDER_ID') || '');
  if (!rootId || !file || typeof file.getParents !== 'function') return false;
  const queue = [];
  const visited = new Set();
  try {
    const directParents = file.getParents();
    while (directParents.hasNext()) queue.push(directParents.next());
    while (queue.length && visited.size < 32) {
      const folder = queue.shift();
      const folderId = String(folder.getId());
      if (folderId === rootId) return true;
      if (visited.has(folderId)) continue;
      visited.add(folderId);
      const parents = folder.getParents();
      while (parents.hasNext()) queue.push(parents.next());
    }
  } catch (error) {
    console.error(`No se pudo comprobar la carpeta de evidencia: ${error.message}`);
    return false;
  }
  return false;
}

function app5sAdminRelease(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Solicitud de liberación inválida.');
  app5sRequireAdminEmail_('release');
  const stationId = app5sValidStation_(payload.stationId);
  const currentWeek = isoWeekChile(app5sNow_()).key;
  if (payload.week !== currentWeek) throw new Error('La semana cambió. Actualiza el panel antes de liberar.');
  if (payload.confirmed !== true) throw new Error('Confirma la advertencia antes de liberar la estación.');
  const expectedEditorId = app5sValidClient_(payload.expectedEditorId);
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (reason.length > 500) throw new Error('El motivo no puede superar 500 caracteres.');

  return app5sWithLock_(() => {
    const adminEmail = app5sRequireAdminEmail_('release');
    const week = isoWeekChile(app5sNow_()).key;
    if (payload.week !== week) throw new Error('La semana cambió. Actualiza el panel antes de liberar.');
    const state = app5sLoadState_(stationId, week);
    const lease = typeof app5sFinalLease_ === 'function' ? app5sFinalLease_(stationId, week) : null;
    if (lease && !['closed', 'expired'].includes(state?.status)) {
      if (lease.clientId !== expectedEditorId) throw new Error('La reserva cambió desde que abriste el panel. Actualiza antes de liberar.');
      app5sFinalRelease_(stationId, week);
      if (!state?.editor) return app5sAdminSnapshot_(adminEmail, week);
    }
    if (!state || state.status !== 'open' || !state.editor) throw new Error('La estación ya no tiene una reserva activa para liberar.');
    if (state.editor.clientId !== expectedEditorId) throw new Error('La reserva cambió desde que abriste el panel. Actualiza antes de liberar.');

    const releasedEditor = state.editor.inspectorName || '';
    state.adminRevokedClientIds = [...new Set([...(state.adminRevokedClientIds || []), state.editor.clientId])];
    state.editor = null;
    state.takeover = null;
    state.adminReleasedAt = app5sNow_().toISOString();
    state.adminReleasedBy = adminEmail;
    state.adminReleaseReason = reason;
    app5sSaveState_(state);
    app5sSheet_('Auditoria').appendRow([
      state.adminReleasedAt,
      'ADMIN_LIBERA_ESTACION',
      stationId,
      week,
      state.status,
      app5sAdminSafeCell_(state.startedBy || ''),
      app5sAdminSafeCell_(releasedEditor),
      adminEmail,
      app5sAdminSafeCell_(reason),
    ]);
    app5sSyncProgress_(state);
    return app5sAdminSnapshot_(adminEmail, week);
  });
}

function app5sAdminAddWork(payload) {
  app5sRequireAdminEmail_('configure');
  if (!payload || typeof payload !== 'object') throw new Error('Datos de la obra inválidos.');
  const rawName = typeof payload.name === 'string' ? payload.name.trim().replace(/\s+/g, ' ') : '';
  if (rawName.length < 2 || rawName.length > 60) throw new Error('El nombre de la obra debe tener entre 2 y 60 caracteres.');
  if (/[\[\]:*?\\/]/.test(rawName) || /^'+$/.test(rawName)) throw new Error('El nombre contiene caracteres que Google Sheets no admite.');
  const stationName = rawName.toLocaleUpperCase('es-CL');
  if (/^[=+\-@]/.test(stationName)) throw new Error('El nombre de la obra no puede comenzar con un símbolo.');
  const stationId = app5sStationIdForWork_(stationName);
  const normalizedName = stationName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');

  return app5sWithLock_(() => {
    const adminEmail = app5sRequireAdminEmail_('configure');
    const registry = app5sStationRegistry_();
    if (registry.some(item => item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ') === normalizedName)) {
      throw new Error('Ya existe una estación con ese nombre. No se creó un duplicado.');
    }
    if (registry.some(item => item.id === stationId)) throw new Error('El identificador de esta obra ya existe. Revísalo antes de continuar.');
    const book = app5sBook_();
    if (book.getSheets().some(sheet => sheet.getName().toLowerCase() === stationName.toLowerCase())) {
      throw new Error('Ya existe una pestaña con ese nombre. Revísala antes de agregar la obra.');
    }

    const token = app5sMakeStationToken_();
    const configSheet = app5sSheet_('Configuracion');
    const accessSheet = app5sSheet_('Accesos');
    let stationSheet = null;
    let configRow = 0;
    let accessRow = 0;
    try {
      stationSheet = book.insertSheet(stationName);
      stationSheet.getRange(1, 1, 1, app5sStationHeaders_().length).setValues([app5sStationHeaders_()]);
      stationSheet.setFrozenRows(1);
      configSheet.appendRow([stationId, stationName, 'obra', '', false, '', '', 100]);
      configRow = configSheet.getLastRow();
      accessSheet.appendRow([stationId, token, false]);
      accessRow = accessSheet.getLastRow();
      app5sFormatConfigurationSheet_(configSheet);
      app5sSheet_('Auditoria').appendRow([
        app5sNow_().toISOString(), 'ADMIN_CREA_ESTACION', stationId,
        isoWeekChile(app5sNow_()).key, 'preparando', stationName, '', adminEmail, 'Alta de obra desde panel',
      ]);
      accessSheet.getRange(accessRow, 3).setValue(true);
      configSheet.getRange(configRow, 5).setValue(true);
    } catch (error) {
      throw new Error(`No se pudo completar el alta de ${stationName}. La estación quedó deshabilitada si alcanzó a crearse; solicita revisión al propietario antes de volver a intentarlo. Detalle: ${String(error.message || error).slice(0, 180)}`);
    }

    const snapshot = app5sAdminSnapshot_(adminEmail, isoWeekChile(app5sNow_()).key);
    return {
      stationId,
      stationName,
      qrUrl: app5sQrUrl_(stationId, token),
      snapshot,
    };
  });
}

function app5sNow_() {
  return new Date();
}

function app5sService_() {
  return app5sCreateService({
    now: app5sNow_,
    load: app5sLoadState_,
    save: app5sSaveState_,
    loadPendingKaizen: app5sLoadPendingKaizen_,
    event: app5sEvent_,
  });
}

function app5sSubfolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (!folders.hasNext()) return parent.createFolder(name);
  const folder = folders.next();
  if (folders.hasNext()) throw new Error(`Hay más de una carpeta ${name}; revísala antes de guardar fotos.`);
  return folder;
}

function app5sMonth_(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}`;
}

function app5sSavePhoto_(state, dataUri, id, category) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,160}$/.test(id)) throw new Error('Identificador de foto inválido.');
  const parts = app5sPhotoParts_(dataUri);
  const root = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('APP5S_FOLDER_ID'));
  const station = app5sStationById_(state.stationId, true);
  if (!station) throw new Error('Estación inválida.');
  const folderName = station.id === 'obra-santa-julia' ? 'SANTA JULIA' : station.name;
  const stationFolder = app5sSubfolder_(root, folderName);
  const monthFolder = app5sSubfolder_(stationFolder, app5sMonth_(new Date(state.startedAt || new Date())));
  const weekFolder = app5sSubfolder_(monthFolder, state.week);
  const categoryFolder = app5sSubfolder_(weekFolder, category);
  const filename = `${id}.${parts.extension}`;
  const existing = categoryFolder.getFilesByName(filename);
  if (existing.hasNext()) return existing.next().getId();
  return categoryFolder.createFile(Utilities.newBlob(parts.bytes, parts.mime, filename)).getId();
}

function app5sStoredFinding_(state, finding) {
  if (!finding || typeof finding !== 'object' || typeof finding.id !== 'string') throw new Error('Falta identificar el hallazgo.');
  return {
    id: finding.id,
    photoId: app5sSavePhoto_(state, finding.dataUri, finding.id, 'Hallazgos'),
    note: typeof finding.note === 'string' ? finding.note.trim().slice(0, 500) : '',
    kaizenId: typeof finding.kaizenId === 'string' ? finding.kaizenId : '',
  };
}

function app5sStoredKaizenReview_(state, review, kaizenId) {
  if (!review || !['solved', 'pending'].includes(review.decision)) throw new Error('Decisión de kaizen inválida.');
  if (review.decision === 'solved') {
    return { decision: 'solved', photoId: app5sSavePhoto_(state, review.dataUri, `kaizen-${kaizenId}-${state.week}`, 'Cierres kaizen') };
  }
  return { decision: 'pending', reason: typeof review.reason === 'string' ? review.reason.trim().slice(0, 500) : '' };
}

function app5sValidStation_(stationId) {
  if (typeof stationId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stationId) || !app5sStationById_(stationId, true)) {
    throw new Error('Estación inválida o deshabilitada.');
  }
  return stationId;
}

function app5sAdminEnabled_(value) {
  if (value === true) return true;
  return ['TRUE', '1', 'SI', 'SÍ', 'YES'].includes(String(value || '').trim().toUpperCase());
}

function app5sAdminPermissions_(email) {
  const ownerEmail = String(PropertiesService.getScriptProperties().getProperty('APP5S_OWNER_EMAIL') || '').trim().toLowerCase();
  if (ownerEmail && email === ownerEmail) return { canView: true, canRelease: true, canConfigure: true };
  const sheet = app5sSheet_('Administradores');
  const last = sheet.getLastRow();
  const rows = last > 1 ? sheet.getRange(2, 1, last - 1, APP5S_TABLES.Administradores.length).getValues() : [];
  const row = rows.find(item => String(item[0] || '').trim().toLowerCase() === email && app5sAdminEnabled_(item[2]));
  return row ? { canView: true, canRelease: app5sAdminEnabled_(row[3]), canConfigure: app5sAdminEnabled_(row[4]) } : { canView: false, canRelease: false, canConfigure: false };
}

function app5sRequireAdminEmail_(permission = 'release') {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Inicia sesión con tu cuenta Google Workspace autorizada.');
  }
  const ownerEmail = String(PropertiesService.getScriptProperties().getProperty('APP5S_OWNER_EMAIL') || '').trim().toLowerCase();
  if (ownerEmail && email === ownerEmail) return email;
  const workspaceDomain = ownerEmail.split('@')[1] || '';
  if (workspaceDomain && !email.endsWith(`@${workspaceDomain}`)) {
    throw new Error('Usa una cuenta Google del dominio corporativo.');
  }
  const permissions = app5sAdminPermissions_(email);
  const allowed = permission === 'any' || permission === 'view'
    ? permissions.canView || permissions.canRelease || permissions.canConfigure
    : permission === 'configure' ? permissions.canConfigure : permissions.canRelease;
  if (!allowed) {
    throw new Error(permission === 'configure'
      ? 'Tu cuenta no tiene permiso para cambiar la configuración.'
      : permission === 'view' ? 'Tu cuenta no tiene acceso de lectura al panel.'
        : permission === 'any' ? 'Tu cuenta no tiene permisos habilitados para este panel.' : 'Tu cuenta no tiene permiso para liberar estaciones.');
  }
  return email;
}

function app5sAdminSafeCell_(value) {
  const text = String(value || '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function app5sValidClient_(clientId) {
  if (typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{3,160}$/.test(clientId)) throw new Error('Identificador de teléfono inválido.');
  return clientId;
}

function app5sRequireEditor_(state, clientId) {
  if (state.status === 'closed' || state.status === 'expired') throw new Error('La inspección ya está cerrada.');
  if (!state.editor || state.editor.clientId !== clientId) throw new Error('El teléfono no tiene la reserva activa de esta estación.');
}

function app5sVerifyAccess_(stationId, accessToken) {
  if (typeof accessToken !== 'string' || !/^[A-Za-z0-9_-]{24,160}$/.test(accessToken)) throw new Error('Acceso QR inválido.');
  const sheet = app5sSheet_('Accesos');
  const last = sheet.getLastRow();
  if (last < 2) throw new Error('No hay accesos QR configurados.');
  const row = sheet.getRange(2, 1, last - 1, 3).getValues().find(item => item[0] === stationId && item[1] === accessToken && item[2] === true);
  if (!row) throw new Error('Acceso QR inválido.');
}

function app5sWithLock_(action) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const result = action();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

function app5sHandle_(operation, payload, meta) {
  const stationId = app5sValidStation_(payload.stationId);
  app5sVerifyAccess_(stationId, payload.accessToken);
  return app5sWithLock_(() => {
    if (['begin-final', 'upload-final-photo', 'submit-final', 'final-state'].includes(operation)) return app5sFinalHandle_(operation, payload, stationId, meta);
    // Los clientes antiguos no conocen la política configurable ni el cierre completo.
    if (PropertiesService.getScriptProperties().getProperty('APP5S_INSPECTION_SCHEDULE')) throw new Error('Actualiza la app para usar los horarios configurados y el guardado completo al cerrar.');
    if (typeof app5sFinalLease_ === 'function' && operation !== 'state' && app5sFinalLease_(stationId, isoWeekChile(app5sNow_()).key)) throw new Error('Actualiza la app para usar el guardado completo al cerrar.');
    const service = app5sService_();
    let state;
    let previousWeekAlert = null;
    switch (operation) {
      case 'state':
        state = service.getState(stationId);
        break;
      case 'reserve':
        state = service.reserve(stationId, app5sValidClient_(payload.clientId), payload.inspectorName, payload.occurredAt);
        app5sRememberInspector_(state.editor.inspectorName);
        previousWeekAlert = app5sFinalizePreviousWeek_(stationId, payload.occurredAt ? new Date(payload.occurredAt) : app5sNow_(), state.editor.inspectorName);
        break;
      case 'request-takeover':
        state = service.requestTakeover(stationId, app5sValidClient_(payload.clientId), payload.inspectorName, payload.occurredAt);
        break;
      case 'acknowledge-takeover':
        state = service.acknowledgeTakeover(stationId, app5sValidClient_(payload.clientId), payload.pendingSyncOps, payload.occurredAt);
        if (state.editor?.clientId === payload.clientId) app5sRememberInspector_(state.editor.inspectorName);
        break;
      case 'save-answer':
        state = service.saveAnswer(stationId, app5sValidClient_(payload.clientId), payload.questionId, payload.count, payload.occurredAt);
        break;
      case 'save-finding':
        {
          const clientId = app5sValidClient_(payload.clientId);
          const currentState = service.getState(stationId, payload.occurredAt);
          app5sRequireEditor_(currentState, clientId);
          state = service.saveFinding(stationId, clientId, payload.questionId, payload.ordinal, app5sStoredFinding_(currentState, payload.finding), payload.occurredAt);
        }
        break;
      case 'discard-extra-findings':
        state = service.discardExtraFindings(stationId, app5sValidClient_(payload.clientId), payload.questionId, payload.occurredAt);
        break;
      case 'review-kaizen':
        {
          const clientId = app5sValidClient_(payload.clientId);
          const currentState = service.getState(stationId, payload.occurredAt);
          app5sRequireEditor_(currentState, clientId);
          state = service.reviewKaizen(stationId, clientId, payload.kaizenId, app5sStoredKaizenReview_(currentState, payload.review, payload.kaizenId), payload.occurredAt);
        }
        break;
      case 'release':
        state = service.release(stationId, app5sValidClient_(payload.clientId), payload.occurredAt);
        break;
      case 'close':
        state = service.close(stationId, app5sValidClient_(payload.clientId), payload.occurredAt);
        app5sMaterializeClosed_(state);
        break;
      default:
        throw new Error('Operación inválida.');
    }
    if (operation !== 'state' || state.status === 'expired') app5sSyncProgress_(state);
    const station = app5sStationById_(stationId, true);
    return {
      state: app5sPublicState_(state),
      station: station ? { id: station.id, name: station.name, kind: station.kind } : null,
      inspectorNames: app5sInspectorNames_(),
      previousWeekAlert,
      requestId: meta.requestId,
      receivedAt: meta.receivedAt,
    };
  });
}

function app5sUpsert_(sheetName, keyColumn, key, values) {
  const sheet = app5sSheet_(sheetName);
  const last = sheet.getLastRow();
  if (last > 1) {
    const valuesInColumn = sheet.getRange(2, keyColumn, last - 1, 1).getValues();
    const index = valuesInColumn.findIndex(row => row[0] === key);
    if (index >= 0) {
      sheet.getRange(index + 2, 1, 1, values.length).setValues([values]);
      return;
    }
  }
  sheet.appendRow(values);
}

function app5sStationOwner_(stationId) {
  const sheet = app5sSheet_('Configuracion');
  const last = sheet.getLastRow();
  if (last < 2) return 'Sin encargado asignado';
  const row = sheet.getRange(2, 1, last - 1, 4).getValues().find(item => item[0] === stationId);
  return row && String(row[3] || '').trim() || 'Sin encargado asignado';
}

function app5sKaizenRow_(kaizenId) {
  const sheet = app5sSheet_('Kaizen');
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const rows = sheet.getRange(2, 1, last - 1, APP5S_TABLES.Kaizen.length).getValues();
  return rows.find(row => row[0] === kaizenId) || null;
}

function app5sMaterializeKaizen_(state, questionId, finding) {
  const isNew = !finding.kaizenId;
  const kaizenId = finding.kaizenId || `K-${finding.id}`;
  finding.kaizenId = kaizenId;
  if (!isNew && app5sKaizenRow_(kaizenId)) return;
  app5sUpsert_('Kaizen', 1, kaizenId, [
    kaizenId,
    state.stationId,
    'open',
    questionId,
    finding.id,
    finding.recurrenceOf || '',
    app5sStationOwner_(state.stationId),
    state.closedAt,
    '',
  ]);
}

function app5sMaterializeKaizenReviews_(state) {
  (state.pendingKaizen || []).forEach(kaizen => {
    const review = state.kaizenReviews?.[kaizen.id];
    if (!review) return;
    const existing = app5sKaizenRow_(kaizen.id);
    if (existing && review.decision === 'solved') {
      app5sUpsert_('Kaizen', 1, kaizen.id, [...existing.slice(0, 2), 'closed', ...existing.slice(3, 8), state.closedAt]);
    }
    const reviewId = `${kaizen.id}:${state.week}`;
    app5sUpsert_('Revision Kaizen', 1, reviewId, [reviewId, kaizen.id, state.stationId, state.week, review.decision, review.reason || '', review.photoId || '', state.closedAt]);
  });
}

function app5sMaterializeClosed_(state) {
  const inspectionId = `${state.stationId}:${state.week}`;
  app5sUpsert_('Inspecciones', 1, inspectionId, [inspectionId, state.stationId, state.week, state.status, state.startedBy, state.closedBy, state.startedAt, state.closedAt, state.result.finalScore, state.result.completionStatus, state.responsibleName || '']);
  inspectionQuestions(state).forEach(question => {
    const responseId = `${inspectionId}:${question.id}`;
    const count = state.answers[question.id];
    app5sUpsert_('Respuestas', 1, responseId, [responseId, inspectionId, state.stationId, state.week, question.id, count, 5 - count, question.moduleId]);
    (state.findings[question.id] || []).forEach((finding, index) => {
      app5sMaterializeKaizen_(state, question.id, finding);
      const findingId = finding.id;
      app5sUpsert_('Hallazgos', 1, findingId, [findingId, inspectionId, state.stationId, state.week, question.id, index + 1, finding.photoId || '', finding.note || '', finding.kaizenId || '', 'Activo']);
    });
  });
  app5sMaterializeKaizenReviews_(state);
  app5sSaveState_(state);
}

function app5sSyncProgress_(state) {
  const inspectionId = `${state.stationId}:${state.week}`;
  const activeFindingIds = new Set();
  inspectionQuestions(state).forEach(question => {
    const count = state.answers[question.id];
    if (Number.isInteger(count)) {
      const responseId = `${inspectionId}:${question.id}`;
      app5sUpsert_('Respuestas', 1, responseId, [responseId, inspectionId, state.stationId, state.week, question.id, count, 5 - count, question.moduleId]);
    }
    (state.findings[question.id] || []).forEach((finding, index) => {
      if (!finding?.id) return;
      activeFindingIds.add(finding.id);
      app5sUpsert_('Hallazgos', 1, finding.id, [finding.id, inspectionId, state.stationId, state.week, question.id, index + 1, finding.photoId || '', finding.note || '', finding.kaizenId || '', 'Activo']);
    });
  });

  const findingsSheet = app5sSheet_('Hallazgos');
  if (findingsSheet.getLastRow() > 1) {
    const rows = findingsSheet.getRange(2, 1, findingsSheet.getLastRow() - 1, APP5S_TABLES.Hallazgos.length).getValues();
    rows.forEach((row, index) => {
      if (row[2] === state.stationId && row[3] === state.week && !activeFindingIds.has(row[0]) && row[9] !== 'Descartado') {
        findingsSheet.getRange(index + 2, 10, 1, 1).setValues([['Descartado']]);
      }
    });
  }

  const moduleScores = MODULES.map(module => {
    if (state.result) return state.result.moduleScores[module.id];
    if (!module.questions.every(question => Number.isInteger(state.answers[question.id]))) return '';
    return module.questions.reduce((total, question) => total + (5 - state.answers[question.id]), 0) / module.questions.length;
  });
  const completedScores = moduleScores.every(value => Number.isFinite(value));
  const finalScore = state.result?.finalScore ?? (completedScores ? moduleScores.reduce((total, score) => total + score, 0) / moduleScores.length : '');
  const values = [state.week, state.startedBy || '', state.closedBy || '', state.startedAt || '', state.closedAt || ''];
  QUESTIONS.forEach(question => {
    const count = state.answers[question.id];
    values.push(Number.isInteger(count) ? count : '', Number.isInteger(count) ? 5 - count : '');
  });
  values.push(...moduleScores, finalScore, state.result?.completionStatus || state.status);
  const station = app5sStationById_(state.stationId, true);
  if (!station) throw new Error('Estación inválida.');
  app5sUpsert_(station.name, 1, state.week, values);
  if (state.status === 'expired' || state.status === 'closed') {
    const inspectionId = `${state.stationId}:${state.week}`;
    app5sUpsert_('Inspecciones', 1, inspectionId, [inspectionId, state.stationId, state.week, state.status, state.startedBy || '', state.closedBy || '', state.startedAt || '', state.closedAt || '', state.result?.finalScore ?? 0, state.result?.completionStatus || '', state.responsibleName || '']);
    MODULES.forEach((module, index) => {
      const recordId = `${inspectionId}:${module.id}`;
      app5sUpsert_('Puntajes modulo', 1, recordId, [
        recordId, inspectionId, state.stationId, state.week, module.title,
        moduleScores[index], state.result?.completionStatus || state.status, state.closedAt || '',
      ]);
    });
    const gd = state.result?.dailyManagement;
    if (gd && gd.applicable !== null) {
      const recordId = `${inspectionId}:${DAILY_MANAGEMENT.id}`;
      app5sUpsert_('Puntajes modulo', 1, recordId, [
        recordId, inspectionId, state.stationId, state.week, DAILY_MANAGEMENT.title,
        gd.applicable ? gd.score : '', gd.applicable ? state.result.completionStatus : 'No aplica', state.closedAt || '',
      ]);
    }
  }
}

function app5sPreviousWeek_(date) {
  return isoWeekChile(new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000)).key;
}

function app5sFinalizePreviousWeek_(stationId, currentDate, nextInspectorName) {
  const week = app5sPreviousWeek_(currentDate);
  const firstWeek = PropertiesService.getScriptProperties().getProperty('APP5S_FIRST_WEEK') || '';
  if (!firstWeek || week < firstWeek) return null;
  let previous = app5sLoadState_(stationId, week);
  if (previous?.status === 'closed') return null;
  if (!previous) previous = createInspection({ stationId, week, pendingKaizen: app5sLoadPendingKaizen_(stationId) });
  const responsibleName = previous.startedBy || app5sStationOwner_(stationId);
  if (previous.status !== 'expired') {
    previous = expireInspection(previous, {
      at: currentDate.toISOString(),
      closedBy: nextInspectorName,
      responsibleName,
    });
  } else {
    previous = { ...previous, closedBy: previous.closedBy || nextInspectorName, responsibleName: previous.responsibleName || responsibleName };
  }
  app5sSaveState_(previous);
  app5sEvent_('SEMANA_ANTERIOR_CERRADA', previous);
  app5sSyncProgress_(previous);
  return { week, responsibleName: previous.responsibleName, closedBy: previous.closedBy };
}
