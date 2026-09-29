import { STATIONS, MODULES, QUESTIONS, getQuestion } from '../domain/catalog.mjs';
import { isoWeekChile, inspectionWindow } from '../domain/calendar.mjs';
import { validateInspection } from '../domain/scoring.mjs';
import { validateKaizenReviews } from '../domain/kaizen.mjs';
import { resolveAppConfig } from './config.mjs';
import { createIndexedDraftStore } from './draft-store.mjs';
import { createBridgeSession } from './bridge-session.mjs';
import { createFormBridge } from '../transport/form-client.mjs';
import { mergeServerState } from './state-merge.mjs';
import {
  createInspection,
  reserveInspection,
  saveAnswer,
  saveFinding,
  discardExtraFindings,
  closeInspection,
} from '../domain/inspection.mjs';
import { parseQrRoute, scrubQrFragment } from './route.mjs';

const appElement = document.querySelector('#app');
const sessionKey = 'deteco-5s.active-qr';
const namesKey = 'deteco-5s.inspector-names';
const clientKey = 'deteco-5s.client-id';
const appConfig = resolveAppConfig(window.DETECO_5S_CONFIG || {});
const draftStore = createIndexedDraftStore();

const state = {
  route: null,
  station: null,
  week: isoWeekChile(new Date()),
  inspectorName: '',
  inspection: null,
  screen: 'qr',
  moduleIndex: 0,
  error: '',
  syncStatus: appConfig.mode === 'bridge' ? 'Conectando' : 'Borrador local',
  syncQueue: [],
  bridgeSession: null,
  knownInspectors: [],
  previousWeekAlert: null,
  clientId: localStorage.getItem(clientKey) || crypto.randomUUID(),
};

if (!localStorage.getItem(clientKey)) localStorage.setItem(clientKey, state.clientId);

function draftKey() {
  return state.route ? `deteco-5s.draft.${state.route.stationId}.${state.week.key}` : '';
}

function ensureBridgeSession() {
  if (!state.bridgeSession && appConfig.mode === 'bridge' && state.route) {
    state.bridgeSession = createBridgeSession({
      bridge: createFormBridge({ endpoint: appConfig.bridgeEndpoint }),
      stationId: state.route.stationId,
      accessToken: state.route.accessToken,
      clientId: state.clientId,
    });
    state.bridgeSession.restore(state.syncQueue);
  }
  return state.bridgeSession;
}

async function applyBridgeReceipt(receipt) {
  if (receipt?.station && receipt.station.id === state.route?.stationId) state.station = receipt.station;
  if (Array.isArray(receipt?.inspectorNames)) state.knownInspectors = receipt.inspectorNames;
  if (receipt?.previousWeekAlert) state.previousWeekAlert = receipt.previousWeekAlert;
  if (receipt?.state) state.inspection = mergeServerState(receipt.state, state.inspection || {}, state.bridgeSession?.pending() || []);
  state.syncQueue = state.bridgeSession?.pending() || [];
  state.syncStatus = state.syncQueue.length ? 'Pendiente de envío' : 'Sincronizado';
  await draftSave();
}

async function flushBridgeQueue() {
  const session = ensureBridgeSession();
  if (!session || !navigator.onLine || !session.pending().length) return;
  state.syncStatus = 'Sincronizando';
  render();
  try {
    await session.flush({ onReceipt: applyBridgeReceipt });
    state.syncStatus = 'Sincronizado';
    state.error = '';
  } catch (error) {
    state.syncQueue = session.pending();
    state.syncStatus = 'Pendiente de envío';
    if (navigator.onLine) state.error = `No llegó confirmación de guardado. El avance sigue en este teléfono: ${error.message}`;
    await draftSave();
  }
  render();
}

async function queueBridgeOperation(operation, payload) {
  const session = ensureBridgeSession();
  if (!session) return;
  session.enqueue(operation, payload);
  state.syncQueue = session.pending();
  state.syncStatus = navigator.onLine ? 'Pendiente de envío' : 'Sin conexión';
  await draftSave();
  if (navigator.onLine) await flushBridgeQueue();
}

async function initializeApp() {
  activateRoute();
  if (state.route) {
    try {
      await draftLoad();
      if (appConfig.mode === 'bridge') {
        ensureBridgeSession();
        if (navigator.onLine) {
          const receipt = await state.bridgeSession.readState();
          await applyBridgeReceipt(receipt);
          state.screen = state.inspection.status === 'closed' || state.inspection.status === 'expired' ? 'summary' : 'identity';
          state.inspectorName ||= state.inspection.editor?.inspectorName || state.inspection.startedBy || '';
        } else {
          state.syncStatus = state.syncQueue.length ? 'Pendiente de envío' : 'Sin conexión';
        }
      }
    } catch (error) {
      state.error = `No se pudo cargar la inspección: ${error.message}`;
      state.syncStatus = 'Sin conexión';
    }
  }
  render();
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function stationName() {
  return state.station?.name || 'ESTACIÓN';
}

function storageRead(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function rememberNames(name) {
  const names = storageRead(namesKey, []);
  const next = [name, ...names.filter(item => item.toLocaleLowerCase() !== name.toLocaleLowerCase())].slice(0, 50);
  localStorage.setItem(namesKey, JSON.stringify(next));
}

async function draftSave() {
  if (!state.inspection || !state.route) return;
  const record = {
    inspectorName: state.inspectorName,
    station: state.station,
    inspection: state.inspection,
    moduleIndex: state.moduleIndex,
    syncQueue: state.bridgeSession?.pending() || state.syncQueue,
    previousWeekAlert: state.previousWeekAlert,
  };
  await draftStore.save(draftKey(), record);
  state.syncQueue = record.syncQueue;
}

function persistDraftQuietly() {
  draftSave().catch(error => {
    state.error = `No se pudo guardar el avance en este teléfono: ${error.message}`;
    render();
  });
}

async function draftLoad() {
  const saved = await draftStore.load(draftKey());
  if (!saved?.inspection || saved.inspection.stationId !== state.route.stationId || saved.inspection.week !== state.week.key) return;
  state.inspection = saved.inspection;
  if (saved.station?.id === state.route.stationId) state.station = saved.station;
  state.syncQueue = saved.syncQueue || [];
  state.previousWeekAlert = saved.previousWeekAlert || null;
  state.inspectorName = saved.inspectorName || saved.inspection.editor?.inspectorName || saved.inspection.startedBy || '';
  state.moduleIndex = Math.min(Math.max(Number(saved.moduleIndex) || 0, 0), MODULES.length - 1);
  state.screen = saved.inspection.status === 'closed' || saved.inspection.status === 'expired' ? 'summary' : 'identity';
}

function activateRoute() {
  let route = null;
  try {
    route = parseQrRoute(window.location.href);
    sessionStorage.setItem(sessionKey, JSON.stringify(route));
    history.replaceState({}, document.title, scrubQrFragment(window.location.href));
  } catch {
    route = storageReadFromSession(sessionKey);
  }
  if (!route) return;
  state.route = route;
  state.screen = 'identity';
  state.station = STATIONS.find(item => item.id === route.stationId) || { id: route.stationId, name: route.stationId.toUpperCase() };
}

function storageReadFromSession(key) {
  try {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function currentWindow() {
  return inspectionWindow(new Date(), Boolean(state.inspection?.startedAt));
}

function completionStatus() {
  return currentWindow() === 'late-continuation' ? 'cumplida-con-atraso' : 'cumplida';
}

function answeredCount() {
  return Object.keys(state.inspection?.answers || {}).filter(id => Number.isInteger(state.inspection.answers[id])).length;
}

function percent() {
  return Math.round((answeredCount() / QUESTIONS.length) * 100);
}

function number(value) {
  return Number(value).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function syncLabel() {
  if (!navigator.onLine) return 'Sin conexión';
  return state.syncStatus;
}

function header() {
  const title = state.route ? stationName() : 'INSPECCIÓN 5S';
  const text = state.inspection?.status === 'closed' || state.inspection?.status === 'expired' ? 'Inspección cerrada' : state.route ? `${answeredCount()} de ${QUESTIONS.length} respuestas` : 'Acceso por QR';
  return `
    <header class="header">
      <div class="header-inner">
        <div class="brand-row"><div class="brand"><img class="brand-logo" src="./assets/deteco-wordmark.jpg" alt="DETECO — Desarrollo de tecnologías para la construcción"></div><span class="mode-pill">5S semanal</span></div>
        ${state.route ? `<div class="context-row"><div><div class="context-label">Inspección 5S</div><div class="context-title">${esc(title)}</div></div><span class="week">${esc(state.week.key.replace('-W', ' · S'))}</span></div>` : ''}
        <div class="state-row"><span class="state-copy">${esc(text)}</span><span class="sync-pill ${navigator.onLine ? '' : 'offline'}"><i class="sync-dot"></i>${esc(syncLabel())}</span></div>
        ${state.route ? `<div class="progress-track" aria-label="Avance ${percent()}%"><div class="progress-fill" style="width:${percent()}%"></div></div>` : ''}
      </div>
    </header>`;
}

function errorNotice() {
  if (!state.error) return '';
  return `<div class="notice danger"><span class="notice-icon">!</span><span>${esc(state.error)}</span></div>`;
}

function qrPage() {
  return `
    <section class="welcome-page page-enter">
      <div class="eyebrow">Acceso por QR</div>
      <h1>Inspección 5S</h1>
      <p class="lead">Para iniciar o retomar una inspección, entra desde el código QR instalado en el tablero de tu estación.</p>
      <figure class="welcome-visual"><img src="./assets/qr-estacion-hero.png" alt="Un teléfono escanea un QR ilustrativo en un tablero de estación de trabajo"><figcaption>Imagen referencial. Escanea el código QR físico del tablero de tu estación.</figcaption></figure>
      <ol class="welcome-steps" aria-label="Cómo entrar a una inspección">
        <li class="welcome-step"><span class="step-number">1</span><div><h2>Abre la cámara</h2><p>Usa la cámara de tu teléfono.</p></div></li>
        <li class="welcome-step"><span class="step-number">2</span><div><h2>Escanea el QR</h2><p>Apunta al código del tablero de tu estación.</p></div></li>
        <li class="welcome-step"><span class="step-number">3</span><div><h2>Continúa la inspección</h2><p>La app identificará la estación y la semana.</p></div></li>
      </ol>
      <div class="notice"><span class="notice-icon" aria-hidden="true">↗</span><span>El código QR abre la estación correcta y permite comenzar o retomar el avance guardado.</span></div>
      <div class="empty">Esta página general no inicia una inspección. Para continuar, escanea el QR del tablero de tu estación.</div>
    </section>`;
}

function scheduleMessage() {
  const windowState = currentWindow();
  if (windowState === 'open') return '';
  if (windowState === 'late-continuation') return `<div class="notice"><span class="notice-icon">!</span><span>Solo puedes terminar una inspección ya iniciada. Al cerrar se registrará como <strong>cumplida con atraso</strong>.</span></div>`;
  return `<div class="notice danger"><span class="notice-icon">!</span><span>La edición está bloqueada por horario. Puedes inspeccionar de lunes a miércoles entre 08:15 y 17:00, y el jueves hasta las 12:00. Después del jueves 12:00 solo se retoma una inspección ya iniciada, hasta las 17:00.</span></div>`;
}

function identityPage() {
  if (state.inspection?.status === 'closed' || state.inspection?.status === 'expired') return summaryPage();
  const heldByOther = Boolean(state.inspection?.editor && state.inspection.editor.clientId !== state.clientId);
  const waitingForTakeover = state.inspection?.takeover?.requestedBy === state.clientId;
  const canStart = !heldByOther && (currentWindow() === 'open' || (currentWindow() === 'late-continuation' && Boolean(state.inspection?.startedAt)));
  const existing = Boolean(state.inspection);
  const names = [...new Set([...state.knownInspectors, ...storageRead(namesKey, [])].map(name => String(name).trim()).filter(Boolean))]
    .map(name => `<option value="${esc(name)}"></option>`).join('');
  return `
    <section class="page-enter">
      <div class="eyebrow">${existing ? 'Inspección en curso' : 'Semana disponible'}</div>
      <h1>${existing ? 'Retoma la inspección' : 'Identifícate para continuar'}</h1>
      <p class="lead">${existing ? `El avance de esta estación se conserva. La responsabilidad inicial corresponde a ${esc(state.inspection.startedBy)}.` : 'Escribe tu nombre para dejar trazabilidad de quién realiza la inspección.'}</p>
      ${heldByOther ? `<div class="notice"><span class="notice-icon">↗</span><span>${waitingForTakeover ? 'Tu solicitud está enviada. Espera a que el teléfono actual entregue el control.' : `La inspección está abierta en el teléfono de ${esc(state.inspection.editor.inspectorName)}. Puedes solicitar continuarla.`}</span></div>` : ''}
      ${scheduleMessage()}${errorNotice()}
      <div class="field"><label for="inspector-name">Nombre del inspector</label><input class="input" id="inspector-name" list="known-inspectors" maxlength="80" autocomplete="name" value="${esc(state.inspectorName)}" placeholder="Escribe o selecciona tu nombre"><datalist id="known-inspectors">${names}</datalist><p class="hint">Si no apareces, escribe tu nombre y se agregará para próximas inspecciones.</p></div>
      <button class="primary" data-action="${heldByOther ? 'request-takeover' : 'start'}" ${heldByOther ? waitingForTakeover ? 'disabled' : '' : canStart ? '' : 'disabled'}>${heldByOther ? waitingForTakeover ? 'Esperando autorización' : 'Solicitar continuar' : existing ? 'Retomar inspección' : 'Iniciar inspección'}</button>
    </section>`;
}

function kaizenPage() {
  const pending = state.inspection.pendingKaizen || [];
  if (!pending.length) {
    state.screen = 'module';
    return modulePage();
  }
  return `
    <section class="page-enter">
      <div class="eyebrow">Paso obligatorio</div>
      <h1>Kaizen pendientes</h1>
      <p class="lead">Antes de responder esta semana, resuelve o justifica cada kaizen pendiente de ${esc(stationName())}.</p>
      ${pending.map(item => kaizenCard(item)).join('')}
      ${errorNotice()}
    </section>
    ${footer('<button class="primary" data-action="continue-kaizen">Continuar a preguntas</button>')}`;
}

function kaizenCard(item) {
  const review = state.inspection.kaizenReviews?.[item.id] || {};
  return `<article class="kaizen"><h3>Kaizen pendiente</h3><p class="kaizen-meta">Responsable: ${esc(item.ownerName || 'Sin encargado asignado')}</p>
    <div class="decision-row"><button class="choice-button ${review.decision === 'solved' ? 'selected' : ''}" data-action="kaizen-decision" data-kaizen="${esc(item.id)}" data-decision="solved">Resuelto</button><button class="choice-button ${review.decision === 'pending' ? 'selected' : ''}" data-action="kaizen-decision" data-kaizen="${esc(item.id)}" data-decision="pending">Sigue pendiente</button></div>
    ${review.decision === 'solved' ? `<label class="camera-input">Adjuntar foto de solución<input type="file" accept="image/*" capture="environment" data-action="kaizen-photo" data-kaizen="${esc(item.id)}"></label>${review.preview ? `<img class="photo-preview" src="${esc(review.preview)}" alt="Foto de solución">` : ''}<p class="hint">La nota de cierre es opcional.</p>` : ''}
    ${review.decision === 'pending' ? `<div class="field"><label>Justificación de esta semana</label><textarea class="textarea" data-action="kaizen-reason" data-kaizen="${esc(item.id)}" placeholder="Explica por qué continúa pendiente">${esc(review.reason || '')}</textarea></div>` : ''}
  </article>`;
}

function tabs() {
  return `<nav class="module-tabs" aria-label="Módulos 5S">${MODULES.map((module, index) => {
    const complete = module.questions.every(question => Number.isInteger(state.inspection.answers[question.id]));
    return `<button class="module-tab ${index === state.moduleIndex ? 'active' : ''} ${complete ? 'done' : ''}" data-action="module" data-index="${index}">${esc(module.title)}</button>`;
  }).join('')}</nav>`;
}

function modulePage() {
  const module = MODULES[state.moduleIndex];
  return `
    <section class="page-enter">
      <div class="eyebrow">Módulo ${state.moduleIndex + 1} de ${MODULES.length}</div>
      <h1>${esc(module.title)}</h1>
      <p class="lead">Selecciona de 0 a 5 hallazgos. Cada hallazgo necesita una fotografía; la nota descriptiva es opcional.</p>
      ${tabs()}${errorNotice()}
      <div>${module.questions.map((question, index) => questionCard(question, index)).join('')}</div>
    </section>
    ${footer(moduleFooter())}`;
}

function questionCard(question, index) {
  const count = state.inspection.answers[question.id];
  const items = state.inspection.findings[question.id] || [];
  return `<article class="question"><div class="question-head"><span class="question-number">${index + 1}</span><div class="question-text">${esc(question.text)}</div></div>
    <div class="answer-box"><div class="answer-caption"><span>Hallazgos</span><span>${Number.isInteger(count) ? `${count} seleccionado${count === 1 ? '' : 's'}` : 'Obligatorio'}</span></div>
      <div class="count-options">${[0, 1, 2, 3, 4, 5].map(value => `<button class="count ${count === value ? 'selected' : ''}" aria-pressed="${count === value}" data-action="answer" data-question="${question.id}" data-count="${value}">${value}</button>`).join('')}</div>
    </div>${Number.isInteger(count) && count > 0 ? findingArea(question.id, count, items) : ''}</article>`;
}

function findingArea(questionId, count, items) {
  return `<div class="finding-area"><div class="finding-title"><span>Fotos requeridas</span><span>${items.filter(item => item?.photoId).length} de ${count}</span></div>${Array.from({ length: count }, (_, index) => {
    const ordinal = index + 1;
    const item = items[index] || {};
    return `<div class="finding"><div class="finding-top"><span class="finding-index">${ordinal}</span><span class="finding-status">${item.photoId ? 'Foto lista para sincronizar' : 'Falta fotografía'}</span></div>
      <label class="camera-input">Tomar o elegir foto<input type="file" accept="image/*" capture="environment" data-action="finding-photo" data-question="${questionId}" data-ordinal="${ordinal}"></label>
      ${item.preview ? `<img class="photo-preview" src="${esc(item.preview)}" alt="Hallazgo ${ordinal}">` : ''}
      <textarea class="textarea" data-action="finding-note" data-question="${questionId}" data-ordinal="${ordinal}" placeholder="Nota del hallazgo (opcional)">${esc(item.note || '')}</textarea>
    </div>`;
  }).join('')}</div>`;
}

function moduleFooter() {
  const isLast = state.moduleIndex === MODULES.length - 1;
  return `<p class="footer-note">Las notas se mostrarán solo después del cierre.</p><div class="button-row">${state.moduleIndex > 0 ? '<button class="secondary" data-action="previous-module">Módulo anterior</button>' : '<span></span>'}<button class="primary" data-action="${isLast ? 'review' : 'next-module'}">${isLast ? 'Revisar cierre' : 'Siguiente módulo'}</button></div>`;
}

function reviewPage() {
  const inspection = validateInspection(state.inspection.answers, state.inspection.findings);
  const kaizen = validateKaizenReviews(state.inspection.pendingKaizen, state.inspection.kaizenReviews);
  const checks = [
    ['25 preguntas respondidas', inspection.missingQuestions.length === 0 && inspection.invalidQuestions.length === 0],
    ['Una foto por cada hallazgo', inspection.missingPhotos.length === 0 && inspection.extraFindings.length === 0],
    ['Kaizen pendientes revisados', kaizen.canContinue],
  ];
  const ready = inspection.canClose && kaizen.canContinue;
  return `
    <section class="page-enter">
      <div class="eyebrow">Cierre de inspección</div><h1>Revisa los faltantes</h1><p class="lead">Al cerrar, el QR de ${esc(stationName())} quedará bloqueado para esta semana.</p>
      ${checks.map(([label, complete]) => `<div class="check"><span class="check-mark ${complete ? 'done' : ''}">${complete ? '✓' : ''}</span><span>${label}</span></div>`).join('')}
      ${!ready ? `<div class="notice"><span class="notice-icon">!</span><span>Completa los elementos pendientes antes de cerrar. No se mostrará una nota parcial.</span></div>` : `<div class="notice good"><span class="notice-icon">✓</span><span>La inspección está completa y puede cerrarse.</span></div>`}${errorNotice()}
    </section>
    ${footer(`<div class="button-row"><button class="secondary" data-action="back-to-module">Volver a preguntas</button><button class="primary" data-action="close" ${ready ? '' : 'disabled'}>Cerrar inspección</button></div>`)}`;
}

function summaryPage() {
  const result = state.inspection.result;
  if (!result) return identityPage();
  const scoreGood = result.finalScore >= 4;
  return `
    <section class="page-enter">
      <div class="eyebrow">Inspección cerrada</div><h1>Resumen final</h1>
      <div class="summary-hero"><small>Nota final</small><div class="summary-score"><strong>${number(result.finalScore)}</strong><span class="${scoreGood ? '' : 'low'}">${scoreGood ? 'SATISFACTORIA' : 'BAJO 4,0'}</span></div></div>
      ${MODULES.map(module => `<div class="score-row"><strong>${esc(module.title)}</strong><span class="${result.moduleScores[module.id] < 4 ? 'low' : ''}">${number(result.moduleScores[module.id])}</span></div>`).join('')}
      <div class="notice ${result.completionStatus === 'vencida-cerrada-incompleta' ? 'danger' : 'good'}"><span class="notice-icon">${result.completionStatus === 'vencida-cerrada-incompleta' ? '!' : '✓'}</span><span>${result.completionStatus === 'vencida-cerrada-incompleta' ? 'Cerrada incompleta al vencer la semana; nota 0 en todos los módulos.' : result.completionStatus === 'cumplida-con-atraso' ? 'Cumplida con atraso.' : 'Cumplida.'} ${state.inspection.closedBy ? `Cerrada por ${esc(state.inspection.closedBy)}.` : ''}</span></div>
      <p class="small">${state.syncStatus === 'Sincronizado' ? 'Registro guardado en Google Sheets y Drive.' : 'Este resultado está guardado como borrador local y todavía no se ha enviado a Google.'}</p>
    </section>`;
}

function footer(content) {
  return `<footer class="footer">${content}</footer>`;
}

function takeoverPrompt() {
  const takeover = state.inspection?.takeover;
  if (!takeover || state.inspection.editor?.clientId !== state.clientId) return '';
  return `<div class="notice"><span class="notice-icon">↗</span><span>${esc(takeover.inspectorName)} solicita continuar esta inspección desde otro teléfono.</span><button class="secondary" data-action="approve-takeover" ${state.syncQueue.length ? 'disabled' : ''}>Entregar control</button>${state.syncQueue.length ? '<p class="hint">Espera a que se envíen los cambios pendientes antes de entregar.</p>' : ''}</div>`;
}

function previousWeekNotice() {
  const alert = state.previousWeekAlert;
  if (!alert) return '';
  return `<div class="notice danger"><span class="notice-icon">!</span><span>La inspección de la semana pasada (${esc(alert.week)}) quedó cerrada incompleta, con nota 0 en todos los módulos. Responsable: ${esc(alert.responsibleName)}. La cerró ${esc(alert.closedBy)}.</span></div>`;
}

function render() {
  let content;
  if (!state.route) content = qrPage();
  else if (state.screen === 'identity') content = identityPage();
  else if (state.screen === 'kaizen') content = kaizenPage();
  else if (state.screen === 'module') content = modulePage();
  else if (state.screen === 'review') content = reviewPage();
  else if (state.screen === 'summary') content = summaryPage();
  else content = qrPage();
  appElement.innerHTML = `${header()}<main>${previousWeekNotice()}${takeoverPrompt()}${content}</main>`;
}

async function start() {
  const input = document.querySelector('#inspector-name');
  const name = input?.value.trim() || '';
  if (name.length < 2) {
    state.error = 'Escribe tu nombre para continuar.';
    render();
    return;
  }
  try {
    if (!state.inspection) state.inspection = createInspection({ stationId: state.route.stationId, week: state.week.key });
    if (appConfig.mode === 'bridge') {
      if (!navigator.onLine) {
        if (state.inspection.status !== 'open' || state.inspection.editor?.clientId !== state.clientId) {
          throw new Error('Conéctate a internet para reservar esta estación. Si ya la tienes abierta en este teléfono, puedes continuar con el avance guardado.');
        }
      } else {
        await flushBridgeQueue();
        if (ensureBridgeSession().pending().length) throw new Error('Primero espera que se sincronicen los cambios guardados en este teléfono.');
        const receipt = await ensureBridgeSession().sendNow('reserve', { inspectorName: name });
        state.inspection = mergeServerState(receipt.state, state.inspection);
        if (receipt.station?.id === state.route.stationId) state.station = receipt.station;
        if (Array.isArray(receipt.inspectorNames)) state.knownInspectors = receipt.inspectorNames;
        if (receipt.previousWeekAlert) state.previousWeekAlert = receipt.previousWeekAlert;
        state.syncStatus = 'Sincronizado';
      }
    } else {
      state.inspection = reserveInspection(state.inspection, { clientId: state.clientId, inspectorName: name, at: new Date().toISOString() });
    }
    state.inspectorName = name;
    rememberNames(name);
    state.error = '';
    state.screen = state.inspection.pendingKaizen.length ? 'kaizen' : 'module';
    await draftSave();
    render();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

async function requestTakeoverFromCurrentEditor() {
  const name = document.querySelector('#inspector-name')?.value.trim() || '';
  if (name.length < 2) {
    state.error = 'Escribe tu nombre para solicitar continuar.';
    render();
    return;
  }
  try {
    const receipt = await ensureBridgeSession().sendNow('request-takeover', { inspectorName: name });
    state.inspection = mergeServerState(receipt.state, state.inspection);
    if (Array.isArray(receipt.inspectorNames)) state.knownInspectors = receipt.inspectorNames;
    state.inspectorName = name;
    state.error = '';
    state.syncStatus = 'Sincronizado';
    rememberNames(name);
    await draftSave();
  } catch (error) {
    state.error = error.message;
  }
  render();
}

async function approveTakeover() {
  try {
    const pendingSyncOps = ensureBridgeSession().pending().length;
    const receipt = await ensureBridgeSession().sendNow('acknowledge-takeover', { pendingSyncOps });
    state.inspection = mergeServerState(receipt.state, state.inspection);
    if (Array.isArray(receipt.inspectorNames)) state.knownInspectors = receipt.inspectorNames;
    if (state.inspection.editor?.clientId !== state.clientId) {
      state.screen = 'identity';
      state.error = 'El control se entregó al otro teléfono. Tu avance quedó guardado.';
    }
    await draftSave();
  } catch (error) {
    state.error = error.message;
  }
  render();
}

async function refreshServerState() {
  if (appConfig.mode !== 'bridge' || !state.route || !navigator.onLine || document.hidden) return;
  const session = ensureBridgeSession();
  if (session.pending().length) return;
  try {
    const receipt = await session.readState();
    state.inspection = mergeServerState(receipt.state, state.inspection || {}, state.bridgeSession?.pending() || []);
    if (receipt.station?.id === state.route.stationId) state.station = receipt.station;
    if (Array.isArray(receipt.inspectorNames)) state.knownInspectors = receipt.inspectorNames;
    state.syncStatus = 'Sincronizado';
    if (state.inspection.status === 'closed' || state.inspection.status === 'expired') {
      state.screen = 'summary';
    } else if (state.inspection.editor?.clientId === state.clientId && state.inspection.startedAt) {
      state.screen = state.inspection.pendingKaizen.length ? 'kaizen' : 'module';
      state.inspectorName ||= state.inspection.editor.inspectorName || '';
    } else if (state.inspection.editor?.clientId !== state.clientId && state.screen !== 'qr') {
      state.screen = 'identity';
    }
    await draftSave();
  } catch {
    state.syncStatus = 'Sin conexión';
  }
  render();
}

async function changeAnswer(questionId, count) {
  const previousItems = state.inspection.findings[questionId] || [];
  if (count < previousItems.length && !window.confirm('Hay fotos asociadas que sobran. ¿Confirmas quitarlas de este borrador?')) return;
  try {
    state.error = '';
    state.inspection = saveAnswer(state.inspection, { clientId: state.clientId, questionId, count });
    await queueBridgeOperation('save-answer', { questionId, count });
    if (count < previousItems.length) {
      state.inspection = discardExtraFindings(state.inspection, { clientId: state.clientId, questionId });
      await queueBridgeOperation('discard-extra-findings', { questionId });
    }
    await draftSave();
  } catch (error) {
    state.error = error.message;
  }
  render();
}

async function readImage(file) {
  if (!file?.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen.');
  if (file.size > 1500000) throw new Error('La foto supera 1,5 MB. Toma una imagen de menor tamaño.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la foto.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

async function addFindingPhoto(target) {
  try {
    state.error = '';
    const questionId = target.dataset.question;
    const ordinal = Number(target.dataset.ordinal);
    const preview = await readImage(target.files?.[0]);
    const existing = state.inspection.findings[questionId]?.[ordinal - 1] || {};
    state.inspection = saveFinding(state.inspection, {
      clientId: state.clientId,
      questionId,
      ordinal,
      finding: { ...existing, id: existing.id || crypto.randomUUID(), photoId: `local-${crypto.randomUUID()}`, preview, dataUri: preview },
    });
    await queueBridgeOperation('save-finding', {
      questionId,
      ordinal,
      finding: { id: state.inspection.findings[questionId][ordinal - 1].id, dataUri: preview, note: existing.note || '' },
    });
    await draftSave();
  } catch (error) {
    state.error = error.message;
  }
  render();
}

function setFindingNote(target) {
  const questionId = target.dataset.question;
  const ordinal = Number(target.dataset.ordinal);
  const items = [...(state.inspection.findings[questionId] || [])];
  const current = items[ordinal - 1] || { id: crypto.randomUUID(), photoId: '' };
  items[ordinal - 1] = { ...current, note: target.value };
  state.inspection = { ...state.inspection, findings: { ...state.inspection.findings, [questionId]: items } };
  persistDraftQuietly();
}

async function syncFindingNote(target) {
  const questionId = target.dataset.question;
  const ordinal = Number(target.dataset.ordinal);
  const finding = state.inspection.findings[questionId]?.[ordinal - 1];
  if (finding?.dataUri) {
    try {
      await queueBridgeOperation('save-finding', {
        questionId,
        ordinal,
        finding: { id: finding.id, dataUri: finding.dataUri, note: finding.note || '' },
      });
    } catch (error) {
      state.error = error.message;
    }
  }
  await draftSave();
}

function setKaizenDecision(target) {
  const id = target.dataset.kaizen;
  const review = state.inspection.kaizenReviews[id] || {};
  state.inspection = { ...state.inspection, kaizenReviews: { ...state.inspection.kaizenReviews, [id]: { ...review, decision: target.dataset.decision } } };
  persistDraftQuietly();
  render();
}

function setKaizenReason(target) {
  const review = state.inspection.kaizenReviews[target.dataset.kaizen] || {};
  state.inspection = { ...state.inspection, kaizenReviews: { ...state.inspection.kaizenReviews, [target.dataset.kaizen]: { ...review, reason: target.value } } };
  persistDraftQuietly();
}

async function addKaizenPhoto(target) {
  try {
    const preview = await readImage(target.files?.[0]);
    const id = target.dataset.kaizen;
    const review = state.inspection.kaizenReviews[id] || { decision: 'solved' };
    state.inspection = { ...state.inspection, kaizenReviews: { ...state.inspection.kaizenReviews, [id]: { ...review, photoId: `local-${crypto.randomUUID()}`, preview, dataUri: preview } } };
    state.error = '';
    persistDraftQuietly();
  } catch (error) {
    state.error = error.message;
  }
  render();
}

async function continueKaizen() {
  const check = validateKaizenReviews(state.inspection.pendingKaizen, state.inspection.kaizenReviews);
  if (!check.canContinue) {
    state.error = 'Resuelve o justifica todos los kaizen pendientes antes de continuar.';
    render();
    return;
  }
  try {
    if (appConfig.mode === 'bridge') {
      for (const item of state.inspection.pendingKaizen) {
        const review = state.inspection.kaizenReviews[item.id];
        await queueBridgeOperation('review-kaizen', {
          kaizenId: item.id,
          review: {
            ...review,
            dataUri: review.decision === 'solved' ? review.dataUri || review.preview : undefined,
          },
        });
      }
    }
  } catch (error) {
    state.error = error.message;
    render();
    return;
  }
  state.error = '';
  state.screen = 'module';
  await draftSave();
  render();
}

async function close() {
  try {
    if (currentWindow() === 'closed') throw new Error('La inspección no puede cerrarse fuera del horario permitido.');
    if (appConfig.mode === 'bridge') {
      const localClose = closeInspection(state.inspection, { clientId: state.clientId, at: new Date().toISOString(), completionStatus: completionStatus() });
      if (navigator.onLine) {
        await flushBridgeQueue();
        if (ensureBridgeSession().pending().length) throw new Error('Hay cambios sin sincronizar. Espera la confirmación antes de cerrar.');
        const receipt = await ensureBridgeSession().sendNow('close', {});
        state.inspection = mergeServerState(receipt.state, state.inspection);
        state.syncStatus = 'Sincronizado';
      } else {
        state.inspection = localClose;
        state.syncStatus = 'Pendiente de envío';
        state.screen = 'summary';
        await queueBridgeOperation('close', {});
      }
      state.screen = 'summary';
    } else {
      state.inspection = closeInspection(state.inspection, { clientId: state.clientId, at: new Date().toISOString(), completionStatus: completionStatus() });
      state.screen = 'summary';
    }
    state.error = '';
    await draftSave();
  } catch (error) {
    if (appConfig.mode === 'bridge' && navigator.onLine) {
      try {
        const receipt = await ensureBridgeSession().readState();
        if (receipt.state.status === 'closed' || receipt.state.status === 'expired') {
          state.inspection = mergeServerState(receipt.state, state.inspection);
          if (Array.isArray(receipt.inspectorNames)) state.knownInspectors = receipt.inspectorNames;
          state.syncStatus = 'Sincronizado';
          state.screen = 'summary';
          state.error = '';
          await draftSave();
          render();
          return;
        }
      } catch {
        // Keep the original error if the follow-up state check also fails.
      }
    }
    state.error = error.message;
  }
  render();
}

appElement.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'start') start();
  if (action === 'request-takeover') requestTakeoverFromCurrentEditor();
  if (action === 'approve-takeover') approveTakeover();
  if (action === 'answer') changeAnswer(target.dataset.question, Number(target.dataset.count));
  if (action === 'module') { state.moduleIndex = Number(target.dataset.index); state.screen = 'module'; persistDraftQuietly(); render(); }
  if (action === 'previous-module') { state.moduleIndex -= 1; persistDraftQuietly(); render(); }
  if (action === 'next-module') { state.moduleIndex += 1; persistDraftQuietly(); render(); }
  if (action === 'review') { state.screen = 'review'; render(); }
  if (action === 'back-to-module') { state.screen = 'module'; render(); }
  if (action === 'close') close();
  if (action === 'kaizen-decision') setKaizenDecision(target);
  if (action === 'continue-kaizen') continueKaizen();
});

appElement.addEventListener('change', event => {
  const target = event.target;
  if (target.dataset.action === 'finding-photo') addFindingPhoto(target);
  if (target.dataset.action === 'kaizen-photo') addKaizenPhoto(target);
  if (target.dataset.action === 'finding-note') syncFindingNote(target);
});

appElement.addEventListener('input', event => {
  const target = event.target;
  if (target.dataset.action === 'finding-note') setFindingNote(target);
  if (target.dataset.action === 'kaizen-reason') setKaizenReason(target);
});

window.addEventListener('online', () => {
  if (state.syncQueue.length) flushBridgeQueue();
  else render();
});
window.addEventListener('offline', render);
window.setInterval(refreshServerState, 10000);

initializeApp();
