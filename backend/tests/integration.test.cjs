const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { writeCoreFile } = require('../build-core.cjs');

writeCoreFile();
const base = path.join(__dirname, '..');
const source = ['deploy/Core.gs', 'Service.gs', 'Code.gs'].map(file => fs.readFileSync(path.join(base, file), 'utf8')).join('\n');

function iterator(values) {
  let index = 0;
  return { hasNext: () => index < values.length, next: () => values[index++] };
}

function harness() {
  let nextId = 1;
  const props = {};
  const books = new Map();
  const files = new Map();
  class Sheet {
    constructor(book, name) { this.book = book; this.name = name; this.rows = []; this.formatCalls = []; this.filterCreated = false; this.rowHeights = {}; this.columnWidths = {}; }
    getName() { return this.name; }
    setName(name) { delete this.book.sheets[this.name]; this.name = name; this.book.sheets[name] = this; }
    setFrozenRows() {}
    getLastRow() { return this.rows.length; }
    getMaxRows() { return 1000; }
    setRowHeight(row, height) { this.rowHeights[row] = height; }
    setColumnWidths(start, count, width) { for (let i = start; i < start + count; i++) this.columnWidths[i] = width; }
    setColumnWidth(column, width) { this.columnWidths[column] = width; }
    getFilter() { return this.filterCreated ? { setRange() {} } : null; }
    getRange(row, col, height, width) {
      const range = {
        getValues: () => Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => this.rows[row - 1 + r]?.[col - 1 + c] ?? '')),
        setValues: values => values.forEach((line, r) => line.forEach((cell, c) => { (this.rows[row - 1 + r] ||= [])[col - 1 + c] = cell; })),
        setValue: value => { (this.rows[row - 1] ||= [])[col - 1] = value; },
        setBackground: value => record('setBackground', value),
        setFontColor: value => record('setFontColor', value),
        setFontWeight: value => record('setFontWeight', value),
        setWrap: value => record('setWrap', value),
        setVerticalAlignment: value => record('setVerticalAlignment', value),
        setNotes: value => record('setNotes', value),
        setDataValidation: value => record('setDataValidation', value),
        createFilter: () => { this.filterCreated = true; return { setRange() {} }; },
      };
      const record = (method, value) => { this.formatCalls.push({ method, row, col, height, width, value }); return range; };
      return range;
    }
    appendRow(row) { this.rows.push([...row]); }
  }
  class Folder {
    constructor(name) { this.name = name; this.id = `folder-${nextId++}`; this.folders = []; this.files = []; }
    getId() { return this.id; }
    getFoldersByName(name) { return iterator(this.folders.filter(folder => folder.name === name)); }
    getFilesByName(name) { return iterator(this.files.filter(file => file.name === name)); }
    createFolder(name) { const folder = new Folder(name); this.folders.push(folder); return folder; }
    createFile(blob) { const file = { id: `file-${nextId++}`, name: blob.name, getId() { return this.id; }, getBlob: () => blob }; this.files.push(file); files.set(file.id, file); return file; }
  }
  const root = new Folder('Mi unidad');
  root.createFolder('INSPECCIONES 5S');
  const SpreadsheetApp = {
    create: name => {
      const id = `sheet-${nextId++}`;
      const book = { id, name, sheets: {}, getId: () => id, getSheets() { return Object.values(this.sheets); }, getSheetByName(name) { return this.sheets[name] || null; }, insertSheet(name) { const sheet = new Sheet(this, name); this.sheets[name] = sheet; return sheet; } };
      book.insertSheet('Sheet1');
      books.set(id, book);
      files.set(id, { id, name, getId: () => id, moveTo: folder => folder.files.push(files.get(id)) });
      return book;
    },
    openById: id => books.get(id),
    flush: () => {},
    newDataValidation: () => {
      const rule = {};
      const builder = {
        requireCheckbox() { rule.type = 'checkbox'; return builder; },
        requireNumberBetween(min, max) { rule.type = 'number-between'; rule.min = min; rule.max = max; return builder; },
        setAllowInvalid(value) { rule.allowInvalid = value; return builder; },
        build() { return { ...rule }; },
      };
      return builder;
    },
  };
  const DriveApp = {
    getRootFolder: () => root,
    getFolderById: id => {
      const find = folder => folder.id === id ? folder : folder.folders.map(find).find(Boolean);
      return find(root);
    },
    getFileById: id => files.get(id),
  };
  const context = {
    app5sTestNow: '2026-09-21T11:15:00Z',
    Date, Intl, Object, Number, Array, Map, Set, String, RegExp, Error, TypeError, RangeError, JSON,
    SpreadsheetApp, DriveApp,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key] || '', setProperties: values => Object.assign(props, values) }) },
    Session: { getActiveUser: () => ({ getEmail: () => 'ivan.vivanco@deteco.cl' }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: {
      getUuid: () => `${String(nextId++).padStart(8, '0')}-1234-1234-1234-123456789abc`,
      base64Decode: value => Array.from(Buffer.from(value, 'base64')),
      base64Encode: bytes => Buffer.from(bytes).toString('base64'),
      newBlob: (value, mime, name) => ({
        name, mime,
        getBytes: () => Array.isArray(value) ? value : Array.from(Buffer.from(String(value), 'utf8')),
        getDataAsString: () => Buffer.from(Array.isArray(value) ? value : String(value), Array.isArray(value) ? undefined : 'utf8').toString('utf8'),
      }),
    },
  };
  const api = vm.runInNewContext(`${source}\napp5sNow_ = () => new Date(app5sTestNow);\n({ instalarApp5SCompleta, app5sHandle_, app5sAdminAddWork, QUESTIONS })`, context);
  return { api, props, root, books, setNow: value => { context.app5sTestNow = value; } };
}

function accessFor(h, stationId) {
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  return book.getSheetByName('Accesos').rows.find(row => row[0] === stationId)[1];
}

function call(h, operation, payload) {
  return h.api.app5sHandle_(operation, payload, { requestId: 'r'.repeat(24), nonce: 'n'.repeat(24), receivedAt: '2026-09-21T11:15:00Z' });
}

test('la instalación da formato a Configuracion y prepara las validaciones para los datos pendientes', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const config = h.books.get(h.props.APP5S_SHEET_ID).getSheetByName('Configuracion');
  assert.ok(config.formatCalls.some(call => call.method === 'setBackground' && call.value === '#F26522'));
  assert.ok(config.formatCalls.some(call => call.method === 'setFontColor' && call.value === '#FFFFFF'));
  assert.ok(config.formatCalls.some(call => call.method === 'setNotes'));
  assert.equal(config.formatCalls.filter(call => call.method === 'setDataValidation').length, 4);
  assert.equal(config.filterCreated, true);
});

test('el alta de una obra crea una estación, habilita su acceso y devuelve su QR cuando hay URL pública', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  h.props.APP5S_FRONTEND_URL = 'https://deteco.github.io/inspecciones-lean/';
  const result = h.api.app5sAdminAddWork({ name: 'Obra Parque Norte' });
  const book = h.books.get(h.props.APP5S_SHEET_ID);

  assert.equal(result.stationId, 'obra-parque-norte');
  assert.equal(result.stationName, 'OBRA PARQUE NORTE');
  assert.ok(book.getSheetByName('OBRA PARQUE NORTE'));
  assert.equal(book.getSheetByName('Configuracion').rows.find(row => row[0] === result.stationId)[4], true);
  const access = book.getSheetByName('Accesos').rows.find(row => row[0] === result.stationId);
  assert.equal(access[2], true);
  assert.match(result.qrUrl, /^https:\/\/deteco\.github\.io\/inspecciones-lean\/#station=obra-parque-norte&token=[A-Za-z0-9_-]{64}$/);
  assert.ok(result.snapshot.stations.some(station => station.stationId === result.stationId && station.qrUrl === result.qrUrl));
  assert.ok(book.getSheetByName('Auditoria').rows.some(row => row[1] === 'ADMIN_CREA_ESTACION' && row[2] === result.stationId));
});

test('el alta de una obra rechaza nombres que duplican una estación existente', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  assert.throws(() => h.api.app5sAdminAddWork({ name: '  obra   santa julia  ' }), /Ya existe una estación/i);
  assert.equal(h.books.get(h.props.APP5S_SHEET_ID).getSheets().filter(sheet => sheet.name === 'OBRA SANTA JULIA').length, 1);
});

test('el autocompletado evita duplicar inspectores por tildes o espacios repetidos', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  const bodega = { stationId: 'bodega', accessToken: accessFor(h, 'bodega'), clientId: 'phone-a' };
  const hormigon = { stationId: 'hormigon', accessToken: accessFor(h, 'hormigon'), clientId: 'phone-b' };
  call(h, 'reserve', { ...bodega, inspectorName: 'José Pérez' });
  call(h, 'reserve', { ...hormigon, inspectorName: 'Jose  Perez' });
  const names = call(h, 'state', { stationId: 'oficina', accessToken: accessFor(h, 'oficina') }).inspectorNames;

  assert.deepEqual(JSON.parse(JSON.stringify(names)), ['José Pérez']);
  assert.equal(book.getSheetByName('Inspectores').rows.length, 2);
  assert.equal(book.getSheetByName('Inspectores').rows[1][3], 2);
});

test('la ruta completa guarda la inspección y la foto una sola vez en Sheet y Drive', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const setupBook = h.books.get(h.props.APP5S_SHEET_ID);
  assert.ok(setupBook.getSheetByName('Administradores'), 'debe quedar lista la pestaña para completar los administradores');
  assert.ok(setupBook.getSheetByName('Política de datos'), 'debe quedar documentada la retención anual pendiente de confirmación');
  assert.ok(setupBook.getSheetByName('Inspectores'), 'debe guardar la lista compartida de inspectores');
  const token = accessFor(h, 'bodega');
  const basePayload = { stationId: 'bodega', accessToken: token, clientId: 'phone-a' };
  call(h, 'reserve', { ...basePayload, inspectorName: 'Ana Pérez' });
  const officeToken = accessFor(h, 'oficina');
  const names = call(h, 'state', { stationId: 'oficina', accessToken: officeToken, clientId: 'phone-b' });
  assert.deepEqual(JSON.parse(JSON.stringify(names.inspectorNames)), ['Ana Pérez']);
  call(h, 'save-answer', { ...basePayload, questionId: 'SEP-01', count: 1 });
  const finding = { id: 'finding-12345678', dataUri: 'data:image/jpeg;base64,AAAA', note: 'Pasillo con obstáculo' };
  const saved = call(h, 'save-finding', { ...basePayload, questionId: 'SEP-01', ordinal: 1, finding });
  assert.match(saved.state.findings['SEP-01'][0].photoId, /^file-/);
  call(h, 'save-answer', { ...basePayload, questionId: 'SEP-01', count: 0 });
  const withoutFinding = call(h, 'discard-extra-findings', { ...basePayload, questionId: 'SEP-01' });
  assert.deepEqual(withoutFinding.state.findings['SEP-01'], []);
  call(h, 'save-answer', { ...basePayload, questionId: 'SEP-01', count: 1 });
  call(h, 'save-finding', { ...basePayload, questionId: 'SEP-01', ordinal: 1, finding });
  h.api.QUESTIONS.filter(question => question.id !== 'SEP-01').forEach(question => call(h, 'save-answer', { ...basePayload, questionId: question.id, count: 0 }));
  const closed = call(h, 'close', basePayload);
  assert.equal(closed.state.status, 'closed');
  assert.equal(closed.state.result.finalScore, 4.95);
  assert.equal(closed.state.accessToken, undefined);
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  assert.equal(book.getSheetByName('Inspecciones').rows.length, 2);
  assert.equal(book.getSheetByName('Respuestas').rows.length, 26);
  assert.equal(book.getSheetByName('Hallazgos').rows.length, 2);
  assert.equal(book.getSheetByName('Kaizen').rows.length, 2);
  assert.equal(book.getSheetByName('Kaizen').rows[1][2], 'open');
  h.setNow('2026-09-28T11:15:00Z');
  const nextWeek = call(h, 'state', { stationId: 'bodega', accessToken: token });
  assert.equal(nextWeek.state.pendingKaizen.length, 1);
  assert.equal(nextWeek.state.pendingKaizen[0].id, 'K-finding-12345678');
  const root = h.root.getFoldersByName('INSPECCIONES 5S').next();
  assert.equal(root.getFoldersByName('BODEGA').next().getFoldersByName('2026-09').next().getFoldersByName('2026-W39').next().getFoldersByName('Hallazgos').next().files.length, 1);
});

test('la respuesta aparece en la pestaña de su estación mientras la inspección sigue abierta', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const token = accessFor(h, 'bodega');
  const payload = { stationId: 'bodega', accessToken: token, clientId: 'phone-a' };
  call(h, 'reserve', { ...payload, inspectorName: 'Ana Pérez' });
  call(h, 'save-answer', { ...payload, questionId: 'SEP-01', count: 1 });

  const book = h.books.get(h.props.APP5S_SHEET_ID);
  const station = book.getSheetByName('BODEGA');
  assert.ok(station, 'debe existir la pestaña dedicada a BODEGA');
  assert.equal(station.rows.length, 2, 'debe crear una fila semanal antes del cierre');
  const headers = station.rows[0];
  assert.equal(station.rows[1][headers.indexOf('SEP-01 · Hallazgos')], 1);
  assert.equal(station.rows[1][headers.indexOf('SEP-01 · Puntos')], 4);
  assert.equal(station.rows[1][headers.indexOf('Responsable inicial')], 'Ana Pérez');
  assert.equal(book.getSheetByName('Respuestas').rows.length, 2);
});

test('un teléfono sin reserva no puede subir una foto a Drive', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const token = accessFor(h, 'bodega');
  const owner = { stationId: 'bodega', accessToken: token, clientId: 'phone-a' };
  call(h, 'reserve', { ...owner, inspectorName: 'Ana Pérez' });
  call(h, 'save-answer', { ...owner, questionId: 'SEP-01', count: 1 });

  assert.throws(() => call(h, 'save-finding', {
    stationId: 'bodega', accessToken: token, clientId: 'phone-b', questionId: 'SEP-01', ordinal: 1,
    finding: { id: 'finding-unauthorized', dataUri: 'data:image/jpeg;base64,AAAA' },
  }), /reserva/i);
  const root = h.root.getFoldersByName('INSPECCIONES 5S').next();
  assert.equal(root.getFoldersByName('BODEGA').hasNext(), false);
});

test('un cierre sincronizado el viernes conserva la hora válida del teléfono del jueves', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const token = accessFor(h, 'bodega');
  const basePayload = { stationId: 'bodega', accessToken: token, clientId: 'phone-a' };
  call(h, 'reserve', { ...basePayload, inspectorName: 'Ana Pérez', occurredAt: '2026-09-21T11:15:00Z' });
  h.setNow('2026-09-25T15:00:00Z');
  assert.equal(call(h, 'state', basePayload).state.status, 'expired');
  h.api.QUESTIONS.forEach(question => call(h, 'save-answer', {
    ...basePayload, questionId: question.id, count: 0, occurredAt: '2026-09-24T14:30:00Z',
  }));

  const closed = call(h, 'close', { ...basePayload, occurredAt: '2026-09-24T14:59:00Z' });
  assert.equal(closed.state.status, 'closed');
  assert.equal(closed.state.closedAt, '2026-09-24T14:59:00.000Z');
  assert.equal(closed.state.result.completionStatus, 'cumplida');
});

test('la primera inspección de la semana cierra la anterior sin inicio a nombre del encargado del área', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  h.setNow('2026-09-28T11:15:00Z');
  const token = accessFor(h, 'bodega');
  const current = call(h, 'reserve', {
    stationId: 'bodega', accessToken: token, clientId: 'phone-current', inspectorName: 'Bruno Díaz', occurredAt: '2026-09-28T11:15:00Z',
  });

  assert.equal(current.previousWeekAlert.week, '2026-W39');
  assert.equal(current.previousWeekAlert.responsibleName, 'Sin encargado asignado');
  assert.equal(current.previousWeekAlert.closedBy, 'Bruno Díaz');
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  const history = book.getSheetByName('Inspecciones').rows.find(row => row[0] === 'bodega:2026-W39');
  assert.equal(history[3], 'expired');
  assert.equal(history[8], 0);
  assert.equal(history[9], 'vencida-cerrada-incompleta');
  assert.equal(history[10], 'Sin encargado asignado');
});
