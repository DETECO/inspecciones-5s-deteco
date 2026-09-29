export function validateKaizenReviews(pending, reviews = {}) {
  const pendingItems = Array.isArray(pending) ? pending : [];
  const reviewMap = reviews && typeof reviews === 'object' && !Array.isArray(reviews) ? reviews : {};
  const pendingIds = new Set(pendingItems.map(item => item.id));
  const missingDecisions = [];
  const missingEvidence = [];
  const missingReasons = [];
  const unknownDecisions = Object.keys(reviewMap).filter(id => !pendingIds.has(id));

  for (const kaizen of pendingItems) {
    const review = reviewMap[kaizen.id];
    if (!review || !['solved', 'pending'].includes(review.decision)) {
      missingDecisions.push(kaizen.id);
    } else if (review.decision === 'solved') {
      if (typeof review.photoId !== 'string' || !review.photoId.trim()) missingEvidence.push(kaizen.id);
    } else if (typeof review.reason !== 'string' || !review.reason.trim()) {
      missingReasons.push(kaizen.id);
    }
  }

  return {
    missingDecisions,
    missingEvidence,
    missingReasons,
    unknownDecisions,
    canContinue: !missingDecisions.length && !missingEvidence.length && !missingReasons.length && !unknownDecisions.length,
  };
}

export function classifyNewFinding(stationId, choice, knownKaizen) {
  if (!stationId || !choice || !Array.isArray(knownKaizen)) throw new Error('Faltan datos del hallazgo.');
  if (choice.kind === 'existing') {
    const item = knownKaizen.find(kaizen => kaizen.id === choice.kaizenId);
    if (!item) throw new Error('No se encontró el kaizen elegido.');
    if (item.stationId !== stationId) throw new Error('El kaizen pertenece a otra estación.');
    if (item.status !== 'open') throw new Error('Solo se puede vincular con un kaizen abierto.');
    return { action: 'link', kaizenId: item.id };
  }
  if (choice.kind === 'new') {
    if (!choice.recurrenceOf) return { action: 'create', recurrenceOf: null };
    const item = knownKaizen.find(kaizen => kaizen.id === choice.recurrenceOf);
    if (!item || item.stationId !== stationId || item.status !== 'closed') {
      throw new Error('La recurrencia debe referirse a un kaizen cerrado de la misma estación.');
    }
    return { action: 'create', recurrenceOf: item.id };
  }
  throw new Error('Elige si el hallazgo es nuevo o corresponde a un kaizen abierto.');
}
