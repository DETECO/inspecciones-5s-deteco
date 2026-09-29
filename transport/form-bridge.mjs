const BRIDGE_CHANNEL = 'deteco-5s-bridge-v1';
const GOOGLE_BRIDGE_ORIGINS = new Set([
  'https://script.google.com',
  'https://script.googleusercontent.com',
]);

export function isTrustedBridgeReceipt(event, expected) {
  if (!event || !expected || !GOOGLE_BRIDGE_ORIGINS.has(event.origin)) return false;
  const data = event.data;
  if (!data || typeof data !== 'object') return false;
  if (data.channel !== BRIDGE_CHANNEL) return false;
  if (data.requestId !== expected.requestId || data.nonce !== expected.nonce) return false;
  if (typeof data.encodedResult !== 'string' || !data.encodedResult) return false;
  if (expected.source && event.source !== expected.source) return false;
  return true;
}

export function decodeBridgeResult(encodedResult) {
  try {
    const json = typeof atob === 'function'
      ? decodeURIComponent(Array.from(atob(encodedResult), char => `%${char.codePointAt(0).toString(16).padStart(2, '0')}`).join(''))
      : Buffer.from(encodedResult, 'base64').toString('utf8');
    const result = JSON.parse(json);
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('shape');
    return result;
  } catch {
    throw new Error('El acuse de guardado no contiene una respuesta válida.');
  }
}

export const bridgeProtocol = Object.freeze({
  channel: BRIDGE_CHANNEL,
  origins: Object.freeze([...GOOGLE_BRIDGE_ORIGINS]),
});
