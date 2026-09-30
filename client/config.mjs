import { validateBridgeEndpoint } from '../transport/form-client.mjs';

export function resolveAppConfig(value = {}) {
  const bridgeEndpoint = typeof value.bridgeEndpoint === 'string' ? value.bridgeEndpoint.trim() : '';
  if (!bridgeEndpoint) return { bridgeEndpoint: '', adminEndpoint: '', adminLoginUrl: '', mode: 'local' };

  const validatedBridgeEndpoint = validateBridgeEndpoint(bridgeEndpoint);
  const deploymentId = validatedBridgeEndpoint.match(/\/s\/([A-Za-z0-9_-]+)\/exec$/)?.[1];
  const adminEndpoint = deploymentId
    ? `https://script.google.com/a/macros/deteco.cl/s/${deploymentId}/exec`
    : validatedBridgeEndpoint;
  const adminLoginUrl = `https://accounts.google.com/AccountChooser?continue=${encodeURIComponent(adminEndpoint)}`;

  return { bridgeEndpoint: validatedBridgeEndpoint, adminEndpoint, adminLoginUrl, mode: 'bridge' };
}
