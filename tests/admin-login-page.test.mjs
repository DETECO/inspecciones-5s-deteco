import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { configureAdminLoginPage } from '../client/admin-login.mjs';
import { resolveAppConfig } from '../client/config.mjs';

const html = readFileSync(new URL('../admin-login.html', import.meta.url), 'utf8');
const pageScript = readFileSync(new URL('../client/admin-login.mjs', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../admin-login.css', import.meta.url), 'utf8');

test('la pantalla de acceso usa la marca DETECO y dirige a Google para autenticar', () => {
  assert.match(html, /assets\/deteco-wordmark\.jpg/);
  assert.match(html, /Administración 5S/);
  assert.match(html, /Acceso al panel/);
  assert.match(html, /Continuar con Google/);
  assert.match(html, /Acceso exclusivo para cuentas DETECO autorizadas/);
  assert.doesNotMatch(html, /type="password"/i);
  assert.match(html, /client\/admin-login\.mjs/);
  assert.match(pageScript, /adminLoginUrl/);
  assert.match(pageScript, /accounts\.google\.com/);
  assert.match(pageScript, /\/AccountChooser/);
});

test('la pantalla se adapta a móvil y respeta la preferencia de movimiento reducido', () => {
  assert.match(stylesheet, /html\s*\{[^}]*min-width:\s*0/s,
    'la pantalla de acceso no debe forzar desplazamiento horizontal en un visor estrecho');
  assert.match(stylesheet, /\.admin-login-page\s*\{[^}]*display:\s*flex/s,
    'el contenido debe conservar el inicio del documento en pantallas bajas');
  assert.match(stylesheet, /\.admin-login-content\s*\{[^}]*margin:\s*auto/s,
    'el centrado debe ceder a un desplazamiento vertical cuando el contenido no cabe');
  assert.match(stylesheet, /@media\s*\(max-width:\s*640px\)/);
  assert.match(stylesheet, /:focus-visible/);
  assert.match(stylesheet, /prefers-reduced-motion:\s*reduce/);
});

test('el botón dirige al selector oficial de Google con el panel DETECO como destino', () => {
  const elements = createLoginElements();
  const config = resolveAppConfig({ bridgeEndpoint: 'https://script.google.com/macros/s/AKfycbx1234567890/exec' });
  const root = { querySelector: (selector) => elements[selector] };

  assert.equal(configureAdminLoginPage(root, config), true);
  assert.equal(elements['#google-login'].href, config.adminLoginUrl);
  assert.equal(elements['#google-login'].attributes.get('aria-disabled'), undefined);
  assert.match(elements['#login-status'].textContent, /elegir o cambiar la cuenta/);
});

test('si falta la configuración, desactiva el botón e indica cómo resolverlo', () => {
  const elements = createLoginElements();
  const root = { querySelector: (selector) => elements[selector] };

  assert.equal(configureAdminLoginPage(root, { mode: 'local', adminLoginUrl: '' }), false);
  assert.equal(elements['#google-login'].attributes.get('href'), undefined);
  assert.equal(elements['#google-login'].attributes.get('aria-disabled'), 'true');
  assert.equal(elements['#google-login'].classList.contains('is-disabled'), true);
  assert.match(elements['#login-status'].textContent, /no está configurado/);
});

test('rechaza una URL que intente enviar el acceso a un sitio distinto de Google', () => {
  const elements = createLoginElements();
  const root = { querySelector: (selector) => elements[selector] };

  assert.equal(configureAdminLoginPage(root, {
    mode: 'bridge',
    adminLoginUrl: 'https://login-example.com/AccountChooser?continue=https%3A%2F%2Fscript.google.com%2Fa%2Fmacros%2Fdeteco.cl%2Fexec',
  }), false);
  assert.equal(elements['#google-login'].attributes.get('aria-disabled'), 'true');
});

function createLoginElements() {
  const loginLink = {
    href: '',
    attributes: new Map(),
    classes: new Set(),
    removeAttribute(name) { this.attributes.delete(name); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    classList: {
      add(name) { loginLink.classes.add(name); },
      remove(name) { loginLink.classes.delete(name); },
      contains(name) { return loginLink.classes.has(name); },
    },
  };
  return {
    '#google-login': loginLink,
    '#login-status': { textContent: '', hidden: true },
  };
}
