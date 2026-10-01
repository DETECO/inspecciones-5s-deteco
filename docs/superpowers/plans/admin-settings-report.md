# Horarios y encargados — implementación

- `domain/calendar.mjs`: `DEFAULT_INSPECTION_SCHEDULE`, `normalizeInspectionSchedule(value)`, `inspectionWindow(date, started, schedule = DEFAULT_INSPECTION_SCHEDULE)` y `weeklyDeadlinePassed(date, schedule = DEFAULT_INSPECTION_SCHEDULE)`. Días en orden Mon..Sun; zona America/Santiago. El valor inicial reproduce el horario anterior.
- `backend/AdminSettings.gs`: `app5sScheduleConfig_()`, `app5sAdminSettings()`, `app5sAdminSaveSchedule({ schedule })` y `app5sAdminUpdateOwner({ stationId, owner, expectedOwner })`. La lectura entrega `{ schedule, permissions, adminEmail }`; guardar horario entrega el mismo objeto; actualizar encargado entrega el snapshot administrativo. Solo `configure` modifica; el encargado admite vacío o hasta 100 caracteres, sin fórmulas ni controles. Se actualiza únicamente Configuracion D y se audita cada cambio efectivo.
- `backend/FinalSubmission.gs`: `begin-final` valida el horario vigente y guarda su copia en la reserva; el cierre usa esa copia y exige la misma semana ISO. El estado público entrega `schedule` para la sesión. La app deja al servidor decidir el inicio, aplica el horario recibido al cierre y muestra un aviso genérico antes del inicio.
- `backend/Code.gs`: el snapshot administrativo abre el libro una vez y lee Configuracion, Estado y Accesos una vez por pestaña; entrega `owner` separado del inspector. Los QR siguen disponibles solo para quien puede configurar.
- `client/app.mjs`: también se integraron el icono de configuración y la clase `home-shell` solicitados por integración.

Verificación integrada final: 202 pruebas aprobadas, 0 fallos. Hay pruebas de viernes habilitado, límites, validación, permisos, encargado, sesión congelada, lecturas agrupadas, cuota y regreso al panel al cambiar cuenta.

Revisión de integración: al existir un horario configurado, el servidor bloquea las operaciones antiguas antes de cualquier escritura y solicita actualizar la app. El recorrido actual usa `begin-final` y `submit-final`. El cierre valida la hora real del servidor, no una fecha pasada enviada por el cliente; hay pruebas de ambas protecciones.
