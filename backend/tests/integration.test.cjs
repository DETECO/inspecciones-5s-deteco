const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { writeCoreFile } = require('../build-core.cjs');

writeCoreFile();
const base = path.join(__dirname, '..');
const source = ['deploy/Core.gs', 'Service.gs', 'FinalSubmission.gs', 'Code.gs'].map(file => fs.readFileSync(path.join(base, file), 'utf8')).join('\n');

function iterator(values) {
  let index = 0;
  return { hasNext: () => index < values.length, next: () => values[index++] };
}

function harness() {
  let nextId = 1;
  let activeEmail = 'ivan.vivanco@deteco.cl';
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
    constructor(name, parent = null) { this.name = name; this.id = `folder-${nextId++}`; this.parent = parent; this.folders = []; this.files = []; }
    getId() { return this.id; }
    getParents() { return iterator(this.parent ? [this.parent] : []); }
    getFoldersByName(name) { return iterator(this.folders.filter(folder => folder.name === name)); }
    getFilesByName(name) { return iterator(this.files.filter(file => file.name === name)); }
    createFolder(name) { const folder = new Folder(name, this); this.folders.push(folder); return folder; }
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
    getFileById: id => {
      const file = files.get(id);
      if (!file) throw new Error('Drive internal missing file');
      return file;
    },
  };
  const context = {
    app5sTestNow: '2026-09-21T11:15:00Z',
    Date, Intl, Object, Number, Array, Map, Set, String, RegExp, Error, TypeError, RangeError, JSON,
    SpreadsheetApp, DriveApp,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key] || '', setProperties: values => Object.assign(props, values), getProperties: () => ({ ...props }), setProperty: (key, value) => { props[key] = value; }, deleteProperty: key => { delete props[key]; } }) },
    Session: { getActiveUser: () => ({ getEmail: () => activeEmail }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_, value) => [...crypto.createHash('sha256').update(value).digest()],
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
  const api = vm.runInNewContext(`${source}\napp5sNow_ = () => new Date(app5sTestNow);\n({ instalarApp5SCompleta, app5sHandle_, app5sAdminAddWork, app5sAdminRelease, app5sAdminState, app5sAdminKaizenState: typeof app5sAdminKaizenState === 'function' ? app5sAdminKaizenState : null, app5sAdminKaizenPhoto: typeof app5sAdminKaizenPhoto === 'function' ? app5sAdminKaizenPhoto : null, app5sAdminPermissions_, app5sRequireAdminEmail_, app5sSavePhoto_, QUESTIONS })`, context);
  return {
    api, props, root, books,
    setNow: value => { context.app5sTestNow = value; },
    setEmail: value => { activeEmail = value; },
    addDrivePhoto: (id, mime, bytes, parentFolder = DriveApp.getFolderById(props.APP5S_FOLDER_ID)) => {
      const file = {
        id,
        getParents: () => iterator(parentFolder ? [parentFolder] : []),
        getBlob: () => ({ getContentType: () => mime, getBytes: () => bytes }),
      };
      files.set(id, file);
      if (parentFolder) parentFolder.files.push(file);
      return file;
    },
  };
}

function accessFor(h, stationId) {
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  return book.getSheetByName('Accesos').rows.find(row => row[0] === stationId)[1];
}

function call(h, operation, payload) {
  return h.api.app5sHandle_(operation, payload, { requestId: 'r'.repeat(24), nonce: 'n'.repeat(24), receivedAt: '2026-09-21T11:15:00Z' });
}

test('flujo final real: inicio y foto no escriben Sheet; cierre completo materializa una sola vez', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  const input = { stationId: 'oficina', accessToken: accessFor(h, 'oficina'), clientId: 'phone-a', sessionId: 'final-session-12345678', inspectorName: 'Prueba final' };
  const before = JSON.stringify(Object.fromEntries(Object.entries(book.sheets).map(([name, sheet]) => [name, sheet.rows])));
  const begun = call(h, 'begin-final', input);
  assert.equal(begun.state.status, 'open');
  assert.throws(() => call(h, 'begin-final', { ...input, clientId: 'phone-b' }), /reserva/);
  const photo = call(h, 'upload-final-photo', { ...input, photoId: 'finding-final-1234', category: 'Hallazgos', dataUri: 'data:image/jpeg;base64,AAAA' });
  assert.match(photo.photoId, /^file-/);
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(book.sheets).map(([name, sheet]) => [name, sheet.rows]))), before);
  const answers = Object.fromEntries(h.api.QUESTIONS.map(q => [q.id, q.id === 'SEP-01' ? 1 : 0]));
  const completed = { ...input, answers, findings: { 'SEP-01': [{ id: 'finding-final-1234', photoId: photo.photoId, note: 'Hallazgo de prueba' }] }, kaizenReviews: {}, occurredAt: '2026-09-21T11:15:00Z' };
  const closed = call(h, 'submit-final', completed);
  assert.equal(closed.state.finalSessionId, input.sessionId);
  assert.equal(closed.state.status, 'closed');
  const after = JSON.stringify(Object.fromEntries(Object.entries(book.sheets).map(([name, sheet]) => [name, sheet.rows])));
  call(h, 'submit-final', completed);
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(book.sheets).map(([name, sheet]) => [name, sheet.rows]))), after);
  assert.equal(book.getSheetByName('Inspecciones').rows.length, 2);
  assert.equal(book.getSheetByName('Respuestas').rows.length, 26);
  assert.equal(book.getSheetByName('Hallazgos').rows.length, 2);
});

test('administración muestra y libera reserva nueva sin escribir ni borrar respuestas', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const input = { stationId: 'oficina', accessToken: accessFor(h, 'oficina'), clientId: 'phone-a', sessionId: 'final-session-12345678', inspectorName: 'Prueba final' };
  call(h, 'begin-final', input);
  const snapshot = h.api.app5sAdminState();
  const office = snapshot.stations.find(item => item.stationId === 'oficina');
  assert.equal(office.editorName, 'Prueba final');
  assert.equal(office.status, 'open');
  h.api.app5sAdminRelease({ stationId: 'oficina', week: snapshot.week, expectedEditorId: 'phone-a', confirmed: true });
  assert.throws(() => call(h, 'upload-final-photo', { ...input, photoId: 'finding-final-1234', category: 'Hallazgos', dataUri: 'data:image/jpeg;base64,AAAA' }), /reserva/);
  assert.equal(call(h, 'begin-final', { ...input, clientId: 'phone-b', sessionId: 'other-session-123456' }).state.status, 'open');
});

test('GD final se registra en Sheet, crea Kaizen visible y ordena foto por mes y semana ISO', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  const input = { stationId: 'bodega', accessToken: accessFor(h, 'bodega'), clientId: 'phone-a', sessionId: 'gd-session-12345678', inspectorName: 'Prueba GD' };
  call(h, 'begin-final', input);
  const photo = call(h, 'upload-final-photo', { ...input, photoId: 'finding-gd-1234', category: 'Hallazgos', dataUri: 'data:image/jpeg;base64,AAAA' });
  assert.equal(book.getSheetByName('Respuestas').rows.length, 1);
  const answers = Object.fromEntries(h.api.QUESTIONS.map(q => [q.id, 0]));
  for (let i = 1; i <= 8; i++) answers[`GD-0${i}`] = i === 1 ? 1 : 0;
  const completed = { ...input, dailyManagementApplicable: true, answers, findings: { 'GD-01': [{ id: 'finding-gd-1234', photoId: photo.photoId, note: 'Falta tablero GD' }] }, kaizenReviews: {}, occurredAt: '2026-09-21T11:15:00Z' };
  const closed = call(h, 'submit-final', completed).state;
  assert.equal(closed.dailyManagementApplicable, true);
  assert.equal(closed.result.finalScore, 5);
  assert.equal(closed.result.dailyManagement.score, 4.875);
  assert.equal(book.getSheetByName('Respuestas').rows.length, 34);
  assert.equal(book.getSheetByName('Puntajes modulo').rows.length, 7);
  const item = h.api.app5sAdminKaizenState({ stationId: 'bodega', status: 'all' }).items[0];
  assert.equal(item.questionText, '¿Existe tablero GD logístico según el estándar definido por la organización?');
  assert.equal(item.moduleTitle, 'GERENCIAMIENTO DIARIO');
  const folder = h.root.getFoldersByName('INSPECCIONES 5S').next().getFoldersByName('BODEGA').next().getFoldersByName('2026-09').next().getFoldersByName('2026-W39').next().getFoldersByName('Hallazgos').next();
  assert.equal(folder.files.length, 1);
  const beforeRetry = JSON.stringify(Object.fromEntries(Object.entries(book.sheets).map(([name, sheet]) => [name, sheet.rows])));
  call(h, 'submit-final', completed);
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(book.sheets).map(([name, sheet]) => [name, sheet.rows]))), beforeRetry);
});

test('un administrador activo de solo lectura puede ver el panel, pero no liberar ni configurar', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  book.getSheetByName('Administradores').appendRow([
    'prueba-kaizen-lectura@deteco.cl', 'Usuario de lectura', true, false, false, 'Solo lectura del panel y Kaizen',
  ]);
  h.setEmail('prueba-kaizen-lectura@deteco.cl');

  const snapshot = h.api.app5sAdminState();

  assert.deepEqual(JSON.parse(JSON.stringify(snapshot.permissions)), {
    canView: true, canRelease: false, canConfigure: false,
  });
  assert.ok(snapshot.stations.every(station => !station.qrUrl), 'solo lectura no expone enlaces QR');
  assert.throws(() => h.api.app5sAdminRelease({
    stationId: 'oficina', week: '2026-W39', confirmed: true, expectedEditorId: 'phone-a',
  }), /no tiene permiso para liberar estaciones/i);
  assert.throws(() => h.api.app5sAdminAddWork({ name: 'Obra solo lectura' }), /no tiene permiso para cambiar la configuración/i);
});

test('el panel Kaizen entrega filtros ISO, datos del hallazgo y revisiones por estación', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  const kaizenId = 'K-panel-12345678';
  const findingId = 'finding-panel-12345678';
  const findingPhotoId = 'photo-finding-12345678';
  const closurePhotoId = 'photo-closure-12345678';
  const rootFolder = h.root.getFoldersByName('INSPECCIONES 5S').next();
  const nestedPhotoFolder = rootFolder.createFolder('BODEGA').createFolder('2026-09').createFolder('2026-W40').createFolder('Cierres kaizen');
  h.addDrivePhoto(findingPhotoId, 'image/jpeg', [1, 2, 3], nestedPhotoFolder);
  h.addDrivePhoto(closurePhotoId, 'image/png', [4, 5, 6], nestedPhotoFolder);
  book.getSheetByName('Kaizen').appendRow([
    kaizenId, 'bodega', 'open', 'SEP-01', findingId, '', 'Encargado Bodega', '2026-09-21T12:00:00.000Z', '',
  ]);
  book.getSheetByName('Hallazgos').appendRow([
    findingId, 'bodega:2026-W39', 'bodega', '2026-W39', 'SEP-01', 1, findingPhotoId, 'Pasillo con material fuera de lugar', kaizenId, 'open',
  ]);
  book.getSheetByName('Revision Kaizen').appendRow([
    `${kaizenId}:2026-W40`, kaizenId, 'bodega', '2026-W40', 'solved', 'Material retirado y sector ordenado.', closurePhotoId, '2026-09-28T12:00:00.000Z',
  ]);
  book.getSheetByName('Administradores').appendRow([
    'prueba-kaizen-lectura@deteco.cl', 'Usuario de lectura', true, false, false, 'Solo lectura del panel y Kaizen',
  ]);
  h.setEmail('prueba-kaizen-lectura@deteco.cl');

  const result = h.api.app5sAdminKaizenState({ stationId: 'bodega', status: 'all' });
  const item = result.items.find(row => row.id === kaizenId);

  assert.equal(result.stationId, 'bodega');
  assert.equal(result.status, 'all');
  assert.equal(item.stationName, 'BODEGA');
  assert.equal(item.questionText, '¿Está el área de trabajo libre de artículos innecesarios?');
  assert.equal(item.moduleTitle, 'SEPARAR');
  assert.equal(item.ownerName, 'Encargado Bodega');
  assert.equal(item.findings[0].week, '2026-W39');
  assert.equal(item.findings[0].note, 'Pasillo con material fuera de lugar');
  assert.equal(item.findings[0].evidenceId, findingId);
  assert.equal(item.findings[0].hasPhoto, true);
  assert.equal(item.reviews[0].evidenceId, `${kaizenId}:2026-W40`);
  assert.equal(item.reviews[0].hasPhoto, true);
  assert.equal(JSON.stringify(result).includes(findingPhotoId), false, 'la respuesta no expone IDs internos de Drive');
  assert.equal(item.reviews[0].week, '2026-W40');
  assert.equal(JSON.stringify(result).includes(closurePhotoId), false, 'tampoco expone IDs de fotos de cierre');
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.app5sAdminKaizenState({ stationId: 'oficina', status: 'all' }).items)), []);

  assert.equal(
    h.api.app5sAdminKaizenPhoto({ kaizenId, evidenceId: findingId }),
    'data:image/jpeg;base64,AQID',
  );
  assert.equal(
    h.api.app5sAdminKaizenPhoto({ kaizenId, evidenceId: `${kaizenId}:2026-W40` }),
    'data:image/png;base64,BAUG',
  );
  assert.throws(() => h.api.app5sAdminKaizenPhoto({ kaizenId, evidenceId: 'unrelated-photo-12345678' }), /no pertenece a este Kaizen/i);
});

test('el visor Kaizen rechaza fotos fuera de la raíz 5S y oculta los errores internos de Drive', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  const kaizenId = 'K-root-check-12345678';
  const evidenceId = 'finding-root-check-12345678';
  const outsidePhotoId = 'photo-outside-root-12345678';
  h.addDrivePhoto(outsidePhotoId, 'image/jpeg', [1, 2, 3], h.root);
  book.getSheetByName('Kaizen').appendRow([kaizenId, 'bodega', 'open', 'SEP-01', evidenceId, '', 'Encargado', '2026-W39', '']);
  book.getSheetByName('Hallazgos').appendRow([
    evidenceId, 'bodega:2026-W39', 'bodega', '2026-W39', 'SEP-01', 1, outsidePhotoId, '', kaizenId, 'open',
  ]);
  assert.throws(() => h.api.app5sAdminKaizenPhoto({ kaizenId, evidenceId }), /no pertenece a la carpeta 5S/i);

  book.getSheetByName('Hallazgos').rows[1][6] = 'missing-drive-file-12345678';
  assert.throws(() => h.api.app5sAdminKaizenPhoto({ kaizenId, evidenceId }), /fotografía ya no está disponible/i);

  const badMimeId = 'photo-invalid-mime-12345678';
  h.addDrivePhoto(badMimeId, 'application/pdf', [1]);
  book.getSheetByName('Hallazgos').rows[1][6] = badMimeId;
  assert.throws(() => h.api.app5sAdminKaizenPhoto({ kaizenId, evidenceId }), /no es una fotografía compatible/i);

  const oversizedId = 'photo-oversized-12345678';
  h.addDrivePhoto(oversizedId, 'image/jpeg', new Array(1572865).fill(1));
  book.getSheetByName('Hallazgos').rows[1][6] = oversizedId;
  assert.throws(() => h.api.app5sAdminKaizenPhoto({ kaizenId, evidenceId }), /supera el tamaño permitido/i);
});

test('un usuario sin permiso de lectura no puede consultar fotos Kaizen', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  h.setEmail('operario@deteco.cl');
  assert.throws(() => h.api.app5sAdminKaizenPhoto({ kaizenId: 'K-panel-12345678', evidenceId: 'finding-12345678' }), /no tiene acceso de lectura/i);
});

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

test('al reutilizar una hoja preparada inicializa accesos QR sin crear otro libro', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  const originalSheetId = h.props.APP5S_SHEET_ID;
  const originalFolderId = h.props.APP5S_FOLDER_ID;
  const accesses = book.getSheetByName('Accesos');
  accesses.rows.slice(1).forEach(row => { row[1] = ''; row[2] = false; });
  h.props.APP5S_OWNER_EMAIL = '';
  h.props.APP5S_FIRST_WEEK = '';

  const result = h.api.instalarApp5SCompleta();

  assert.equal(result.reused, true);
  assert.equal(h.books.size, 1, 'no debe crear un segundo libro');
  assert.equal(h.props.APP5S_SHEET_ID, originalSheetId);
  assert.equal(h.props.APP5S_FOLDER_ID, originalFolderId);
  assert.equal(h.props.APP5S_OWNER_EMAIL, 'ivan.vivanco@deteco.cl');
  assert.equal(h.props.APP5S_FIRST_WEEK, '2026-W39');
  assert.equal(h.props.APP5S_FRONTEND_URL, 'https://deteco.github.io/inspecciones-5s-deteco/');
  assert.equal(h.props.APP5S_FRONTEND_ORIGIN, 'https://deteco.github.io');
  assert.equal(accesses.rows.length, 10);
  accesses.rows.slice(1).forEach(row => {
    assert.match(row[1], /^[A-Za-z0-9_-]{32,}$/);
    assert.equal(row[2], true);
  });
});

test('una tabla Accesos duplicada no recibe una activación QR parcial', () => {
  const h = harness();
  h.api.instalarApp5SCompleta();
  const book = h.books.get(h.props.APP5S_SHEET_ID);
  const accesses = book.getSheetByName('Accesos');
  accesses.rows.slice(1).forEach(row => { row[1] = ''; row[2] = false; });
  accesses.rows.push(['bodega', '', false]);

  assert.throws(() => h.api.instalarApp5SCompleta(), /una sola fila para BODEGA/i);
  accesses.rows.slice(1).forEach(row => {
    assert.equal(row[1], '', 'no debe generar tokens antes de validar todas las estaciones');
    assert.equal(row[2], false, 'no debe activar parcialmente las estaciones');
  });
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
  const moduleHistory = book.getSheetByName('Puntajes modulo').rows.slice(1);
  assert.equal(moduleHistory.length, 5);
  assert.deepEqual(moduleHistory.map(row => row[5]), [4.75, 5, 5, 5, 5]);
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

test('Santa Julia guarda el hallazgo en la carpeta existente SANTA JULIA', () => {
  const h = harness();
  const root = h.root.getFoldersByName('INSPECCIONES 5S').next();
  const existing = root.createFolder('SANTA JULIA');
  h.api.instalarApp5SCompleta();
  const base = { stationId: 'obra-santa-julia', accessToken: accessFor(h, 'obra-santa-julia'), clientId: 'phone-a' };
  call(h, 'reserve', { ...base, inspectorName: 'Ana Pérez' });
  call(h, 'save-answer', { ...base, questionId: 'SEP-01', count: 1 });
  call(h, 'save-finding', { ...base, questionId: 'SEP-01', ordinal: 1, finding: {
    id: 'finding-santa-julia', dataUri: 'data:image/jpeg;base64,AAAA', note: 'Prueba de carpeta',
  } });

  assert.equal(existing.getFoldersByName('2026-09').next().getFoldersByName('2026-W39').next().getFoldersByName('Hallazgos').next().files.length, 1);
  assert.equal(root.getFoldersByName('OBRA SANTA JULIA').hasNext(), false);
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
  assert.deepEqual(book.getSheetByName('Puntajes modulo').rows.slice(1).map(row => row[5]), [0, 0, 0, 0, 0]);
});
