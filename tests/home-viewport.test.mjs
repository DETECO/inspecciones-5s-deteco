import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const icon = new URL('../assets/icons/settings.svg', import.meta.url);

test('the home shell gives the photo remaining viewport height and keeps content scrollable', () => {
  assert.match(styles, /\.shell\.home-shell\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*height:\s*100svh;[^}]*overflow-y:\s*auto;/s);
  assert.match(styles, /\.home-shell\s+\.home-main\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;/s);
  assert.match(styles, /\.home-shell\s+\.welcome-page\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
  assert.match(styles, /\.home-shell\s+\.welcome-image-frame\s*\{[^}]*flex:\s*1\s+1\s+0;[^}]*min-height:\s*0;/s);
  assert.match(styles, /\.home-shell\s+\.welcome-photo\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;/s);
  assert.match(styles, /\.home-shell\s+\.welcome-copy\s*\{[^}]*flex:\s*0\s+0\s+auto;/s);
});

test('the settings control is at least 44px and uses a centered 24px icon', () => {
  assert.ok(existsSync(icon), 'settings icon is present');
  const svg = readFileSync(icon, 'utf8');
  assert.match(svg, /width="24"/);
  assert.match(svg, /height="24"/);
  assert.match(svg, /viewBox="0 0 24 24"/);
  assert.match(svg, /<circle cx="12" cy="12" r="3"\s*\/>/);
  assert.match(styles, /\.admin-settings-link\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
  assert.match(styles, /\.admin-settings-link img\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;/s);
});
