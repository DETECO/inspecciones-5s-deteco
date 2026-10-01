export async function submitFinalInspection({ session, inspection, sessionId, occurredAt, uploadCache, onProgress = () => {} }) {
  async function upload(id, dataUri, category) {
    if (!dataUri) throw new Error('Falta la fotografía. Adjunta la imagen antes de cerrar.');
    const cached = uploadCache.get(id);
    if (cached?.dataUri === dataUri && cached.photoId) return cached.photoId;
    // A changed image gets a new upload ID; retries of the same image keep it.
    const uploadId = cached && cached.dataUri !== dataUri ? `${id}-${crypto.randomUUID()}` : cached?.uploadId || id;
    const entry = { dataUri, uploadId, photoId: '' };
    uploadCache.set(id, entry);
    onProgress('Enviando fotografías…');
    const receipt = await session.sendNow('upload-final-photo', { sessionId, photoId: uploadId, dataUri, category });
    if (!receipt?.photoId) throw new Error('No llegó confirmación de la fotografía. Reintenta el cierre.');
    entry.photoId = receipt.photoId;
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
  onProgress('Guardando inspección completa…');
  const receipt = await session.sendNow('submit-final', { sessionId, occurredAt, dailyManagementApplicable: inspection.dailyManagementApplicable, answers: { ...inspection.answers }, findings, kaizenReviews });
  if (receipt?.state?.status !== 'closed' || receipt.state.finalSessionId !== sessionId) {
    throw new Error('No llegó confirmación del cierre. Mantén esta página abierta y reintenta.');
  }
  return receipt;
}
