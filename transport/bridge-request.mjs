const operations = new Set([
  'state', 'reserve', 'request-takeover', 'acknowledge-takeover',
  'save-answer', 'save-finding', 'discard-extra-findings', 'review-kaizen', 'close', 'release',
  'begin-final', 'final-state', 'upload-final-photo', 'submit-final',
]);
const idPattern = /^[A-Za-z0-9_-]{16,160}$/;

function encodeUtf8(value) {
  const json = JSON.stringify(value);
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(json)));
  return Buffer.from(json, 'utf8').toString('base64');
}

function decodeUtf8(value) {
  const json = typeof atob === 'function'
    ? decodeURIComponent(Array.from(atob(value), char => `%${char.codePointAt(0).toString(16).padStart(2, '0')}`).join(''))
    : Buffer.from(value, 'base64').toString('utf8');
  return JSON.parse(json);
}

function requireId(value, label) {
  if (typeof value !== 'string' || !idPattern.test(value)) throw new Error(`${label} inválido.`);
  return value;
}

export function makeBridgeRequest({ operation, requestId, nonce, accessToken, payload } = {}) {
  if (!operations.has(operation)) throw new Error('Operación de puente inválida.');
  requireId(requestId, 'Identificador de solicitud');
  requireId(nonce, 'Nonce');
  if (typeof accessToken !== 'string' || !/^[A-Za-z0-9_-]{24,160}$/.test(accessToken)) throw new Error('El acceso del QR no es válido.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Payload inválido.');
  return {
    operation,
    requestId,
    nonce,
    payload: encodeUtf8({ ...payload, accessToken }),
  };
}

export function decodeBridgePayload(value) {
  try {
    if (typeof value !== 'string' || !value) throw new Error('missing');
    const payload = decodeUtf8(value);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('shape');
    return payload;
  } catch {
    throw new Error('El payload del puente no es válido.');
  }
}

export const bridgeOperations = Object.freeze([...operations]);
