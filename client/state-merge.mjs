function withLocalPreview(remoteItem, localItem) {
  if (!localItem?.preview) return { ...remoteItem };
  return { ...remoteItem, preview: localItem.preview, ...(localItem.dataUri ? { dataUri: localItem.dataUri } : {}) };
}

function mergeFindings(remoteFindings = {}, localFindings = {}, pendingOperations = []) {
  const pendingFindingIds = new Set(pendingOperations
    .filter(item => item.operation === 'save-finding')
    .map(item => item.payload?.finding?.id)
    .filter(Boolean));
  const questionIds = new Set([...Object.keys(remoteFindings), ...Object.keys(localFindings)]);
  return Object.fromEntries([...questionIds].map(questionId => {
    const remoteItems = remoteFindings[questionId] || [];
    const localById = new Map((localFindings[questionId] || []).filter(Boolean).map(item => [item.id, item]));
    const merged = (remoteItems || []).map(item => !item ? item : pendingFindingIds.has(item.id) && localById.has(item.id)
      ? { ...localById.get(item.id) }
      : withLocalPreview(item, localById.get(item.id)));
    (localFindings[questionId] || []).forEach((item, index) => {
      if (item && pendingFindingIds.has(item.id)) merged[index] = { ...item };
    });
    return [questionId, merged];
  }));
}

function mergeKaizenReviews(remoteReviews = {}, localReviews = {}, pendingOperations = []) {
  const pendingIds = new Set(pendingOperations
    .filter(item => item.operation === 'review-kaizen')
    .map(item => item.payload?.kaizenId)
    .filter(Boolean));
  const kaizenIds = new Set([...Object.keys(remoteReviews), ...Object.keys(localReviews)]);
  return Object.fromEntries([...kaizenIds].flatMap(kaizenId => {
    const remoteReview = remoteReviews[kaizenId];
    const localReview = localReviews[kaizenId];
    if (localReview && pendingIds.has(kaizenId)) return [[kaizenId, { ...localReview }]];
    if (remoteReview) return [[kaizenId, withLocalPreview(remoteReview, localReview)]];
    return [];
  }));
}

export function mergeServerState(remote = {}, local = {}, pendingOperations = []) {
  // A receipt confirms only the operations already sent, not newer selections.
  // Closed/revoked inspections remain authoritative and cannot be reopened locally.
  const editable = !['closed', 'expired'].includes(remote.status)
    && (!local.editor || remote.editor?.clientId === local.editor.clientId);
  const pending = editable ? pendingOperations : [];
  const merged = {
    ...remote,
    answers: { ...remote.answers },
    findings: mergeFindings(remote.findings, local.findings, pending),
    kaizenReviews: mergeKaizenReviews(remote.kaizenReviews, local.kaizenReviews, pending),
  };
  for (const item of pending) {
    const { questionId, count } = item.payload || {};
    if (item.operation === 'save-answer' && typeof questionId === 'string' && Number.isInteger(count)) {
      merged.answers[questionId] = count;
    }
    if (item.operation === 'discard-extra-findings' && Number.isInteger(merged.answers[questionId])) {
      merged.findings[questionId] = (merged.findings[questionId] || []).slice(0, merged.answers[questionId]);
    }
    if (item.operation === 'save-finding' && questionId && Number.isInteger(item.payload.ordinal)) {
      const finding = item.payload.finding;
      const localFinding = (local.findings?.[questionId] || []).find(entry => entry?.id === finding?.id);
      if (localFinding) {
        const items = [...(merged.findings[questionId] || [])];
        items[item.payload.ordinal - 1] = { ...localFinding };
        merged.findings[questionId] = items;
      }
    }
  }
  return merged;
}
