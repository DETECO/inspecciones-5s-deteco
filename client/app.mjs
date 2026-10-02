import { STATIONS, MODULES, QUESTIONS, DAILY_MANAGEMENT, getQuestion } from '../domain/catalog.mjs?v=20261001-gd';
import { inspectionQuestions } from '../domain/daily-management.mjs?v=20261001-gd';
import { isoWeekChile, inspectionWindow } from '../domain/calendar.mjs?v=20261001-admin-settings';
import { validateInspection } from '../domain/scoring.mjs?v=20261001-gd';
import { validateKaizenReviews } from '../domain/kaizen.mjs';
import { resolveAppConfig } from './config.mjs';
import { createBridgeSession } from './bridge-session.mjs?v=20260930-answers-photos';
import { createFormBridge } from '../transport/form-client.mjs?v=20261002-close';
import { inspectionStatus } from './inspection-status.mjs?v=20261002-status';
import { renderResultSummary } from './result-summary.mjs?v=20261002-summary';
import QrScanner from '../vendor/qr-scanner/qr-scanner.min.js';
import { scannedStationUrl } from './scanned-qr.mjs';
import { readImageForUpload } from './image-upload.mjs';
import { submitFinalInspection } from './final-submit.mjs?v=20261002-close';
import {
  createInspection,
  reserveInspection,
  saveAnswer,
  saveFinding,
  discardExtraFindings,
  closeInspection,
} from '../domain/inspection.mjs?v=20261001-gd';
import { parseQrRoute, scrubQrFragment } from './route.mjs';

const appElement = document.querySelector('#app');
const sessionKey = 'deteco-5s.active-qr';
const namesKey = 'deteco-5s.inspector-names';
const clientKey = 'deteco-5s.client-id';
const appConfig = resolveAppConfig(window.DETECO_5S_CONFIG || {});

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
  scanError: '',
  scanNotice: '',
  qrValidationPending: false,
  qrAccessValidated: false,
  serverTime: null,
  serverCheckedAt: null,
  flashAvailable: false,
  flashOn: false,
  closing: false,
  closeProgress: null,
  submissionState: {},
  photoUploads: 0,
  sessionId: crypto.randomUUID(),
  completedAt: '',
  uploadCache: new Map(),
  clientId: localStorage.getItem(clientKey) || crypto.randomUUID(),
};

let qrScanner = null;
let scannerNavigationPending = false;
let lastInvalidQr = '';
let lastInvalidQrAt = 0;
let accessGeneration = 0;
let statusClockTimer = null;

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
  }
  return state.bridgeSession;
}


async function initializeApp() {
  const openedFromQrUrl = activateRoute();
  if (openedFromQrUrl) {
    render();
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      if (state.screen === 'station-opening') initializeApp();
    }, reduceMotion ? 160 : 980);
    return;
  }
  render();
  if (!state.route) return;

  if (state.route) {
    try {
      if (appConfig.mode === 'bridge') {
        await validateStationAccess();
        return;
      } else {
        state.qrValidationPending = false;
        state.qrAccessValidated = true;
        state.scanNotice = `Estación ${state.station.name} reconocida.`;
      }
    } catch (error) {
      state.qrValidationPending = false;
      state.qrAccessValidated = false;
      state.scanNotice = `QR leído: ${state.station.name}. No se pudo validar el acceso.`;
      state.error = `No se pudo cargar la inspección: ${error.message}`;
      state.syncStatus = navigator.onLine ? 'Sin respuesta' : 'Sin conexión';
    }
  }
  render();
}

function recordServerClock(receipt) {
  const time = new Date(receipt.receivedAt).getTime();
  if (Number.isFinite(time)) {
    state.serverTime = time;
    state.serverCheckedAt = new Date().getTime();
    state.week = isoWeekChile(new Date(time));
  }
}

function inspectionNow() {
  return state.serverTime !== null
    ? new Date(state.serverTime + new Date().getTime() - state.serverCheckedAt)
    : new Date();
}

function displayedStatus(ignoreError = false) {
  return inspectionStatus({ online: navigator.onLine, checking: state.qrValidationPending,
    validated: state.qrAccessValidated, serverConfirmed: appConfig.mode !== 'bridge' || state.serverTime !== null,
    error: ignoreError ? '' : state.error, inspection: state.inspection, clientId: state.clientId,
    now: inspectionNow(), identity: state.screen === 'identity', closing: state.closing, progress: state.syncStatus });
}

function scheduleStatusClock() {
  window.clearTimeout?.(statusClockTimer);
  statusClockTimer = null;
  if (state.screen !== 'identity' || state.serverTime === null) return;
  statusClockTimer = window.setTimeout?.(() => {
    if (state.screen !== 'identity') return;
    if (document.querySelector('#inspection-status-dialog')?.open) scheduleStatusClock();
    else render();
  }, 30000);
}

async function validateStationAccess() {
  if (!state.route || state.screen !== 'identity' || state.qrValidationPending) return;
  const generation = ++accessGeneration;
  state.error = '';
  state.qrAccessValidated = false;
  if (!navigator.onLine) { render(); return; }
  state.qrValidationPending = true;
  render();
  try {
    const receipt = await ensureBridgeSession().sendNow('final-state', { sessionId: state.sessionId });
    if (generation !== accessGeneration || state.screen !== 'identity') return;
    if (!receipt?.state || !Number.isFinite(new Date(receipt.receivedAt).getTime())) throw new Error('No se pudo confirmar la disponibilidad. Pulsa Volver a comprobar.');
    state.inspection = receipt.state;
    recordServerClock(receipt);
    if (receipt.station?.id === state.route.stationId) state.station = receipt.station;
    if (Array.isArray(receipt.inspectorNames)) state.knownInspectors = receipt.inspectorNames;
    state.qrAccessValidated = true;
  } catch (error) {
    if (generation === accessGeneration) state.error = error.message;
  } finally {
    if (generation === accessGeneration) { state.qrValidationPending = false; render(); }
  }
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

async function draftSave() {} // No resumable storage in the final-only flow.
async function draftLoad() {} // Legacy drafts remain untouched.
function persistDraftQuietly() {}

function activateRoute() {
  let route = null;
  let fromQrUrl = false;
  try {
    route = parseQrRoute(window.location.href);
    fromQrUrl = true;
    sessionStorage.setItem(sessionKey, JSON.stringify(route));
    history.replaceState({}, document.title, scrubQrFragment(window.location.href));
  } catch {
    route = storageReadFromSession(sessionKey);
  }
  if (!route) return false;
  state.route = route;
  state.screen = fromQrUrl ? 'station-opening' : 'identity';
  state.station = STATIONS.find(item => item.id === route.stationId) || { id: route.stationId, name: route.stationId.toUpperCase() };
  return fromQrUrl;
}

function storageReadFromSession(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!value || typeof value.stationId !== 'string' || typeof value.accessToken !== 'string') return null;
    const url = new URL(window.location.href);
    url.hash = new URLSearchParams({ station: value.stationId, token: value.accessToken }).toString();
    const route = parseQrRoute(url.href);
    return STATIONS.some(station => station.id === route.stationId) ? route : null;
  } catch {
    return null;
  }
}

function currentWindow() {
  return inspectionWindow(inspectionNow(), Boolean(state.inspection?.startedAt), state.inspection?.schedule || undefined);
}

function completionStatus() {
  return currentWindow() === 'late-continuation' ? 'cumplida-con-atraso' : 'cumplida';
}

function answeredCount() {
  return activeQuestions().filter(q => Number.isInteger(state.inspection?.answers[q.id])).length;
}

function activeQuestions() {
  return state.inspection?.dailyManagementApplicable === true ? [...QUESTIONS, ...DAILY_MANAGEMENT.questions] : QUESTIONS;
}

function activeModules() {
  return state.inspection?.dailyManagementApplicable === true ? [...MODULES, DAILY_MANAGEMENT] : MODULES;
}

function percent() {
  return Math.round((answeredCount() / activeQuestions().length) * 100);
}

function number(value) {
  return Number(value).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function syncLabel() {
  if (!navigator.onLine) return 'Sin conexión';
  return state.syncStatus;
}

function header() {
  if (state.screen === 'summary' && state.inspection?.result) return '';
  const status = displayedStatus();
  const logo = '<img class="brand-logo" src="./assets/deteco-wordmark.jpg" alt="DETECO — Desarrollo de tecnologías para la construcción">';
  if (state.screen === 'scanner') {
    return `
      <header class="header scanner-header">
        <div class="scanner-header-inner"><button class="scanner-back" type="button" data-action="close-scanner" aria-label="Volver"><img src="./assets/icons/arrow-left.svg" alt=""></button>${logo}</div>
        <h1>Escanear estación</h1>
      </header>`;
  }
  if (state.screen === 'station-opening') {
    return `
      <header class="header scanner-header station-opening-header">
        <div class="scanner-header-inner"><span aria-hidden="true"></span>${logo}<span aria-hidden="true"></span></div>
      </header>`;
  }
  const title = state.route ? stationName() : 'INSPECCIÓN 5S';
  const text = state.inspection?.status === 'closed' || state.inspection?.status === 'expired' ? 'Inspección cerrada' : state.route ? `${answeredCount()} de ${activeQuestions().length} respuestas` : 'Acceso por QR';
  if (state.route && !['identity', 'summary'].includes(state.screen)) {
    return `<div class="inspection-brand">${logo}</div><header class="header compact-header"><div class="header-inner"><div class="compact-context"><div><strong>${esc(title)}</strong><small>${esc(state.week.key.replace('-W', ' · S'))}</small></div><button type="button" class="sync-pill status-${status.tone}" data-action="show-inspection-status" aria-haspopup="dialog" aria-controls="inspection-status-dialog" aria-label="Estado: ${esc(status.label)}. Ver detalle"><i class="sync-dot" aria-hidden="true"></i>${esc(status.label)}</button></div><div class="compact-progress"><span class="state-copy">${esc(text)}</span><div class="progress-track" aria-label="Avance ${percent()}%"><div class="progress-fill" style="width:${percent()}%"></div></div></div></div></header>${inspectionStatusDialog(status)}`;
  }
  const adminButton = !state.route && appConfig.mode === 'bridge'
    ? '<a class="admin-link admin-settings-link" href="./admin-login.html" aria-label="Administración" title="Panel de administración"><img src="./assets/icons/settings.svg" alt=""></a>'
    : '';
  return `
    <header class="header">
      <div class="header-inner">
        <div class="brand-row"><div class="brand">${logo}</div><div class="header-actions">${state.route ? '<span class="mode-pill">5S semanal</span>' : ''}${adminButton}</div></div>
        ${state.route ? `<div class="context-row"><div><div class="context-label">Inspección 5S</div><div class="context-title">${esc(title)}</div></div><span class="week">${esc(state.week.key.replace('-W', ' · S'))}</span></div>` : ''}
        ${state.route ? `<div class="state-row"><span class="state-copy">${esc(text)}</span><button type="button" class="sync-pill status-${status.tone}" data-action="show-inspection-status" aria-haspopup="dialog" aria-controls="inspection-status-dialog" aria-label="Estado: ${esc(status.label)}. Ver detalle"><i class="sync-dot" aria-hidden="true"></i>${esc(status.label)}</button></div>` : ''}
        ${state.route ? `<div class="progress-track" aria-label="Avance ${percent()}%"><div class="progress-fill" style="width:${percent()}%"></div></div>` : ''}
      </div>
    </header>${state.route ? inspectionStatusDialog(status) : ''}`;
}

function inspectionStatusDialog(status) {
  return `<dialog id="inspection-status-dialog" class="help-dialog status-dialog" aria-labelledby="inspection-status-title" aria-describedby="inspection-status-reason"><div class="help-dialog-body"><h2 id="inspection-status-title">Estado: ${esc(status.label)}</h2><p id="inspection-status-reason">${esc(status.reason)}</p><div class="button-row">${state.screen === 'identity' && !state.qrValidationPending ? '<button class="secondary" type="button" data-action="retry-status">Volver a comprobar</button>' : ''}<button class="primary" type="button" data-action="close-inspection-status">Entendido</button></div></div></dialog>`;
}

function errorNotice() {
  if (!state.error) return '';
  return `<div class="notice danger"><span class="notice-icon">!</span><span>${esc(state.error)}</span></div>`;
}

function qrPage() {
  return `
    <section class="welcome-page page-enter" aria-label="Inicio de la inspección semanal 5S">
      <div class="welcome-image-frame"><img class="welcome-photo" src="./assets/qr-estacion-hero.png" alt="Una persona escanea el código QR instalado en una estación DETECO" fetchpriority="high"></div>
      <section class="welcome-copy" aria-labelledby="welcome-title">
        <p class="welcome-week">5S SEMANAL</p>
        <h1 id="welcome-title">Inspección 5S</h1>
        <p class="welcome-subtitle">Escanea el QR de tu estación.</p>
        <button class="primary scan-cta" type="button" data-action="open-scanner"><img src="./assets/icons/scan.svg" alt=""><span>Escanear QR</span></button>
        <button class="help-link" type="button" data-action="show-scan-help"><span>Ver instrucciones</span></button>
      </section>
      <dialog class="help-dialog" id="scan-help-dialog" aria-labelledby="scan-help-title">
        <div class="help-dialog-head"><img class="brand-logo" src="./assets/deteco-wordmark.jpg" alt="DETECO"><button class="help-close" type="button" data-action="close-scan-help" aria-label="Cerrar"><img src="./assets/icons/x.svg" alt=""></button></div>
        <div class="help-dialog-body"><h2 id="scan-help-title">Cómo iniciar</h2><ol><li>Toca <strong>Escanear QR</strong> y permite el acceso a la cámara.</li><li>Centra el código del tablero dentro del marco.</li><li>La estación se abrirá automáticamente para identificarte.</li></ol><button class="primary" type="button" data-action="close-scan-help">Entendido</button></div>
      </dialog>
    </section>`;
}

function stationOpeningPage() {
  return `
    <section class="station-opening page-enter" role="status" aria-live="assertive" aria-label="Estación reconocida: ${esc(stationName())}">
      <div class="station-opening-card">
        <span class="station-loader-arc" aria-hidden="true"></span>
        <span class="eyebrow">Estación reconocida</span>
        <h1>${esc(stationName())}</h1>
        <p>Abriendo tu inspección 5S…</p>
      </div>
    </section>`;
}

function scannerPage() {
  return `
    <section class="scanner-page page-enter" aria-label="Escáner QR de estaciones">
      <p class="scanner-instruction">Centra el QR dentro del marco</p>
      <div class="scan-stage">
        <video id="qr-camera" class="camera-video" autoplay muted playsinline aria-label="Vista de la cámara para escanear el QR"></video>
        <div class="scan-guides" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div id="camera-error" class="camera-error" role="alert" hidden></div>
        <button id="retry-camera" class="camera-retry" type="button" data-action="retry-camera" hidden>Reintentar cámara</button>
      </div>
      <div class="camera-controls">
        <button id="flash-toggle" class="flash-toggle" type="button" data-action="toggle-flash" aria-pressed="false" hidden disabled><img src="./assets/icons/bolt.svg" alt=""><span class="flash-label">Linterna</span></button>
        <span class="camera-status"><i id="camera-status-dot" class="camera-status-dot"></i><span id="camera-status">Iniciando cámara</span></span>
      </div>
      <p id="scan-feedback" class="scan-feedback" aria-live="polite">La lectura comienza automáticamente.</p>
    </section>`;
}

function setScanFeedback(message, isError = false) {
  const feedback = document.querySelector('#scan-feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.toggle('is-error', isError);
}

function setCameraStatus(message, active = false) {
  const label = document.querySelector('#camera-status');
  if (label) label.textContent = message;
  document.querySelector('#camera-status-dot')?.classList.toggle('active', active);
}

function cameraErrorMessage(error) {
  if (error?.name === 'NotSupportedError') return 'Este navegador no permite usar la cámara. Abre la web en Safari o Chrome para escanear el QR.';
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') return 'Permite el acceso a la cámara en los ajustes del navegador para escanear el QR.';
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') return 'No se encontró una cámara disponible en este dispositivo.';
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') return 'La cámara está ocupada por otra aplicación. Ciérrala e inténtalo de nuevo.';
  return 'No se pudo iniciar la cámara. Comprueba el permiso e inténtalo nuevamente.';
}

function showCameraError(error) {
  state.scanError = cameraErrorMessage(error);
  const message = document.querySelector('#camera-error');
  if (message) {
    message.textContent = state.scanError;
    message.hidden = false;
  }
  const retry = document.querySelector('#retry-camera');
  if (retry) retry.hidden = false;
  const flash = document.querySelector('#flash-toggle');
  if (flash) { flash.disabled = true; flash.hidden = true; }
  setCameraStatus('Cámara no disponible');
}

function disposeQrScanner() {
  const scanner = qrScanner;
  qrScanner = null;
  if (!scanner) return;
  try { scanner.stop(); } catch { /* La cámara ya puede estar detenida. */ }
  scanner.destroy();
}

async function startQrScanner() {
  const video = document.querySelector('#qr-camera');
  if (!video || state.screen !== 'scanner') return;
  const cameraError = document.querySelector('#camera-error');
  if (cameraError) cameraError.hidden = true;
  const retry = document.querySelector('#retry-camera');
  if (retry) retry.hidden = true;
  const flash = document.querySelector('#flash-toggle');
  if (flash) { flash.disabled = true; flash.hidden = true; }
  setCameraStatus('Iniciando cámara');
  setScanFeedback('La lectura comienza automáticamente.');

  if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    showCameraError({ name: 'NotSupportedError' });
    return;
  }

  let scanner;
  try {
    scanner = new QrScanner(video, handleScannedQr, {
      preferredCamera: 'environment',
      maxScansPerSecond: 12,
      returnDetailedScanResult: true,
      onDecodeError: () => {},
    });
    qrScanner = scanner;
    await scanner.start();
    if (qrScanner !== scanner || state.screen !== 'scanner') {
      scanner.stop();
      scanner.destroy();
      return;
    }
    setCameraStatus('Cámara activa', true);
    state.flashAvailable = await scanner.hasFlash().catch(() => false);
    state.flashOn = false;
    if (flash) {
      flash.disabled = !state.flashAvailable;
      flash.hidden = !state.flashAvailable;
      flash.setAttribute('aria-pressed', 'false');
      flash.classList.remove('is-on');
    }
  } catch (error) {
    if (!scanner || qrScanner === scanner) {
      qrScanner = null;
      scanner?.destroy();
      showCameraError(error);
    }
  }
}

async function handleScannedQr(result) {
  if (scannerNavigationPending) return;
  const value = typeof result === 'string' ? result : result?.data;
  let destination;
  try {
    destination = scannedStationUrl(value, window.location.href);
  } catch (error) {
    const now = Date.now();
    if (value === lastInvalidQr && now - lastInvalidQrAt < 2200) return;
    lastInvalidQr = value || '';
    lastInvalidQrAt = now;
    setScanFeedback(error.message, true);
    return;
  }

  scannerNavigationPending = true;
  const route = parseQrRoute(destination);
  sessionStorage.setItem(sessionKey, JSON.stringify(route));
  state.route = route;
  state.station = STATIONS.find(item => item.id === route.stationId) || { id: route.stationId, name: route.stationId.toUpperCase() };
  state.screen = 'station-opening';
  state.scanError = '';
  state.qrAccessValidated = false;
  state.scanNotice = `QR leído: ${state.station.name}. Abriendo la inspección…`;
  state.qrValidationPending = false;
  disposeQrScanner();
  render();
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(() => {
    if (state.screen === 'station-opening') initializeApp();
  }, reduceMotion ? 160 : 980);
}

function openScanner() {
  accessGeneration += 1;
  disposeQrScanner();
  scannerNavigationPending = false;
  state.scanError = '';
  state.scanNotice = '';
  state.qrValidationPending = false;
  state.qrAccessValidated = false;
  state.serverTime = null;
  state.serverCheckedAt = null;
  state.error = '';
  state.inspection = null;
  state.bridgeSession = null;
  state.flashAvailable = false;
  state.flashOn = false;
  state.screen = 'scanner';
  render();
  startQrScanner();
}

function closeScanner() {
  disposeQrScanner();
  scannerNavigationPending = false;
  state.scanError = '';
  state.screen = 'qr';
  render();
}

function returnToHome() {
  if (state.screen !== 'summary' || !['closed', 'expired'].includes(state.inspection?.status)) return;
  if (appConfig.mode === 'bridge' && state.inspection.finalMaterialized !== true) return;
  accessGeneration += 1;
  disposeQrScanner();
  scannerNavigationPending = false;
  sessionStorage.removeItem(sessionKey);
  Object.assign(state, {
    route: null, station: null, inspection: null, bridgeSession: null,
    week: isoWeekChile(new Date()), screen: 'qr', moduleIndex: 0, error: '',
    previousWeekAlert: null, scanError: '', scanNotice: '',
    qrValidationPending: false, qrAccessValidated: false, serverTime: null, serverCheckedAt: null,
    flashAvailable: false, flashOn: false, closing: false, closeProgress: null, photoUploads: 0,
    sessionId: crypto.randomUUID(), completedAt: '', uploadCache: new Map(), submissionState: {},
    syncStatus: appConfig.mode === 'bridge' ? 'Conectando' : 'Borrador local',
  });
  render();
  window.scrollTo?.({ top: 0, behavior: 'instant' });
}

function retryCamera() {
  disposeQrScanner();
  state.scanError = '';
  startQrScanner();
}

async function toggleFlashlight() {
  if (!qrScanner || !state.flashAvailable) return;
  const button = document.querySelector('#flash-toggle');
  try {
    if (qrScanner.isFlashOn()) await qrScanner.turnFlashOff();
    else await qrScanner.turnFlashOn();
    state.flashOn = qrScanner.isFlashOn();
    button?.setAttribute('aria-pressed', String(state.flashOn));
    button?.classList.toggle('is-on', state.flashOn);
    setScanFeedback(state.flashOn ? 'Linterna encendida.' : 'Linterna apagada.');
  } catch {
    setScanFeedback('La linterna no está disponible en esta cámara.', true);
  }
}

function scheduleMessage() {
  if (appConfig.mode === 'bridge' && !state.inspection?.startedAt) return '<div class="notice"><span class="notice-icon">i</span><span>El servidor comprobará el horario vigente de Chile al iniciar.</span></div>';
  const windowState = currentWindow();
  if (windowState === 'open') return '';
  if (windowState === 'late-continuation') return `<div class="notice"><span class="notice-icon">!</span><span>Solo puedes terminar una inspección ya iniciada. Al cerrar se registrará como <strong>cumplida con atraso</strong>.</span></div>`;
  return `<div class="notice danger"><span class="notice-icon">!</span><span>El horario de Chile para esta inspección está cerrado.</span></div>`;
}

function identityPage() {
  const unavailable = ['closed', 'expired'].includes(state.inspection?.status);
  const heldByOther = Boolean(state.inspection?.editor && state.inspection.editor.clientId !== state.clientId);
  const canStart = !state.qrValidationPending
    && navigator.onLine
    && !heldByOther
    && !unavailable
    && (appConfig.mode === 'bridge' ? displayedStatus(true).tone === 'green' : currentWindow() === 'open');
  const names = [...new Set([...state.knownInspectors, ...storageRead(namesKey, [])].map(name => String(name).trim()).filter(Boolean))]
    .map(name => `<option value="${esc(name)}"></option>`).join('');
  return `
    <section class="page-enter">
      <div class="eyebrow">Nueva inspección</div>
      <h1>Identifícate para comenzar</h1>
      <p class="lead">Completa la inspección sin cerrar esta página. Las respuestas y fotos se envían únicamente al cerrar.</p>
      <div class="field"><label for="inspector-name">Nombre del inspector</label><input class="input" id="inspector-name" list="known-inspectors" maxlength="80" autocomplete="name" value="${esc(state.inspectorName)}" placeholder="Escribe o selecciona tu nombre"><datalist id="known-inspectors">${names}</datalist><p class="hint">Si no apareces, escribe tu nombre y se agregará para próximas inspecciones.</p></div>
      <button class="primary" data-action="start" ${canStart && navigator.onLine ? '' : 'disabled'}>Iniciar inspección</button>
      ${appConfig.mode === 'bridge' && !state.qrAccessValidated ? '<div class="identity-recovery"><button class="help-link" type="button" data-action="rescan-qr">Volver a escanear QR</button></div>' : ''}
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
  return `<nav class="module-tabs" aria-label="Módulos de inspección">${activeModules().map((module, index) => {
    const complete = module.questions.every(question => Number.isInteger(state.inspection.answers[question.id]));
    return `<button class="module-tab ${index === state.moduleIndex ? 'active' : ''} ${complete ? 'done' : ''}" data-action="module" data-index="${index}">${esc(module.title)}</button>`;
  }).join('')}</nav>`;
}

function modulePage() {
  const module = activeModules()[state.moduleIndex];
  return `
    <section class="page-enter">
      <div class="eyebrow">Módulo ${state.moduleIndex + 1} de ${activeModules().length}</div>
      <h1>${esc(module.title)}</h1>
      <p class="lead">Selecciona de 0 a 5 hallazgos. Cada hallazgo necesita una fotografía; la nota descriptiva es opcional.</p>
      ${tabs()}${errorNotice()}
      ${state.photoUploads ? '<p class="hint" role="status">Preparando fotografía en el teléfono…</p>' : ''}
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
    return `<div class="finding"><div class="finding-top"><span class="finding-index">${ordinal}</span><span class="finding-status">${item.photoId ? item.photoId.startsWith('local-') ? 'Foto pendiente de envío' : 'Foto guardada' : 'Falta fotografía'}</span></div>
      <label class="camera-input">Tomar o elegir foto<input type="file" accept="image/*" capture="environment" data-action="finding-photo" data-question="${questionId}" data-ordinal="${ordinal}"></label>
      ${item.preview ? `<img class="photo-preview" src="${esc(item.preview)}" alt="Hallazgo ${ordinal}">` : ''}
      <textarea class="textarea" data-action="finding-note" data-question="${questionId}" data-ordinal="${ordinal}" placeholder="Nota del hallazgo (opcional)">${esc(item.note || '')}</textarea>
    </div>`;
  }).join('')}</div>`;
}

function moduleFooter() {
  const isLast = state.moduleIndex === activeModules().length - 1;
  const needsChoice = state.inspection.dailyManagementApplicable == null && state.moduleIndex === MODULES.length - 1;
  return `<p class="footer-note">Las notas se mostrarán solo después del cierre.</p><div class="button-row">${state.moduleIndex > 0 ? '<button class="secondary" data-action="previous-module">Módulo anterior</button>' : '<span></span>'}<button class="primary" data-action="${isLast ? 'review' : 'next-module'}">${needsChoice ? 'Continuar' : isLast ? 'Revisar cierre' : 'Siguiente módulo'}</button></div>`;
}

function dailyManagementChoicePage() {
  return `<section class="page-enter"><div class="eyebrow">25 preguntas 5S respondidas</div>
    <h1>Gerenciamiento Diario</h1><p class="lead">¿Corresponde evaluar Gerenciamiento Diario en esta estación o inspección?</p>
    <p>Si corresponde, responderás ocho preguntas adicionales. Su nota se registra por separado de la nota 5S.</p>
    ${errorNotice()}<div class="button-row"><button class="secondary" data-action="daily-management-no">No corresponde · Cerrar</button><button class="primary" data-action="daily-management-yes">Sí corresponde</button></div>
    <button class="secondary" data-action="back-to-module">Volver a las preguntas 5S</button></section>`;
}

function reviewOrChooseDailyManagement() {
  if (!QUESTIONS.every(q => Number.isInteger(state.inspection.answers[q.id]) && state.inspection.answers[q.id] >= 0 && state.inspection.answers[q.id] <= 5)) {
    state.error = 'Completa las 25 respuestas 5S antes de continuar.';
    state.screen = 'module';
  } else {
    state.error = '';
    state.screen = state.inspection.dailyManagementApplicable == null ? 'daily-management-choice' : 'review';
  }
  render();
}

function chooseDailyManagement(applicable) {
  if (!QUESTIONS.every(q => Number.isInteger(state.inspection.answers[q.id]))) return reviewOrChooseDailyManagement();
  if (applicable) {
    state.inspection = { ...state.inspection, dailyManagementApplicable: true };
    state.completedAt = '';
    state.error = '';
    state.moduleIndex = MODULES.length;
    state.screen = 'module';
    render();
  } else {
    // Keep the original intact until the user confirms the complete closure.
    const candidate = { ...state.inspection, dailyManagementApplicable: false, answers: { ...state.inspection.answers }, findings: { ...state.inspection.findings } };
    DAILY_MANAGEMENT.questions.forEach(q => { delete candidate.answers[q.id]; delete candidate.findings[q.id]; });
    close(candidate);
  }
}

function reviewPage() {
  if (state.closing) return closureProgressPage();
  const inspection = validateInspection(state.inspection.answers, state.inspection.findings, activeQuestions());
  const kaizen = validateKaizenReviews(state.inspection.pendingKaizen, state.inspection.kaizenReviews);
  const checks = [
    [`${activeQuestions().length} preguntas respondidas`, inspection.missingQuestions.length === 0 && inspection.invalidQuestions.length === 0],
    ['Aplicabilidad de Gerenciamiento Diario definida', typeof state.inspection.dailyManagementApplicable === 'boolean'],
    ['Una foto por cada hallazgo', inspection.missingPhotos.length === 0 && inspection.extraFindings.length === 0],
    ['Kaizen pendientes revisados', kaizen.canContinue],
  ];
  const ready = inspection.canClose && kaizen.canContinue && typeof state.inspection.dailyManagementApplicable === 'boolean';
  return `
    <section class="page-enter">
      <div class="eyebrow">Cierre de inspección</div><h1>${ready ? 'Lista para cerrar' : 'Revisa los faltantes'}</h1><p class="lead">Al cerrar, el QR de ${esc(stationName())} quedará bloqueado para esta semana.</p>
      ${checks.map(([label, complete]) => `<div class="check"><span class="check-mark ${complete ? 'done' : ''}">${complete ? '✓' : ''}</span><span>${label}</span></div>`).join('')}
      <button class="secondary" data-action="change-daily-management">Cambiar si corresponde Gerenciamiento Diario</button>
      ${!ready ? `<div class="notice"><span class="notice-icon">!</span><span>Completa los elementos pendientes antes de cerrar. No se mostrará una nota parcial.</span></div>` : ''}${errorNotice()}
    </section>
      ${state.photoUploads ? '<p class="hint" role="status">Preparando fotografía en el teléfono…</p>' : ''}
    ${footer(`<div class="button-row"><button class="secondary" data-action="back-to-module" ${state.closing ? 'disabled' : ''}>Volver a preguntas</button><button class="primary" data-action="close" ${ready && !state.closing && !state.photoUploads ? '' : 'disabled'}>${state.closing ? 'Guardando y cerrando…' : 'Cerrar inspección'}</button></div>`)}`;
}

function closureProgressPage() {
  const progress = state.closeProgress || { phase: 'saving', completed: 0, total: 0, message: 'Preparando cierre…' };
  const uploading = progress.phase === 'photos' && progress.total > 0;
  return `<section class="closure-progress page-enter" aria-live="polite" aria-busy="true"><div class="eyebrow">Cierre de inspección</div><h1>Guardando ${esc(stationName())}</h1><p class="lead">${esc(progress.message)}</p><progress ${uploading ? `value="${progress.completed}" max="${progress.total}" aria-label="Fotografías confirmadas"` : 'aria-label="Guardado en el servidor"'}></progress><p class="small">${progress.total ? `${progress.completed} de ${progress.total} fotografías confirmadas. ` : ''}Mantén esta página abierta. El resumen aparecerá cuando el guardado esté confirmado.</p></section>`;
}

function summaryPage() {
  if (!state.inspection?.result) return identityPage();
  return renderResultSummary({ inspection: state.inspection, stationName: stationName(), mode: appConfig.mode });
}

function footer(content) {
  return `<footer class="footer">${content}</footer>`;
}


function previousWeekNotice() {
  const alert = state.previousWeekAlert;
  if (!alert) return '';
  return `<div class="notice danger"><span class="notice-icon">!</span><span>La inspección de la semana pasada (${esc(alert.week)}) quedó cerrada incompleta, con nota 0 en todos los módulos. Responsable: ${esc(alert.responsibleName)}. La cerró ${esc(alert.closedBy)}.</span></div>`;
}

function render() {
  const activeElement = document.activeElement;
  const preserveInspectorFocus = activeElement?.id === 'inspector-name';
  const selectionStart = preserveInspectorFocus ? activeElement.selectionStart : null;
  const selectionEnd = preserveInspectorFocus ? activeElement.selectionEnd : null;
  if (preserveInspectorFocus) state.inspectorName = activeElement.value;
  let content;
  if (state.screen === 'scanner') content = scannerPage();
  else if (state.screen === 'station-opening') content = stationOpeningPage();
  else if (!state.route) content = qrPage();
  else if (state.screen === 'identity') content = identityPage();
  else if (state.screen === 'kaizen') content = kaizenPage();
  else if (state.screen === 'module') content = modulePage();
  else if (state.screen === 'daily-management-choice') content = dailyManagementChoicePage();
  else if (state.screen === 'review') content = reviewPage();
  else if (state.screen === 'summary') content = summaryPage();
  else content = qrPage();
  const mainClass = !state.route && state.screen === 'qr' ? 'home-main' : '';
  appElement.classList?.toggle('home-shell', !state.route && state.screen === 'qr');
  appElement.classList?.toggle('inspection-shell', Boolean(state.route) && !['scanner', 'station-opening'].includes(state.screen));
  appElement.classList?.toggle('summary-shell', state.screen === 'summary' && Boolean(state.inspection?.result));
  appElement.innerHTML = `${header()}<main class="${mainClass}">${state.screen === 'summary' ? '' : previousWeekNotice()}${content}</main>`;
  if (state.closing) appElement.querySelectorAll?.('input, textarea, button').forEach(control => { control.disabled = true; });
  if (preserveInspectorFocus && state.screen === 'identity') {
    const restoredInput = appElement.querySelector('#inspector-name');
    if (restoredInput) {
      restoredInput.focus({ preventScroll: true });
      if (selectionStart !== null && selectionEnd !== null) restoredInput.setSelectionRange(selectionStart, selectionEnd);
    }
  }
  scheduleStatusClock();
}

async function start() {
  const input = document.querySelector('#inspector-name');
  const name = input?.value.trim() || '';
  state.inspectorName = name;
  if (name.length < 2) {
    state.error = 'Escribe tu nombre para continuar.';
    render();
    return;
  }
  state.error = '';
  if (appConfig.mode === 'bridge' && navigator.onLine) {
    state.qrValidationPending = true;
    render();
  }
  try {
    state.inspection = createInspection({ stationId: state.route.stationId, week: state.week.key });
    if (appConfig.mode === 'bridge') {
      if (!navigator.onLine) throw new Error('Necesitas internet para iniciar la inspección.');
      {
        const receipt = await ensureBridgeSession().sendNow('begin-final', { inspectorName: name, sessionId: state.sessionId });
        if (!receipt?.state) throw new Error('No llegó confirmación del inicio. Inténtalo nuevamente.');
        state.inspection = receipt.state;
        recordServerClock(receipt);
        if (receipt.station?.id === state.route.stationId) state.station = receipt.station;
        if (Array.isArray(receipt.inspectorNames)) state.knownInspectors = receipt.inspectorNames;
        if (receipt.previousWeekAlert) state.previousWeekAlert = receipt.previousWeekAlert;
        state.syncStatus = 'Guardado al cerrar';
        state.qrAccessValidated = true;
      }
    } else {
      state.inspection = reserveInspection(state.inspection, { clientId: state.clientId, inspectorName: name, at: new Date().toISOString() });
    }
    state.inspectorName = name;
    state.qrValidationPending = false;
    rememberNames(name);
    state.error = '';
    if (['closed', 'expired'].includes(state.inspection.status)) {
      state.screen = state.inspection.status === 'closed' && state.inspection.finalSessionId === state.sessionId ? 'summary' : 'identity';
      if (state.screen === 'identity') state.error = 'La inspección de esta estación y semana ya está cerrada o vencida. No se puede iniciar otra.';
    } else {
      state.inspection.dailyManagementApplicable = null;
      state.screen = state.inspection.pendingKaizen.length ? 'kaizen' : 'module';
    }
    await draftSave();
    render();
  } catch (error) {
    state.qrValidationPending = false;
    state.qrAccessValidated = false;
    state.error = error.message;
    if (appConfig.mode === 'bridge' && navigator.onLine) {
      try {
        const receipt = await ensureBridgeSession().sendNow('final-state', { sessionId: state.sessionId });
        recordServerClock(receipt);
        if (receipt.station?.id === state.route.stationId) state.station = receipt.station;
        if (Array.isArray(receipt.inspectorNames)) state.knownInspectors = receipt.inspectorNames;
        if (receipt.state) state.inspection = receipt.state;
        state.qrAccessValidated = true;
        state.syncStatus = receipt.state?.status === 'closed' ? 'Guardado confirmado' : 'Listo para iniciar';
        state.scanNotice = `Estación ${state.station.name} verificada.`;
        if (state.inspection.status === 'closed' && state.inspection.finalSessionId === state.sessionId) {
          state.screen = 'summary';
          state.error = '';
        } else if (['closed', 'expired'].includes(state.inspection.status)) {
          state.screen = 'identity';
          state.error = 'La inspección de esta estación y semana ya está cerrada o vencida. No se puede iniciar otra.';
        } else if (state.inspection.editor && state.inspection.editor.clientId !== state.clientId) {
          state.screen = 'identity';
          state.error = '';
        }
      } catch {
        // Mantener el error original: esta consulta solo recupera el estado si el inicio fue rechazado.
      }
    }
    render();
  }
}


async function changeAnswer(questionId, count) {
  if (state.closing) return;
  const previousItems = state.inspection.findings[questionId] || [];
  if (count < previousItems.length && !window.confirm('Hay fotos asociadas que sobran. ¿Confirmas quitarlas de este borrador?')) return;
  try {
    state.error = '';
    state.inspection = saveAnswer(state.inspection, { clientId: state.clientId, questionId, count });
    if (count < previousItems.length) {
      state.inspection = discardExtraFindings(state.inspection, { clientId: state.clientId, questionId });
    }
    state.completedAt = '';
    await draftSave();
  } catch (error) {
    state.error = error.message;
  }
  render();
}

async function readImage(file) {
  return readImageForUpload(file);
}

async function addFindingPhoto(target) {
  const file = target.files?.[0];
  if (!file || state.closing) return;
  state.photoUploads += 1;
  render();
  try {
    state.error = '';
    const questionId = target.dataset.question;
    const ordinal = Number(target.dataset.ordinal);
    const preview = await readImage(file);
    const existing = state.inspection.findings[questionId]?.[ordinal - 1] || {};
    state.inspection = saveFinding(state.inspection, {
      clientId: state.clientId,
      questionId,
      ordinal,
      finding: { ...existing, id: existing.id || crypto.randomUUID(), photoId: `local-${crypto.randomUUID()}`, preview, dataUri: preview },
    });
    state.completedAt = '';
    await draftSave();
  } catch (error) {
    state.error = error.message;
  } finally {
    state.photoUploads -= 1;
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
  state.completedAt = '';
  persistDraftQuietly();
}


function setKaizenDecision(target) {
  const id = target.dataset.kaizen;
  const review = state.inspection.kaizenReviews[id] || {};
  state.inspection = { ...state.inspection, kaizenReviews: { ...state.inspection.kaizenReviews, [id]: { ...review, decision: target.dataset.decision } } };
  state.completedAt = '';
  persistDraftQuietly();
  render();
}

function setKaizenReason(target) {
  const review = state.inspection.kaizenReviews[target.dataset.kaizen] || {};
  state.inspection = { ...state.inspection, kaizenReviews: { ...state.inspection.kaizenReviews, [target.dataset.kaizen]: { ...review, reason: target.value } } };
  state.completedAt = '';
  persistDraftQuietly();
}

async function addKaizenPhoto(target) {
  const file = target.files?.[0];
  if (!file || state.closing) return;
  state.photoUploads += 1;
  render();
  try {
    const preview = await readImage(file);
    const id = target.dataset.kaizen;
    const review = state.inspection.kaizenReviews[id] || { decision: 'solved' };
    state.inspection = { ...state.inspection, kaizenReviews: { ...state.inspection.kaizenReviews, [id]: { ...review, photoId: `local-${crypto.randomUUID()}`, preview, dataUri: preview } } };
    state.completedAt = '';
    state.error = '';
    persistDraftQuietly();
  } catch (error) {
    state.error = error.message;
  } finally {
    state.photoUploads -= 1;
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
  state.error = '';
  state.screen = 'module';
  await draftSave();
  render();
}

async function close(candidate = state.inspection) {
  if (state.closing) return;
  if (state.photoUploads) {
    state.error = 'Espera a que termine de prepararse y guardarse la fotografía antes de cerrar.';
    render();
    return;
  }
  const completedAt = state.completedAt || inspectionNow().toISOString();
  state.closing = true;
  render();
  try {
    if (!state.completedAt && currentWindow() === 'closed') throw new Error('La inspección no puede cerrarse fuera del horario permitido.');
    inspectionQuestions(candidate);
    closeInspection(candidate, { clientId: state.clientId, at: completedAt, completionStatus: completionStatus() });
    const gdText = candidate.dailyManagementApplicable === true ? 'incluyendo Gerenciamiento Diario' : 'sin Gerenciamiento Diario (no aplica)';
    if (!window.confirm(`¿Confirmas cerrar la inspección de ${stationName()} ${gdText}? Se enviarán las respuestas y fotos y la estación quedará cerrada esta semana.`)) return;
    state.inspection = candidate;
    state.screen = 'review';
    state.closeProgress = { phase: 'saving', completed: 0, total: 0, message: 'Preparando cierre…' };
    window.scrollTo?.({ top: 0, behavior: 'instant' });
    if (appConfig.mode === 'bridge') {
      state.completedAt = completedAt;
      if (!navigator.onLine) throw new Error('Necesitas internet para cerrar. Mantén esta página abierta y reintenta cuando vuelva la conexión.');
      const receipt = await submitFinalInspection({ session: ensureBridgeSession(), inspection: state.inspection, sessionId: state.sessionId, occurredAt: completedAt, uploadCache: state.uploadCache,
        submissionState: state.submissionState, onProgress(message, detail) { state.syncStatus = message; state.closeProgress = { ...detail, message }; render(); } });
      state.inspection = receipt.state;
      state.syncStatus = 'Guardado confirmado';
      state.screen = 'summary';
    } else {
      state.inspection = closeInspection(state.inspection, { clientId: state.clientId, at: new Date().toISOString(), completionStatus: completionStatus() });
      state.screen = 'summary';
    }
    state.error = '';
    await draftSave();
  } catch (error) {
    state.error = error.message;
  } finally {
    state.closing = false;
  }
  render();
}

appElement.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'show-inspection-status') { render(); document.querySelector('#inspection-status-dialog')?.showModal(); return; }
  if (action === 'close-inspection-status') { document.querySelector('#inspection-status-dialog')?.close(); return; }
  if (action === 'retry-status') { document.querySelector('#inspection-status-dialog')?.close(); validateStationAccess(); return; }
  if (state.closing) return;
  if (action === 'return-home') returnToHome();
  if (action === 'open-scanner') openScanner();
  if (action === 'rescan-qr') openScanner();
  if (action === 'close-scanner') closeScanner();
  if (action === 'retry-camera') retryCamera();
  if (action === 'toggle-flash') toggleFlashlight();
  if (action === 'show-scan-help') document.querySelector('#scan-help-dialog')?.showModal();
  if (action === 'close-scan-help') document.querySelector('#scan-help-dialog')?.close();
  if (action === 'start') start();
  if (action === 'answer') changeAnswer(target.dataset.question, Number(target.dataset.count));
  if (action === 'module') { state.moduleIndex = Number(target.dataset.index); state.screen = 'module'; persistDraftQuietly(); render(); }
  if (action === 'previous-module') { state.moduleIndex -= 1; persistDraftQuietly(); render(); }
  if (action === 'next-module') { state.moduleIndex += 1; persistDraftQuietly(); render(); }
  if (action === 'review') reviewOrChooseDailyManagement();
  if (action === 'daily-management-yes') chooseDailyManagement(true);
  if (action === 'daily-management-no') chooseDailyManagement(false);
  if (action === 'change-daily-management') { state.moduleIndex = MODULES.length - 1; state.screen = 'daily-management-choice'; render(); }
  if (action === 'back-to-module') { state.screen = 'module'; render(); }
  if (action === 'close') close();
  if (action === 'kaizen-decision') setKaizenDecision(target);
  if (action === 'continue-kaizen') continueKaizen();
});

appElement.addEventListener('change', event => {
  if (state.closing) return;
  const target = event.target;
  if (target.dataset.action === 'finding-photo') addFindingPhoto(target);
  if (target.dataset.action === 'kaizen-photo') addKaizenPhoto(target);
});

appElement.addEventListener('input', event => {
  if (state.closing) return;
  const target = event.target;
  if (target.id === 'inspector-name') state.inspectorName = target.value;
  if (target.dataset.action === 'finding-note') setFindingNote(target);
  if (target.dataset.action === 'kaizen-reason') setKaizenReason(target);
});

window.addEventListener('online', async () => {
  if (state.screen === 'identity') await validateStationAccess();
  else render();
});
window.addEventListener('offline', render);
window.addEventListener('focus', () => { if (state.screen === 'identity') render(); });
window.addEventListener('pagehide', disposeQrScanner);
window.addEventListener('beforeunload', event => {
  if (state.inspection?.status === 'open') {
    event.preventDefault();
    event.returnValue = 'La inspección aún no se ha enviado. Si sales tendrás que comenzar nuevamente.';
  }
});

initializeApp();
