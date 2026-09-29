import { parseQrRoute } from './route.mjs';

export function scannedStationUrl(value, currentAddress) {
  const content = String(value || '').trim();
  let qrUrl;
  try {
    qrUrl = new URL(content);
  } catch {
    throw new Error('Este código no contiene un QR válido de estación.');
  }
  if (!['https:', 'http:'].includes(qrUrl.protocol)) {
    throw new Error('Escanea el QR web de una estación DETECO.');
  }

  const { stationId, accessToken } = parseQrRoute(qrUrl.href);
  const appUrl = new URL(currentAddress);
  appUrl.hash = new URLSearchParams({ station: stationId, token: accessToken }).toString();
  return appUrl.toString();
}
