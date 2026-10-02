import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../domain/catalog.mjs';

const view = await import('../client/result-summary.mjs').catch(() => ({}));
const sample = (score = 4.5) => ({
  stationId: 'oficina', week: '2026-W40', status: 'closed', finalMaterialized: true,
  closedBy: 'Ana Pérez', closedAt: '2026-10-02T12:30:00Z',
  findings: { 'SEP-01': [{ id: 'a' }, { id: 'b' }], 'GD-01': [{ id: 'c' }] },
  result: { finalScore: score, moduleScores: Object.fromEntries(MODULES.map(m => [m.id, score])),
    dailyManagement: { applicable: false }, completionStatus: 'cumplida' },
});

test('clasifica nota real: verde desde4.5 y medalla únicamente para5 exacto', () => {
  assert.equal(typeof view.scorePresentation, 'function');
  for (const [score, tone, label, icon] of [[4,'red','Requiere mejora','alert-circle'],[4.49,'red','Requiere mejora','alert-circle'],[4.5,'green','Satisfactoria','circle-check'],[4.99,'green','Satisfactoria','circle-check'],[5,'green','Excelente','award']]) {
    const result = view.scorePresentation(score);
    assert.equal(result.tone, tone); assert.equal(result.label, label); assert.equal(result.icon, icon);
  }
});

test('redondeo no disfraza una nota insuficiente ni concede excelencia falsa', () => {
  assert.equal(typeof view.scorePresentation, 'function');
  assert.equal(view.scorePresentation(4.49).text, '4,49');
  assert.equal(view.scorePresentation(4.499).text, '4,49');
  assert.equal(view.scorePresentation(4.999).text, '4,99');
  assert.equal(view.scorePresentation(4.5).text, '4,5');
  for (const value of [null,undefined,NaN,Infinity,-1,6,'5']) {
    assert.equal(view.scorePresentation(value).label, 'Sin nota');
    assert.equal(view.scorePresentation(value).tone, 'neutral');
  }
});

test('resumen fiel incluye resultados,GD neutro,metadatos Chile y guardado confirmado', () => {
  assert.equal(typeof view.renderResultSummary, 'function');
  const html = view.renderResultSummary({inspection:sample(),stationName:'OFICINA',mode:'bridge'});
  assert.match(html,/Inspección finalizada/); assert.match(html,/Satisfactoria/);
  assert.match(html,/Guardada/); assert.match(html,/2026 · S40/); assert.match(html,/Ana Pérez/);
  assert.match(html,/02-10-2026/); assert.match(html,/09:30/);
  assert.match(html,/No aplica/); assert.match(html,/Nota independiente/);
  assert.match(html,/2 hallazgos 5S/); assert.doesNotMatch(html,/3 hallazgos 5S/);
  assert.match(html,/Volver al inicio/); assert.doesNotMatch(html,/Requiere mejora/);
});

test('nota mala no se confunde con fallo de guardado;GD mantiene nota independiente', () => {
  assert.equal(typeof view.renderResultSummary, 'function');
  const record = sample(4);
  record.result.dailyManagement = { applicable: true, score: 4.75 };
  const html = view.renderResultSummary({inspection:record,stationName:'OFICINA',mode:'bridge'});
  assert.match(html,/result-hero result-red/); assert.match(html,/Requiere mejora/);
  assert.match(html,/Guardada/); assert.match(html,/4,75/); assert.match(html,/1 hallazgo GD/);
  assert.equal(record.result.finalScore, 4);
});

test('no anuncia Guardada ni permite salir cuando materialización no está confirmada', () => {
  assert.equal(typeof view.renderResultSummary, 'function');
  const record = sample(); record.finalMaterialized = false;
  const html = view.renderResultSummary({inspection:record,stationName:'OFICINA',mode:'bridge'});
  assert.doesNotMatch(html,/Guardada/); assert.match(html,/Guardado sin confirmar/);
  assert.match(html,/data-action="return-home" disabled/);
  const local = view.renderResultSummary({inspection:sample(),stationName:'OFICINA',mode:'local'});
  assert.doesNotMatch(local,/Guardada/); assert.match(local,/Prueba local/);
});

test('escapa nombres y conserva aviso de cierre incompleto, sin medalla', () => {
  assert.equal(typeof view.renderResultSummary, 'function');
  const record = sample(0); record.closedBy='<script>test</script>';
  record.result.completionStatus='vencida-cerrada-incompleta';
  const html=view.renderResultSummary({inspection:record,stationName:'<img onerror=x>',mode:'bridge'});
  assert.doesNotMatch(html,/<script>|<img onerror/); assert.match(html,/&lt;script&gt;/);
  assert.match(html,/Cerrada incompleta/); assert.doesNotMatch(html,/icons\/award/);
});
