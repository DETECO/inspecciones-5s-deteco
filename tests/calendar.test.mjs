import test from 'node:test';
import assert from 'node:assert/strict';
import { isoWeekChile, inspectionWindow, weeklyDeadlinePassed } from '../domain/calendar.mjs';

test('la semana ISO usa la fecha de Chile y conserva el año ISO al cambiar de año', () => {
  assert.deepEqual(isoWeekChile(new Date('2021-01-01T01:00:00Z')), {
    isoYear: 2020,
    isoWeek: 53,
    key: '2020-W53',
  });
  assert.deepEqual(isoWeekChile(new Date('2024-12-30T12:00:00Z')), {
    isoYear: 2025,
    isoWeek: 1,
    key: '2025-W01',
  });
});

test('lunes permite iniciar desde las 08:15 y cierra a las 17:00', () => {
  assert.equal(inspectionWindow(new Date('2026-09-21T11:14:59Z'), false), 'closed');
  assert.equal(inspectionWindow(new Date('2026-09-21T11:15:00Z'), false), 'open');
  assert.equal(inspectionWindow(new Date('2026-09-21T19:59:59Z'), false), 'open');
  assert.equal(inspectionWindow(new Date('2026-09-21T20:00:00Z'), false), 'closed');
});

test('jueves desde las 12:00 solo permite continuar con atraso una inspección iniciada', () => {
  assert.equal(inspectionWindow(new Date('2026-09-24T11:14:59Z'), false), 'closed');
  assert.equal(inspectionWindow(new Date('2026-09-24T11:15:00Z'), false), 'open');
  assert.equal(inspectionWindow(new Date('2026-09-24T14:59:59Z'), false), 'open');
  assert.equal(inspectionWindow(new Date('2026-09-24T15:00:00Z'), false), 'closed');
  assert.equal(inspectionWindow(new Date('2026-09-24T15:00:00Z'), true), 'late-continuation');
  assert.equal(inspectionWindow(new Date('2026-09-24T19:59:59Z'), true), 'late-continuation');
  assert.equal(inspectionWindow(new Date('2026-09-24T20:00:00Z'), true), 'closed');
});

test('solo vence después del jueves 17:00; un lunes temprano no vence la nueva semana', () => {
  assert.equal(weeklyDeadlinePassed(new Date('2026-09-24T19:59:59Z')), false);
  assert.equal(weeklyDeadlinePassed(new Date('2026-09-24T20:00:00Z')), true);
  assert.equal(weeklyDeadlinePassed(new Date('2026-09-25T15:00:00Z')), true);
  assert.equal(weeklyDeadlinePassed(new Date('2026-09-28T10:00:00Z')), false);
});
