import { makeBridgeRequest } from './bridge-request.mjs';
import { decodeBridgeResult, isTrustedBridgeReceipt } from './form-bridge.mjs';

const endpointPattern = /^https:\/\/script\.google\.com\/(?:a\/[A-Za-z0-9.-]+\/)?macros\/s\/[A-Za-z0-9_-]+\/exec$/;

export function validateBridgeEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || !endpointPattern.test(endpoint)) {
    throw new Error('La URL del puente debe ser una publicación HTTPS de Apps Script.');
  }
  return endpoint;
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '');
  if (globalThis.crypto?.getRandomValues) {
    return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function formField(form, name, value) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.append(input);
}

export function createFormBridge({ endpoint, timeoutMs = 30000 } = {}) {
  const action = validateBridgeEndpoint(endpoint);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000) throw new Error('Tiempo de espera del puente inválido.');

  return {
    send({ operation, accessToken, payload, requestId: stableRequestId }) {
      const requestId = stableRequestId || randomId();
      const nonce = randomId();
      const envelope = makeBridgeRequest({ operation, requestId, nonce, accessToken, payload });
      const frame = document.createElement('iframe');
      frame.name = `deteco-5s-${requestId}`;
      frame.hidden = true;
      frame.setAttribute('aria-hidden', 'true');
      const form = document.createElement('form');
      form.method = 'post';
      form.action = action;
      form.target = frame.name;
      form.hidden = true;
      Object.entries(envelope).forEach(([name, value]) => formField(form, name, value));

      return new Promise((resolve, reject) => {
        let finished = false;
        const cleanup = () => {
          window.removeEventListener('message', received);
          window.clearTimeout(timer);
          form.remove();
          frame.remove();
        };
        const finish = callback => value => {
          if (finished) return;
          finished = true;
          cleanup();
          callback(value);
        };
        const received = event => {
          if (!isTrustedBridgeReceipt(event, { requestId, nonce, source: frame.contentWindow })) return;
          try {
            const result = decodeBridgeResult(event.data.encodedResult);
            if (!result.ok) throw new Error(result.error || 'El servidor no confirmó el guardado.');
            finish(resolve)(result);
          } catch (error) {
            finish(reject)(error);
          }
        };
        const timer = window.setTimeout(() => finish(reject)(new Error('No llegó confirmación de guardado. Revisa la conexión e inténtalo nuevamente.')), timeoutMs);
        window.addEventListener('message', received);
        document.body.append(frame, form);
        form.submit();
      });
    },
  };
}
