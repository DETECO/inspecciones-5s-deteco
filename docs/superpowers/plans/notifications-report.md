# Avisos 5S — informe de implementación

## Archivos

- `backend/Notifications.gs`: configuración privada en Script Properties, comprobantes de envío, cola de cierres y proceso programado.
- `backend/tests/notifications.test.cjs`: dobles locales de Apps Script; no se enviaron correos reales.

## Integración requerida

1. Cargar `Notifications.gs` después de `AdminSettings.gs` y antes de `FinalSubmission.gs`/`Code.gs` en el bundle de despliegue.
2. Tras la materialización confirmada de un cierre, llamar `app5sNotifyClosedSafe_(state)` dentro del bloqueo existente. La función solo deja una tarea privada por estación/semana; no llama a MailApp y no propaga errores. En un reintento de cierre es seguro volver a llamarla.
3. Exponer `app5sAdminNotificationSettings()` y `app5sAdminSaveNotifications({config})` solo en el panel administrativo; ambas verifican permiso `configure`. No incluir destinatarios en el repositorio cliente ni en respuestas públicas.
4. Tras habilitar un tipo de aviso, el propietario debe ejecutar una vez `autorizarAvisosApp5S()` desde Apps Script con su propia cuenta. La función comprueba MailApp, autorización FULL y crea un trigger cada 5 minutos. No se ejecutó aquí. Mientras falte, la API devuelve `authorizationRequired: true`; ningún worker envía correos. La hora semanal de viernes es aproximada dentro de la ventana de Apps Script.

## Comportamiento

- Ambos interruptores comienzan apagados. Los destinatarios se validan, deduplican y limitan a 50 correos únicos. Cada correo se envía individualmente y recibe solo sus estaciones autorizadas.
- El aviso de cierre se encola al cerrar y lo procesa `app5sProcessNotifications()` en una ejecución posterior. Si se agota la cuota, la cola conserva a los destinatarios pendientes. Un intento de MailApp con resultado incierto queda registrado y no se reenvía automáticamente.
- El worker toma el bloqueo global solo al reclamar un comprobante para cada destinatario y lo libera antes de consultar cuota o enviar con MailApp. Así, una entrega lenta no retiene el bloqueo de inspecciones y administración.
- El resumen semanal usa semana ISO y hora de Chile; separa nota 5S y GD, y marca `parcial` cuando queda un horario habilitado después del envío. La ausencia de inspección dice `Sin nota`.
- Los comprobantes de más de ocho semanas se podan sin tocar la cola ni las inspecciones. Los envíos no modifican las tablas históricas.

## Pruebas

`node --test backend/tests/notifications.test.cjs`: rojo inicial por funciones ausentes (6 fallos); rojo de la mejora de cola por envío síncrono (1 fallo); rojo de cuota por pérdida de destinatario pendiente (1 fallo); rojo de bloqueo retenido durante MailApp (5 fallos de los escenarios de envío); rojo por excepción al consultar cuota (1 fallo). Resultado final: **9 pruebas aprobadas, 0 fallidas**. Una consulta de cuota fallida queda pendiente y puede reintentarse sin marcar como incierto un correo que aún no se intentó enviar.

No se verificó autorización de Google ni entrega de correo real: requieren instalación y ejecución del propietario. No se creó trigger ni se enviaron correos. La integración final del root está desplegada como versión 9 del proyecto real y publicada en GitHub, con 202 pruebas integradas aprobadas; el permiso humano aprobado no sustituye el consentimiento que Google solicitará al propietario al activar estos servicios.
