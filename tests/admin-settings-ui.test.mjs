import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = () => readFileSync(new URL('../backend/Admin.html', import.meta.url), 'utf8');
test('panel: navegación de configuración y retorno superior al escáner', () => {
  const source = html();
  assert.match(source, /data-view="schedule"/);
  assert.match(source, /data-view="notifications"/);
  const nav = source.match(/<nav class="admin-nav"[\s\S]*?<\/nav>/)[0];
  assert.doesNotMatch(nav, />Inspección 5S</);
  assert.match(source, /class="back-scan"[^>]*>← Volver al escáner<\/a>/);
  assert.match(source, /id="settings-view"/);
});
test('panel: encargado separado y advertencia solo al liberar', () => {
  const source = html();
  assert.doesNotMatch(source, /id="release-notice"/);
  assert.match(source, /Encargado del área/);
  assert.match(source, /app5sAdminUpdateOwner/);
  assert.match(source, /expectedOwner/);
  assert.match(source, /Las respuestas no enviadas no se recuperan/);
});
test('formularios: API, validación y confirmación de horarios y avisos', () => {
  const source = readFileSync(new URL('../backend/admin-settings-ui.js', import.meta.url), 'utf8');
  new vm.Script(source);
  for (const name of ['app5sAdminSettings', 'app5sAdminSaveSchedule', 'app5sAdminNotificationSettings', 'app5sAdminSaveNotifications']) assert.match(source, new RegExp(name));
  assert.match(source, /confirmSave/);
  assert.match(source, /Confirmar cambios/);
  assert.doesNotMatch(source, /window\.confirm/);
  assert.match(source, /America\/Santiago/);
  assert.match(source, /authorizationRequired/);
  assert.match(source, /stationRecipients/);
  assert.doesNotMatch(source, /`[^`]*https:\/\//s);
});
