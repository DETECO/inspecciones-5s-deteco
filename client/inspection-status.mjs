import { inspectionWindow } from '../domain/calendar.mjs?v=20261001-admin-settings';

export function inspectionStatus({ online, checking, validated, serverConfirmed, error, inspection, clientId, now, identity, closing, progress } = {}) {
  const result = (tone, label, reason) => ({ tone, label, reason });
  if (inspection?.status === 'closed' && !identity) return result('green', 'Guardada', 'La inspección está cerrada y su guardado fue confirmado.');
  if (!online) return result('red', 'Sin conexión', 'Necesitas conexión a internet. Mantén esta página abierta para conservar tus respuestas.');
  if (checking) return result('amber', 'Validando', 'Estamos comprobando el QR, el horario y la disponibilidad de la estación. Todavía no se ha reservado ni guardado una inspección.');
  if (closing) return result('amber', 'Enviando', progress || 'Se están enviando las respuestas y fotografías. No cierres esta página.');
  if (error) return result('red', 'No disponible', error);
  if (!validated || !serverConfirmed) return result('amber', 'Por validar', 'Falta confirmar el acceso y el horario con el servidor. Pulsa Volver a comprobar.');
  if (['closed', 'expired'].includes(inspection?.status)) return result('red', 'Ya cerrada', 'La inspección de esta estación ya está cerrada esta semana. No se puede iniciar otra.');
  if (inspection?.editor && inspection.editor.clientId !== clientId) return result('red', 'Ocupada', 'La estación tiene una inspección activa en otro dispositivo. Si fue abandonada, solicita su liberación al administrador.');
  if (!inspection?.schedule || !Number.isFinite(now?.getTime())) return result('amber', 'Por validar', 'No se pudo confirmar el horario de la estación. Pulsa Volver a comprobar.');
  const started = !identity && Boolean(inspection?.startedAt);
  const windowState = inspectionWindow(now, started, inspection.schedule);
  if (windowState === 'closed') return result('red', 'Fuera de horario', 'El horario de inspecciones está cerrado en este momento (hora de Chile). Los días y horas habilitados se configuran en Administración → Horarios.');
  if (windowState === 'late-continuation') return result('amber', 'Solo cierre', 'Ya no se pueden iniciar inspecciones. Puedes terminar esta inspección dentro del horario de cierre permitido.');
  return result('green', started ? 'En curso' : 'Disponible', started ? 'La inspección está habilitada. Las respuestas y fotos se enviarán únicamente al cerrar.' : 'QR reconocido, horario habilitado y estación disponible. Escribe tu nombre y pulsa Iniciar inspección. El servidor volverá a comprobar la disponibilidad al iniciar.');
}
