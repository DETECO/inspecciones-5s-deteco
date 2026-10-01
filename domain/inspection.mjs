import { MODULES, getQuestion } from './catalog.mjs?v=20261001-gd';
import { scoreInspection, validateInspection } from './scoring.mjs?v=20261001-gd';
import { validateKaizenReviews } from './kaizen.mjs';
import { inspectionQuestions, dailyManagementResult } from './daily-management.mjs?v=20261001-gd';

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

export function createInspection({ stationId, week, pendingKaizen = [] }) {
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

export function reserveInspection(state, { clientId, inspectorName, at } = {}) {
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

export function requestTakeover(state, { clientId, inspectorName, at } = {}) {
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

export function acknowledgeTakeover(state, { clientId, pendingSyncOps, at } = {}) {
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

export function saveAnswer(state, { clientId, questionId, count } = {}) {
  requireEditor(state, clientId);
  if (!getQuestion(questionId)) throw new Error('Pregunta de inspección inválida.');
  if (!Number.isInteger(count) || count < 0 || count > 5) throw new Error('Los hallazgos deben ser un entero de 0 a 5.');
  const next = copyState(state);
  next.answers[questionId] = count;
  return next;
}

export function saveFinding(state, { clientId, questionId, ordinal, finding } = {}) {
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

export function discardExtraFindings(state, { clientId, questionId } = {}) {
  requireEditor(state, clientId);
  const answer = state.answers[questionId];
  if (!getQuestion(questionId) || !Number.isInteger(answer) || answer < 0) throw new Error('Pregunta de inspección inválida.');
  const next = copyState(state);
  next.findings[questionId] = (next.findings[questionId] || []).slice(0, answer);
  return next;
}

export function releaseInspection(state, { clientId, at } = {}) {
  requireEditor(state, clientId);
  return copyState(state, {
    editor: null,
    takeover: null,
    releasedAt: timestamp(at),
  });
}

export function closeInspection(state, { clientId, at, completionStatus = 'cumplida' } = {}) {
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

export function expireInspection(state, { at, closedBy = '', responsibleName = state.startedBy || '' } = {}) {
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
