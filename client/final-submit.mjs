export async function submitFinalInspection({ session, inspection, sessionId, occurredAt, uploadCache, submissionState = {}, onProgress = () => {} }) {
  const total = Object.values(inspection.findings).reduce((n, items) => n + items.length, 0)
    + Object.values(inspection.kaizenReviews).filter(review => review.decision === 'solved').length;
  let completed = 0;
  const progress = (phase, message) => onProgress(message, { phase, completed, total });
  function confirmed(receipt, recovery = false) {
    const state = receipt?.state;
    return state?.status === 'closed' && state.finalSessionId === sessionId
      && (recovery ? state.finalMaterialized === true && state.stationId === inspection.stationId && state.week === inspection.week : state.finalMaterialized !== false);
  }
  async function checkClosure() {
    progress('checking', 'Comprobando si el servidor terminó el guardado…');
    return session.sendNow('final-state', { sessionId });
  }
  if (submissionState.attempted) {
    const receipt = await checkClosure();
    if (confirmed(receipt, true)) { progress('confirmed', 'Guardado confirmado'); return receipt; }
    if (receipt?.state?.status === 'closed' && receipt.state.finalSessionId !== sessionId) throw new Error('La estación ya fue cerrada por otra inspección. No se reenviaron tus datos.');
  }
  progress('photos', total ? `Fotos confirmadas: 0 de ${total}` : 'Sin fotografías pendientes');
  async function upload(id, dataUri, category) {
    if (!dataUri) throw new Error('Falta la fotografía. Adjunta la imagen antes de cerrar.');
    const cached = uploadCache.get(id);
    if (cached?.dataUri === dataUri && cached.photoId) {
      completed++;
      progress('photos', `Fotos confirmadas: ${completed} de ${total}`);
      return cached.photoId;
    }
    // A changed image gets a new upload ID; retries of the same image keep it.
    const uploadId = cached && cached.dataUri !== dataUri ? `${id}-${crypto.randomUUID()}` : cached?.uploadId || id;
    const entry = { dataUri, uploadId, photoId: '' };
    uploadCache.set(id, entry);
    progress('photos', `Enviando foto ${completed + 1} de ${total}…`);
    const receipt = await session.sendNow('upload-final-photo', { sessionId, photoId: uploadId, dataUri, category });
    if (!receipt?.photoId) throw new Error('No llegó confirmación de la fotografía. Reintenta el cierre.');
    entry.photoId = receipt.photoId;
    completed++;
    progress('photos', `Fotos confirmadas: ${completed} de ${total}`);
    return receipt.photoId;
  }
  const findings = {};
  for (const [questionId, items] of Object.entries(inspection.findings)) {
    findings[questionId] = [];
    for (const item of items) {
      if (!item) throw new Error('Falta completar una fotografía del hallazgo.');
      findings[questionId].push({ id: item.id, note: item.note || '', photoId: await upload(item.id, item.dataUri || item.preview, 'Hallazgos') });
    }
  }
  const kaizenReviews = {};
  for (const [id, review] of Object.entries(inspection.kaizenReviews)) {
    kaizenReviews[id] = review.decision === 'solved'
      ? { decision: 'solved', photoId: await upload(`solution-${id}-${sessionId}`, review.dataUri || review.preview, 'Cierres kaizen') }
      : { decision: 'pending', reason: review.reason || '' };
  }
  progress('saving', 'Guardando respuestas e indicadores en Google Sheets…');
  submissionState.attempted = true;
  let receipt;
  try {
    receipt = await session.sendNow('submit-final', { sessionId, occurredAt, dailyManagementApplicable: inspection.dailyManagementApplicable, answers: { ...inspection.answers }, findings, kaizenReviews });
  } catch (error) {
    if (error.code !== 'BRIDGE_TIMEOUT') throw error;
    try { receipt = await checkClosure(); } catch {
      throw new Error('No se pudo confirmar el guardado. Mantén esta página abierta y reintenta; primero comprobaremos el resultado para evitar duplicados.');
    }
    if (!confirmed(receipt, true)) throw new Error('El guardado todavía no está confirmado como completo. Mantén esta página abierta y reintenta el cierre.');
  }
  if (!confirmed(receipt)) {
    throw new Error('No llegó confirmación del cierre. Mantén esta página abierta y reintenta.');
  }
  progress('confirmed', 'Guardado confirmado');
  return receipt;
}
