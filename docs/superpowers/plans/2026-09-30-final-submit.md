# Guardado solamente al cierre

Goal: inspeccionar sin sincronizar respuestas ni retomar; guardar el registro completo solamente al cerrar con confirmación.
Architecture: la interfaz conserva una inspección nueva en memoria por carga de página. Apps Script mantiene una reserva separada en ScriptProperties. Al cerrar sube fotos con identificadores estables y luego envía las 25 respuestas con los identificadores confirmados. El servidor valida y calcula resultados, guarda por estación/semana ISO y materializa los registros de manera repetible.
Tech Stack: módulos JavaScript existentes, Apps Script, Sheet y Drive autorizados.

## Restricciones
- No eliminar registros, avances antiguos ni archivos reales.
- Sin retomar, tomar control, cola incremental o cierre offline en el nuevo flujo.
- Reserva exclusiva por estación/semana; el mismo teléfono puede comenzar de cero con otro sessionId, invalidando la sesión anterior; otro teléfono requiere liberación administrativa.
- No escribir en el Sheet ni subir fotos durante las preguntas.
- Guardar fotos solo durante cierre; comprimir con el módulo existente; reintentos usan los mismos IDs.
- Mantener QR, horario Chile, 25 respuestas, Kaizen pendientes, identidad visual y permisos administrativos.
- Confirmar publicación frontend y backend por separado, sin declarar pruebas reales que no se hicieron.

## Protocolo
- `begin-final`: {stationId, clientId, sessionId, inspectorName}; reserva en propiedades y devuelve state nuevo, station e inspectorNames. Estado cerrado existente es autoritativo. Sin escritura Sheet.
- `upload-final-photo`: {stationId, clientId, sessionId, photoId, category, dataUri}; category Hallazgos o Cierres kaizen; valida reserva y devuelve {photoId: driveId}. Conserva comprobante propio de reserva/foto en propiedades para validar cierre.
- `submit-final`: {stationId, clientId, sessionId, occurredAt, answers, findings, kaizenReviews}; valida horario/timestamp, reserva, todas las respuestas, ordinales/fotos propias y Kaizen. Calcula resultado servidor; persiste y materializa cierre. Igual sessionId reintenta sin duplicar; cierre distinto bloquea. Una materialización interrumpida se completa al reintentar.
- `final-state`: solo lectura de estado final/reserva, sin expirar o materializar parcialmente.

## Task 1: backend
Files: backend/FinalSubmission.gs, backend/Code.gs, backend/build-deploy.cjs, backend/tests/final-submission.test.cjs.
- [x] Crear pruebas: inicio sin escritura Sheet; rechazo reserva ajena; 25 respuestas→cierre; foto propiedad ajena; cierre repetido; fallo materialización→reintento; admin libera reserva nueva; respuestas anteriores no retomadas.
- [x] Ejecutar pruebas y verificar falla por protocolo ausente (3 pruebas rojas).
- [x] Implementar protocolo en archivo separado, reutilizar validadores/domain/materialización. Integrar dispatcher antes de protocolo antiguo y reservas en snapshot/release admin.
- [x] Ejecutar pruebas enfocadas y reportar resultado: 22 pruebas de backend aprobadas; reporte separado.

## Task 2: frontend
Files: client/app.mjs, client/final-submit.mjs, index.html, tests/final-submit.test.mjs, tests/answer-sync-ui.test.mjs, tests/identity-refresh.test.mjs.
- [x] Prueba roja del cambio: contestar no envía; cerrar sube foto y snapshot; reintento conserva IDs y datos; no summary sin confirmación; no retomar borrador.
- [x] Nuevo módulo `submitFinalInspection({session, inspection, sessionId, occurredAt, uploadCache})`: secuencia de fotos y submit-final, devuelve receipt; no mutar respuestas originales.
- [x] App usa begin-final para inicio, conserva respuestas/fotos solo memoria; no draftLoad ni poll ni flush automático. Antes de cerrar valida y conserva occurredAt en reintentos. Actualiza textos y beforeunload.
- [x] Invalidar caché de app y módulo nuevo en index/imports; ejecutar pruebas UI. 20 pruebas enfocadas aprobadas; revisión independiente y recorrido local de 25 preguntas completados.

## Task 3: revisión y publicación
- [x] Suite completa: 163 aprobadas; bundle compilado y sintaxis válida; diffs comprobados. Revisión independiente frontend aprobada. Backend validado mediante pruebas unitarias e integración con datos en memoria.
- [x] Subir únicamente proyecto Apps Script autorizado con clasp; actualizar deployment existente sin cambiar URL y sin ejecutar instalación ni reserva real. Activada versión 6.
- [x] Publicar GitHub: commit `49c1db68d4ae08b9a4f5e1342a22679deb3cdca9`, Pages completado con éxito. Index/app/final-submit públicos coinciden con los archivos locales; navegador carga sin errores. No se creó inspección real.
