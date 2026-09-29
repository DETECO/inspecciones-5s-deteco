function copyOperation(item) {
  return { ...item, payload: { ...item.payload } };
}

function requireQueue(value) {
  if (!Array.isArray(value)) throw new Error('La cola local no es válida.');
  return value;
}

function requireOperation(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)
    || typeof item.id !== 'string' || item.id.trim().length < 8
    || typeof item.operation !== 'string' || !item.operation.trim()
    || !item.payload || typeof item.payload !== 'object' || Array.isArray(item.payload)) {
    throw new Error('La operación de cola no es válida.');
  }
}

export function pendingOutbox(value = []) {
  return requireQueue(value).map(copyOperation);
}

export function appendOutbox(value = [], item) {
  const current = requireQueue(value);
  requireOperation(item);
  if (current.some(queued => queued.id === item.id)) return pendingOutbox(current);
  return [...pendingOutbox(current), copyOperation(item)];
}

export function acknowledgeOutbox(value = [], operationId) {
  const current = requireQueue(value);
  if (typeof operationId !== 'string' || !operationId.trim()) throw new Error('La confirmación de cola no es válida.');
  if (!current.length) return [];
  if (current[0].id !== operationId) throw new Error('La confirmación no respeta el orden de la cola.');
  return pendingOutbox(current.slice(1));
}
