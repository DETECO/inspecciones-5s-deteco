import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const stylesheet = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../client/app.mjs', import.meta.url), 'utf8');

test('uses the DETECO orange, graphite and neutral palette', () => {
  assert.match(stylesheet, /--charcoal:\s*#494741/i);
  assert.match(stylesheet, /--orange:\s*#f26522/i);
  assert.match(stylesheet, /--canvas:\s*#f5f4f1/i);
});

test('carries the industrial DETECO visual line through the inspection screens', () => {
  assert.match(stylesheet, /\.header\s*\{[^}]*border-top:\s*5px solid var\(--orange\)/s);
  assert.match(stylesheet, /\.context-row\s*\{[^}]*border-left:\s*4px solid var\(--orange\)/s);
  assert.match(stylesheet, /\.eyebrow::before\s*\{[^}]*border:\s*2px solid var\(--orange\)/s);
  assert.doesNotMatch(stylesheet, /#172033|#33485c|#4b5b6c/i);
  for (const selector of ['.question', '.finding-area', '.kaizen', '.check', '.result-hero']) {
    assert.match(stylesheet, new RegExp(`${selector.replace('.', '\\.')}\\s*\\{`));
  }
});

test('shows the official DETECO logo in the app header', () => {
  assert.match(appSource, /class="brand-logo" src="\.\/assets\/deteco-wordmark\.jpg"/);
});
