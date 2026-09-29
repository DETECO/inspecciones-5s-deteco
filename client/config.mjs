import { validateBridgeEndpoint } from '../transport/form-client.mjs';

export function resolveAppConfig(value = {}) {
  const bridgeEndpoint = typeof value.bridgeEndpoint === 'string' ? value.bridgeEndpoint.trim() : '';
  if (!bridgeEndpoint) return { bridgeEndpoint: '', mode: 'local' };
  return { bridgeEndpoint: validateBridgeEndpoint(bridgeEndpoint), mode: 'bridge' };
}
