function withLocalPreview(remoteItem, localItem) {
  if (!localItem?.preview) return { ...remoteItem };
  return { ...remoteItem, preview: localItem.preview };
}

function mergeFindings(remoteFindings = {}, localFindings = {}, pendingOperations = []) {
  const pendingFindingIds = new Set(pendingOperations
    .filter(item => item.operation === 'save-finding')
    .map(item => item.payload?.finding?.id)
    .filter(Boolean));
  const questionIds = new Set([...Object.keys(remoteFindings), ...Object.keys(localFindings)]);
  return Object.fromEntries([...questionIds].map(questionId => {
    const remoteItems = remoteFindings[questionId] || [];
    const localById = new Map((localFindings[questionId] || []).map(item => [item.id, item]));
    const merged = (remoteItems || []).map(item => withLocalPreview(item, localById.get(item.id)));
    const remoteIds = new Set(merged.map(item => item.id));
    (localFindings[questionId] || []).forEach(item => {
      if (pendingFindingIds.has(item.id) && !remoteIds.has(item.id)) merged.push({ ...item });
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
    if (remoteReview) return [[kaizenId, withLocalPreview(remoteReview, localReview)]];
    if (localReview && pendingIds.has(kaizenId)) return [[kaizenId, { ...localReview }]];
    return [];
  }));
}

export function mergeServerState(remote = {}, local = {}, pendingOperations = []) {
  return {
    ...remote,
    findings: mergeFindings(remote.findings, local.findings, pendingOperations),
    kaizenReviews: mergeKaizenReviews(remote.kaizenReviews, local.kaizenReviews, pendingOperations),
  };
}
