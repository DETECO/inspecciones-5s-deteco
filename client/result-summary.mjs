import { MODULES, DAILY_MANAGEMENT } from '../domain/catalog.mjs?v=20261001-gd';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icon = (name, className = '') => `<img class="result-icon ${className}" src="./assets/icons/${name}.svg" alt="" aria-hidden="true">`;
const moduleIcons = { separar: 'cube', organizar: 'stack-2', limpiar: 'sparkles', estandarizar: 'file-text', sustentar: 'users' };

export function scorePresentation(score) {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 5) {
    return { tone: 'neutral', label: 'Sin nota', icon: 'alert-circle', text: '—' };
  }
  const excellent = score === 5;
  const good = score >= 4.5;
  let shown = Math.round(score * 100) / 100;
  // Never round across a classification boundary or grant a perfect displayed score.
  if ((score < 4.5 && shown >= 4.5) || (score < 5 && shown >= 5)) shown = Math.floor(score * 100) / 100;
  const decimals = Math.abs(shown * 10 - Math.round(shown * 10)) < 1e-8 ? 1 : 2;
  return { tone: good ? 'green' : 'red', label: excellent ? 'Excelente' : good ? 'Satisfactoria' : 'Requiere mejora',
    icon: excellent ? 'award' : good ? 'circle-check' : 'alert-circle', text: shown.toFixed(decimals).replace('.', ',') };
}

function closureDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = name => parts.find(p => p.type === name)?.value || '';
  return `${part('day')}-${part('month')}-${part('year')} · ${part('hour')}:${part('minute')}`;
}

export function renderResultSummary({ inspection, stationName, mode }) {
  const result = inspection.result;
  const score = scorePresentation(result.finalScore);
  const finalized = ['closed', 'expired'].includes(inspection.status);
  const saved = mode === 'bridge' && finalized && inspection.finalMaterialized === true;
  const canLeave = finalized && (mode !== 'bridge' || saved);
  const gd = result.dailyManagement;
  const gdScore = gd?.applicable === true ? scorePresentation(gd.score) : null;
  const count = questions => questions.reduce((sum, q) => sum + (inspection.findings?.[q.id]?.length || 0), 0);
  const count5s = count(MODULES.flatMap(m => m.questions));
  const countGd = gd?.applicable === true ? count(DAILY_MANAGEMENT.questions) : 0;
  const findings = `${count5s} ${count5s === 1 ? 'hallazgo' : 'hallazgos'} 5S${gd?.applicable === true ? ` · ${countGd} ${countGd === 1 ? 'hallazgo' : 'hallazgos'} GD` : ''}`;
  const date = closureDate(inspection.closedAt);
  const completion = result.completionStatus === 'vencida-cerrada-incompleta' ? 'Cerrada incompleta al vencer la semana; nota 0 en todos los módulos.'
    : result.completionStatus === 'cumplida-con-atraso' ? 'Cumplida con atraso.' : '';
  return `<section class="result-summary page-enter" aria-labelledby="result-title">
    <img class="result-brand" src="./assets/deteco-wordmark.jpg" alt="DETECO — Desarrollo de tecnologías para la construcción">
    <div class="result-context"><span>Inspección 5S</span><strong>${escape(stationName)}</strong><small>${escape(inspection.week.replace('-W', ' · S'))}</small></div>
    <div class="result-hero result-${score.tone}"><h1 id="result-title">Inspección finalizada</h1><div class="result-score-line"><div><span>Nota final</span><strong>${score.text}</strong></div>${icon(score.icon, 'result-hero-icon')}</div></div>
    <div class="result-verdict"><strong class="result-tone-${score.tone}">${score.label}</strong><span class="result-saved ${saved ? 'is-saved' : ''}">${icon(saved ? 'circle-check' : 'info-circle')}${saved ? 'Guardada' : mode !== 'bridge' ? 'Prueba local' : 'Guardado sin confirmar'}</span></div>
    <h2>Resultados 5S</h2><div class="result-modules">${MODULES.map(module => {
      const presentation = scorePresentation(result.moduleScores?.[module.id]);
      const title = module.title.charAt(0) + module.title.slice(1).toLocaleLowerCase('es-CL');
      return `<div class="result-module-row">${icon(moduleIcons[module.id])}<strong>${escape(title)}</strong><span class="result-tone-${presentation.tone}" aria-label="${escape(title)}: ${presentation.text}. ${presentation.label}">${presentation.text}</span></div>`;
    }).join('')}</div>
    <div class="result-gd">${icon('chart-bar')}<div><strong>Gerenciamiento diario</strong><small>Nota independiente</small></div><span class="${gdScore ? `result-tone-${gdScore.tone}` : ''}">${gdScore ? gdScore.text : gd?.applicable === false ? 'No aplica' : 'No evaluado'}</span></div>
    <div class="result-details"><p>${escape(findings)}</p>${inspection.closedBy ? `<p>Inspector: ${escape(inspection.closedBy)}</p>` : ''}${date ? `<p>Cierre: ${escape(date)}</p>` : ''}${completion ? `<p class="result-completion">${escape(completion)}</p>` : ''}</div>
    <button class="primary result-home" type="button" data-action="return-home"${canLeave ? '' : ' disabled'}>Volver al inicio</button>
  </section>`;
}
