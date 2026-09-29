const stationPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const accessTokenPattern = /^[A-Za-z0-9_-]{24,160}$/;

export function parseQrRoute(address) {
  const url = new URL(address);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const stationId = String(fragment.get('station') || '').trim().toLowerCase();
  const accessToken = String(fragment.get('token') || '').trim();
  if (!stationPattern.test(stationId)) throw new Error('La estación indicada por el QR no es válida.');
  if (!accessTokenPattern.test(accessToken)) throw new Error('Escanea el QR válido de la estación para continuar.');
  return { stationId, accessToken };
}

export function scrubQrFragment(address) {
  const url = new URL(address);
  url.hash = '';
  return url.toString();
}
