# Inicio y administración — Implementation Plan

**Goal:** Entregar la portada ajustada, panel rápido, encargados, horarios y avisos aprobados.
**Architecture:** Extender ES modules y Apps Script existentes. Separar settings y notificaciones del protocolo de cierre; Google sigue validando permisos y horarios. Integración central con propiedad exclusiva de archivos por agente.
**Tech Stack:** JavaScript ES modules, Apps Script V8, Google Sheets/Drive, node:test, GitHub Pages.

## Global Constraints
- Identidad DETECO blanca/gris/naranjo y fotografía aprobada; ninguna ilustración decorativa nueva.
- No retomar, no guardados intermedios, 25 preguntas más GD opcional intactos.
- Permisos administrativos actuales; no publicar datos ni destinatarios privados en GitHub.
- No borrar datos históricos, liberar estaciones ni enviar correos reales durante pruebas.
- Horarios America/Santiago; nuevos horarios solo para nuevas sesiones y semana ISO.
- Correos deshabilitados hasta que administrador configure y habilite; insignia fuera del alcance.

## Task 1: Portada — agente de UI
Archivos: styles.css, assets/icons/settings.svg y tests/home-viewport.test.mjs. Contrato: icono settings.svg de interfaz centrado 24×24, control 44px; selector .shell.home-shell ajusta portada a altura visible sin cortar texto accesible. Root modifica header markup y clase.
- [x] Test fallido de portada e icono, ejecutar node --test tests/home-viewport.test.mjs.
- [x] Implementar grid adaptable: foto flexible, contenido/controles sin overflow oculto. Comprobar prueba verde y registrar informe docs/superpowers/plans/home-ui-report.md.
- [x] Root: verificar en vista móvil y escritorio.

## Task 2: Horarios/encargados/lectura — agente de settings
Archivos: domain/calendar.mjs, backend/AdminSettings.gs, backend/Code.gs, backend/FinalSubmission.gs, client/app.mjs y pruebas propias. No editar Admin.html, styles.css ni build-deploy.cjs.
Interfaces: normalizeInspectionSchedule(value), DEFAULT_INSPECTION_SCHEDULE; inspectionWindow(date,started,schedule=default), weeklyDeadlinePassed(date,schedule=default). Backend app5sScheduleConfig_(), app5sAdminSettings(), app5sAdminSaveSchedule({schedule}), app5sAdminUpdateOwner({stationId,owner,expectedOwner}). Settings state {schedule,permissions,adminEmail}; schedule {days:[{day:'Mon',enabled:true,start:'08:15',lastStart:'17:00',end:'17:00'},...]} para 7 días Mon..Sun. Guardar snapshot schedule en lease y estado al iniciar y usarlo al cerrar.
- [x] Escribir tests de Friday habilitado, invalidación, límites, sesiones congeladas, permisos/owner y lectura agrupada. Ver rojos con node --test backend/tests/admin-settings.test.cjs tests/calendar.test.mjs.
- [x] Implementar validación, persistencia/auditoría, snapshot rápido por lote, nombre encargado separado y servidor como autoridad. App no bloquea inicio por reglas antiguas ni reintroduce llamadas bloqueantes al escanear.
- [x] Verificar verdes, informar firmas exactas e integración en docs/superpowers/plans/admin-settings-report.md.

## Task 3: Avisos — agente de correo
Archivos: backend/Notifications.gs y backend/tests/notifications.test.cjs exclusivamente.
Interfaces: app5sAdminNotificationSettings() -> {config,lastStatus,authorizationRequired}, app5sAdminSaveNotifications({config}) -> mismo; config {weeklyEnabled:false,closedEnabled:false,weeklyHour:16,generalRecipients:[],stationRecipients:{}}. app5sNotifyClosedSafe_(state) no propaga error al cierre; app5sProcessNotifications() callback trigger; autorizarAvisosApp5S() función que ejecutará el propietario si requiere autorización adicional.
- [x] Escribir tests de disabled/no send, validación, permisos, ISO, notas GD separadas, parciales Friday, duplicados/cuota/fallos. Ejecutar node --test backend/tests/notifications.test.cjs y verificar rojo.
- [x] Implementar configuración privada, informes y registros de envío. Validar @ y caracteres de encabezado, limitar destinatarios, envíos individuales para no compartir lista. No usar HTML sin escapar ni publicar tokens. Crear programación solo al habilitar o autorizar explícitamente; de ser necesario indicar autorización requerida y no reportar enabled/ready falsamente.
- [x] Verificar verde e informar en docs/superpowers/plans/notifications-report.md. No ejecutar función real, no correos reales ni mutaciones externas.

## Task 4: Panel e integración — root
Archivos: backend/Admin.html, backend/build-deploy.cjs, index.html y tests/admin-settings-ui.test.mjs. Tras agentes: icono/clase en client/app.mjs si falta, hook de correo en FinalSubmission.gs y bundles generados.
- [x] Escribir pruebas UI de menús Horarios/Correos, encargado y advertencia contextual; comprobar fallo.
- [x] Añadir formularios, confirmación y estados de error/guardado sin alterar sesiones históricas ni permisos. Frontend de settings carga solo al abrir menú.
- [x] Integrar bundles: [Bridge, core, Service, AdminSettings, Notifications, FinalSubmission, Code]. Hook de correo seguro después de materialización confirmada; reintentos no duplican.
- [x] Ejecutar node --test tests/*.test.mjs backend/tests/*.test.cjs; VM sintaxis, diff y revisión independiente de especificación/calidad.

## Task 5: Publicación
- [x] Respaldar Apps Script versión activa 7; generar release y verificar coincidencia/sintaxis/manifest.
- [x] Publicar nueva versión en deployment existente sin modificar acceso ni scopes por cuenta propia. Si Google exige autorización adicional, entregar instrucción y no declarar envíos activos.
- [x] Commit de feature, merge fast-forward y push main; verificar Actions exitoso y archivos Pages HTTP200 idénticos.
- [x] Informe de publicación y pruebas en .superpowers/sdd/progress.md. Avisos pendientes de destinatarios y autorización de Google por el propietario; sin envíos reales de prueba.
