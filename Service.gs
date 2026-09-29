function app5sCreateService(deps) {
  function operationTime(occurredAt) {
    if (occurredAt === undefined || occurredAt === null || occurredAt === '') return deps.now();
    const parsed = new Date(occurredAt);
    if (!Number.isFinite(parsed.getTime())) throw new Error('Fecha de operación inválida.');
    return parsed;
  }

  function current(stationId, occurredAt) {
    const now = operationTime(occurredAt);
    const week = isoWeekChile(now).key;
    let state = deps.load(stationId, week);
    if (!state) return createInspection({ stationId, week, pendingKaizen: deps.loadPendingKaizen(stationId) });
    if (occurredAt && state.status === 'expired' && state.expiredByDeadline && state.expiredEditor
      && state.expiredEditor.clientId && new Date(state.closedAt).getTime() > now.getTime()
      && inspectionWindow(now, Boolean(state.startedAt)) !== 'closed') {
      state = {
        ...state,
        status: 'open',
        editor: { ...state.expiredEditor },
        expiredEditor: null,
        expiredByDeadline: false,
        closedAt: '',
        result: null,
      };
      record('RECUPERA_CIERRE_SINCRONIZADO', state);
    }
    if (state.status === 'open' && weeklyDeadlinePassed(now)) {
      state = expireInspection(state, { at: now.toISOString() });
      record('VENCIMIENTO', state);
    }
    return state;
  }

  function record(type, state) {
    deps.save(state);
    deps.event(type, state);
    return state;
  }

  function writable(state, occurredAt) {
    if (inspectionWindow(operationTime(occurredAt), Boolean(state.startedAt)) === 'closed') {
      throw new Error('Horario de edición cerrado.');
    }
  }

  function requireStateEditor(state, clientId) {
    if (state.status === 'closed' || state.status === 'expired') throw new Error('La inspección ya está cerrada.');
    if (!state.editor || state.editor.clientId !== clientId) throw new Error('El teléfono no tiene la reserva activa de esta estación.');
  }

  return {
    getState(stationId, occurredAt) {
      return current(stationId, occurredAt);
    },
    reserve(stationId, clientId, inspectorName, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      if (state.status === 'closed' || state.status === 'expired') throw new Error('La inspección de esta semana ya está cerrada.');
      writable(state, at);
      return record('RESERVA', reserveInspection(state, { clientId, inspectorName, at: at.toISOString() }));
    },
    requestTakeover(stationId, clientId, inspectorName, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      return record('TOMA_SOLICITADA', requestTakeover(state, { clientId, inspectorName, at: at.toISOString() }));
    },
    acknowledgeTakeover(stationId, clientId, pendingSyncOps, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      const next = acknowledgeTakeover(state, { clientId, pendingSyncOps, at: at.toISOString() });
      return record(next.editor?.clientId === clientId ? 'PULSO' : 'TOMA_CONFIRMADA', next);
    },
    saveAnswer(stationId, clientId, questionId, count, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      return record('RESPUESTA', saveAnswer(state, { clientId, questionId, count }));
    },
    saveFinding(stationId, clientId, questionId, ordinal, finding, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      return record('HALLAZGO', saveFinding(state, { clientId, questionId, ordinal, finding }));
    },
    discardExtraFindings(stationId, clientId, questionId, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      return record('HALLAZGOS_DESCARTADOS', discardExtraFindings(state, { clientId, questionId }));
    },
    reviewKaizen(stationId, clientId, kaizenId, review, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      requireStateEditor(state, clientId);
      if (!state.pendingKaizen.some(item => item.id === kaizenId)) throw new Error('Kaizen pendiente inválido.');
      if (!review || !['solved', 'pending'].includes(review.decision)) throw new Error('Decisión de kaizen inválida.');
      const next = {
        ...state,
        kaizenReviews: { ...state.kaizenReviews, [kaizenId]: { ...review } },
      };
      return record('REVISION_KAIZEN', next);
    },
    release(stationId, clientId, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      return record('GUARDAR_Y_SALIR', releaseInspection(state, { clientId, at: at.toISOString() }));
    },
    close(stationId, clientId, occurredAt) {
      const at = operationTime(occurredAt);
      const state = current(stationId, at);
      writable(state, at);
      const late = inspectionWindow(at, Boolean(state.startedAt)) === 'late-continuation';
      return record('CIERRE', closeInspection(state, {
        clientId,
        at: at.toISOString(),
        completionStatus: late ? 'cumplida-con-atraso' : 'cumplida',
      }));
    },
  };
}
