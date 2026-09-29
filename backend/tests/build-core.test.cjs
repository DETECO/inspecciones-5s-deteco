const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildCoreSource } = require('../build-core.cjs');

test('el núcleo que se publica en Apps Script se genera desde las reglas probadas de la web', () => {
  const source = buildCoreSource();
  assert.doesNotMatch(source, /^import |^export /m);
  const core = vm.runInNewContext(`${source}\n({ createInspection, reserveInspection, saveAnswer, scoreInspection, isoWeekChile, QUESTIONS })`, { Date, Intl, Object, Number, Array, Map, Set, String, RegExp, Error, TypeError, RangeError });
  let state = core.createInspection({ stationId: 'bodega', week: '2026-W39' });
  state = core.reserveInspection(state, { clientId: 'phone-a', inspectorName: 'Ana Pérez' });
  state = core.saveAnswer(state, { clientId: 'phone-a', questionId: 'SEP-01', count: 2 });
  assert.equal(state.answers['SEP-01'], 2);
  assert.equal(core.scoreInspection(Object.fromEntries(core.QUESTIONS.map(question => [question.id, 0]))).finalScore, 5);
  assert.equal(core.isoWeekChile(new Date('2026-09-24T15:00:00Z')).key, '2026-W39');
});
