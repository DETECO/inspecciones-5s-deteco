import { acknowledgeOutbox, appendOutbox, pendingOutbox } from './outbox.mjs';

function defaultOperationId() {
  const value = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `operation-${value}`;
}

function requireBridge(bridge) {
  if (!bridge || typeof bridge.send !== 'function') throw new Error('El puente de sincronización no está disponible.');
}

export function createBridgeSession({ bridge, stationId, accessToken, clientId, operationId = defaultOperationId, now = () => new Date() } = {}) {
  requireBridge(bridge);
  if (typeof stationId !== 'string' || !stationId.trim()) throw new Error('Falta la estación de sincronización.');
  if (typeof accessToken !== 'string' || !accessToken.trim()) throw new Error('Falta el acceso QR de sincronización.');
  if (typeof clientId !== 'string' || !clientId.trim()) throw new Error('Falta identificar el teléfono.');
  if (typeof operationId !== 'function' || typeof now !== 'function') throw new Error('No se puede identificar una operación local.');

  let outbox = [];
  let flushing = null;
  let revision = 0;

  function request(operation, payload = {}, requestId) {
    const requestPayload = operation === 'state'
      ? payload
      : { ...payload, occurredAt: payload.occurredAt || now().toISOString() };
    const value = {
      operation,
      accessToken,
      payload: { ...requestPayload, stationId, clientId },
    };
    return requestId ? bridge.send({ ...value, requestId }) : bridge.send(value);
  }

  return {
    pending() {
      return pendingOutbox(outbox);
    },
    revision() {
      return revision;
    },
    restore(items = []) {
      outbox = pendingOutbox(items);
      return pendingOutbox(outbox);
    },
    enqueue(operation, payload) {
      revision += 1;
      outbox = appendOutbox(outbox, {
        id: operationId(),
        operation,
        payload: { ...payload, occurredAt: payload.occurredAt || now().toISOString() },
      });
      return pendingOutbox(outbox);
    },
    readState() {
      return request('state');
    },
    sendNow(operation, payload, requestId) {
      if (operation !== 'state') revision += 1;
      return request(operation, payload, requestId);
    },
    async flush({ onReceipt } = {}) {
      if (flushing) return flushing;
      flushing = (async () => {
        const receipts = [];
        while (outbox.length) {
          const item = outbox[0];
          const receipt = await request(item.operation, item.payload, item.id);
          outbox = acknowledgeOutbox(outbox, item.id);
          receipts.push(receipt);
          if (typeof onReceipt === 'function') await onReceipt(receipt, item);
        }
        return receipts;
      })();
      try {
        return await flushing;
      } finally {
        flushing = null;
      }
    },
  };
}
