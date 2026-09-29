const APP5S_BRIDGE_CHANNEL = 'deteco-5s-bridge-v1';
const APP5S_REQUEST_ID = /^[A-Za-z0-9_-]{16,160}$/;

function app5sDecodePayload_(encoded) {
  try {
    if (typeof encoded !== 'string' || !encoded) throw new Error('missing');
    const bytes = Utilities.base64Decode(encoded);
    const payload = JSON.parse(Utilities.newBlob(bytes).getDataAsString('UTF-8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('shape');
    if (typeof payload.accessToken !== 'string' || !/^[A-Za-z0-9_-]{24,160}$/.test(payload.accessToken)) throw new Error('access');
    return payload;
  } catch (error) {
    throw new Error('Payload de solicitud inválido.');
  }
}

function app5sFrontendOrigin_() {
  const properties = PropertiesService.getScriptProperties();
  const configuredOrigin = String(properties.getProperty('APP5S_FRONTEND_ORIGIN') || '').trim();
  const frontendUrl = String(properties.getProperty('APP5S_FRONTEND_URL') || '').trim();
  const inferredOrigin = (frontendUrl.match(/^https:\/\/[A-Za-z0-9-]+\.github\.io/) || [])[0] || '';
  const origin = configuredOrigin || inferredOrigin;
  if (!/^https:\/\/[A-Za-z0-9-]+\.github\.io$/.test(origin)) {
    throw new Error('El origen público de la app no está configurado.');
  }
  return origin;
}

function app5sRequestId_(value, label) {
  if (typeof value !== 'string' || !APP5S_REQUEST_ID.test(value)) throw new Error(`${label} inválido.`);
  return value;
}

function app5sEncodeResult_(result) {
  return Utilities.base64Encode(Utilities.newBlob(JSON.stringify(result), 'application/json').getBytes());
}

function app5sBridgeReceipt_(requestId, nonce, result) {
  const receipt = {
    channel: APP5S_BRIDGE_CHANNEL,
    requestId: app5sRequestId_(requestId, 'Identificador de solicitud'),
    nonce: app5sRequestId_(nonce, 'Nonce'),
    encodedResult: app5sEncodeResult_(result),
  };
  const origin = app5sFrontendOrigin_();
  const html = `<script>window.top.postMessage(${JSON.stringify(receipt)}, ${JSON.stringify(origin)});</script>`;
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function app5sSafeBridgeError_(error) {
  const message = String(error && error.message || '');
  if (/^(Acceso|Estación|Horario|Inspección|Reserva|Pregunta|Hallazgos|Kaizen|Falta|Payload|No hay|La inspección|La reserva)/i.test(message)) return message;
  return 'No fue posible completar la operación. Reintenta o avisa al administrador.';
}

function doPost(e) {
  const parameter = (e && e.parameter) || {};
  const requestId = parameter.requestId;
  const nonce = parameter.nonce;
  try {
    app5sRequestId_(requestId, 'Identificador de solicitud');
    app5sRequestId_(nonce, 'Nonce');
    const payload = app5sDecodePayload_(parameter.payload);
    const result = app5sHandle_(String(parameter.operation || ''), payload, {
      requestId,
      nonce,
      receivedAt: new Date().toISOString(),
    });
    return app5sBridgeReceipt_(requestId, nonce, { ok: true, ...result });
  } catch (error) {
    return app5sBridgeReceipt_(requestId, nonce, { ok: false, error: app5sSafeBridgeError_(error) });
  }
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Admin')
    .setTitle('Administración 5S DETECO')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
