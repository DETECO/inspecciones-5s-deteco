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
  return HtmlService.createHtmlOutputFromFile('Admin')
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
const questionsById = new Map(QUESTIONS.map(question => [question.id, question]));

function getQuestion(id) {
  return questionsById.get(id) ?? null;
}


const validCount = value => Number.isInteger(value) && value >= 0 && value <= 5;
const questionIds = new Set(QUESTIONS.map(question => question.id));

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

function validateInspection(answers, findings = {}) {
  const missingQuestions = [];
  const invalidQuestions = [];
  const missingPhotos = [];
  const extraFindings = [];
  const answerMap = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  const findingMap = findings && typeof findings === 'object' && !Array.isArray(findings) ? findings : {};

  for (const question of QUESTIONS) {
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
  const inspectionValidation = validateInspection(state.answers, state.findings);
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
    result: { ...scores, completionStatus },
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

function inspectionWindow(date, started) {
  const { weekday, seconds } = chileClock(date);
  if (seconds < 8 * 3600 + 15 * 60 || seconds >= 17 * 3600) return 'closed';
  if (['Mon', 'Tue', 'Wed'].includes(weekday)) return 'open';
  if (weekday === 'Thu') {
    if (seconds < 12 * 3600) return 'open';
    return started ? 'late-continuation' : 'closed';
  }
  return 'closed';
}

function weeklyDeadlinePassed(date) {
  const { weekday, seconds } = chileClock(date);
  if (weekday === 'Thu') return seconds >= 17 * 3600;
  return ['Fri', 'Sat', 'Sun'].includes(weekday);
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

const APP5S_PARENT_FOLDER = 'INSPECCIONES 5S';
const APP5S_BOOK = 'CONTROL INSPECCIONES 5S DETECO';
const APP5S_TABLES = {
  Configuracion: ['Estación ID', 'Estación', 'Tipo', 'Encargado del área', 'Activa', 'Latitud', 'Longitud', 'Radio m'],
  Administradores: ['Correo Google Workspace', 'Nombre', 'Activo', 'Puede liberar estaciones', 'Puede cambiar configuración', 'Notas'],
  Inspectores: ['Nombre', 'Nombre normalizado', 'Última inspección', 'Veces utilizado'],
  'Política de datos': ['Retención (años)', 'Confirmación antes de eliminar', 'Aplazamiento (días)', 'Última revisión', 'Aplazado hasta'],
  Accesos: ['Estación ID', 'Token QR', 'Activo'],
  Estado: ['Estación ID', 'Semana ISO', 'Estado', 'JSON de estado', 'Actualizado servidor'],
  Inspecciones: ['Inspección ID', 'Estación ID', 'Semana ISO', 'Estado', 'Responsable inicial', 'Cerrada por', 'Inicio', 'Cierre', 'Nota final', 'Estado de cumplimiento', 'Responsable incumplimiento'],
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
    findings: Object.fromEntries(Object.entries(state.findings || {}).map(([id, items]) => [id, items.map(item => ({ ...item, preview: undefined, dataUri: undefined }))])),
    pendingKaizen: (state.pendingKaizen || []).map(item => ({ ...item })),
    kaizenReviews: Object.fromEntries(Object.entries(state.kaizenReviews || {}).map(([id, review]) => [id, { ...review, preview: undefined, dataUri: undefined }])),
    result: state.result ? { ...state.result, moduleScores: { ...state.result.moduleScores } } : null,
    closedAt: state.closedAt || '',
    closedBy: state.closedBy || '',
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
    SpreadsheetApp.openById(existingSheet);
    DriveApp.getFolderById(existingFolder);
    return { installed: true, reused: true };
  }
  if (existingSheet || existingFolder) throw new Error('La instalación quedó parcial; revísala antes de repetirla.');
  const parent = app5sOnlyFolder_(DriveApp.getRootFolder(), APP5S_PARENT_FOLDER, 'Debe existir una sola carpeta INSPECCIONES 5S en Mi unidad.');
  const existingBook = parent.getFilesByName(APP5S_BOOK);
  if (existingBook.hasNext()) throw new Error('Ya existe un libro CONTROL INSPECCIONES 5S DETECO sin instalación registrada; revísalo antes de crear recursos.');
  const book = SpreadsheetApp.create(APP5S_BOOK);
  app5sCreateTables_(book);
  DriveApp.getFileById(book.getId()).moveTo(parent);
  props.setProperties({
    APP5S_SHEET_ID: book.getId(),
    APP5S_FOLDER_ID: parent.getId(),
    APP5S_OWNER_EMAIL: String(Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || '').trim().toLowerCase(),
    APP5S_FIRST_WEEK: isoWeekChile(app5sNow_()).key,
  });
  return { installed: true, reused: false, sheetId: book.getId(), folderId: parent.getId() };
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
  const protection = sheet.protect().setDescription('Solo el propietario puede administrar la lista de autorizaciones 5S.');
  protection.setWarningOnly(false);
  protection.addEditor(Session.getEffectiveUser());
  protection.removeEditors(protection.getEditors());
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
  return {
    adminEmail,
    week,
    permissions,
    stations: app5sStationRegistry_().filter(station => station.active).map(station => {
      const state = app5sLoadState_(station.id, week);
      return {
        stationId: station.id,
        stationName: station.name,
        week,
        status: state?.status || 'new',
        startedBy: state?.startedBy || '',
        startedAt: state?.startedAt || '',
        editorName: state?.editor?.inspectorName || '',
        editorId: state?.editor?.clientId || '',
        qrUrl: permissions.canConfigure ? app5sStationQrUrl_(station.id) : '',
      };
    }),
  };
}

function app5sAdminState() {
  const adminEmail = app5sRequireAdminEmail_('any');
  return app5sWithLock_(() => app5sAdminSnapshot_(adminEmail, isoWeekChile(app5sNow_()).key));
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
  const stationFolder = app5sSubfolder_(root, station.name);
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
  if (ownerEmail && email === ownerEmail) return { canRelease: true, canConfigure: true };
  const sheet = app5sSheet_('Administradores');
  const last = sheet.getLastRow();
  const rows = last > 1 ? sheet.getRange(2, 1, last - 1, APP5S_TABLES.Administradores.length).getValues() : [];
  const row = rows.find(item => String(item[0] || '').trim().toLowerCase() === email && app5sAdminEnabled_(item[2]));
  return row ? { canRelease: app5sAdminEnabled_(row[3]), canConfigure: app5sAdminEnabled_(row[4]) } : { canRelease: false, canConfigure: false };
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
  const allowed = permission === 'any'
    ? permissions.canRelease || permissions.canConfigure
    : permission === 'configure' ? permissions.canConfigure : permissions.canRelease;
  if (!allowed) {
    throw new Error(permission === 'configure'
      ? 'Tu cuenta no tiene permiso para cambiar la configuración.'
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
  QUESTIONS.forEach(question => {
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
  QUESTIONS.forEach(question => {
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
