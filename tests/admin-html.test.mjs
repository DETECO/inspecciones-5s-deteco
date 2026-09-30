import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adminFiles = [
  new URL('../backend/Admin.html', import.meta.url),
  new URL('../backend/deploy/Admin.html', import.meta.url),
];

test('el panel no pone direcciones HTTPS en plantillas JavaScript inline', () => {
  for (const file of adminFiles) {
    const adminHtml = readFileSync(file, 'utf8');
    assert.doesNotMatch(adminHtml, /`[^`]*https:\/\//s,
      `Apps Script alteró https:// dentro de una plantilla inline en ${file.pathname} y el navegador detuvo todo el panel`);
  }
});
