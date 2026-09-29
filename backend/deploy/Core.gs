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
