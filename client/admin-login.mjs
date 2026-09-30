const GOOGLE_ACCOUNT_CHOOSER = 'https://accounts.google.com/AccountChooser';

export function configureAdminLoginPage(root, config) {
  const loginLink = root.querySelector('#google-login');
  const status = root.querySelector('#login-status');
  if (!loginLink || !status) return false;

  let destination;
  try {
    destination = new URL(config?.adminLoginUrl || '');
  } catch {
    destination = null;
  }

  const configured = config?.mode === 'bridge'
    && destination?.origin === new URL(GOOGLE_ACCOUNT_CHOOSER).origin
    && destination?.pathname === '/AccountChooser'
    && destination.searchParams.get('continue')?.startsWith('https://script.google.com/a/macros/deteco.cl/');

  if (!configured) {
    loginLink.removeAttribute('href');
    loginLink.setAttribute('aria-disabled', 'true');
    loginLink.setAttribute('tabindex', '-1');
    loginLink.classList.add('is-disabled');
    status.textContent = 'El acceso al panel aún no está configurado. Contacta al administrador.';
    status.hidden = false;
    return false;
  }

  loginLink.href = destination.href;
  loginLink.removeAttribute('aria-disabled');
  loginLink.removeAttribute('tabindex');
  loginLink.classList.remove('is-disabled');
  status.textContent = 'Google te permitirá elegir o cambiar la cuenta antes de volver al panel.';
  status.hidden = false;
  return true;
}

export { GOOGLE_ACCOUNT_CHOOSER };
