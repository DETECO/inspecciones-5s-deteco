# Progreso — administración 5S (2026-10-01)

Diseño aprobado y plan en docs/superpowers/plans/2026-10-01-admin-settings-plan.md.
Base funcional: 81938518ab0b9b19159c0fedb61e305abcc4b1f1. Rama: codex/admin-settings-20261001.

- home_fit: portada e icono terminados; comprobados 320×568, 375×667, 390×844 y escritorio, controles visibles.
- settings_backend: calendario, encargados y lecturas terminados. Revisión independiente detectó ruta antigua; bloqueada con horarios personalizados y validada en pruebas.
- notifications_backend: avisos privados, informes y autorización terminados. Corregidos bloqueo durante envío, cuota agotada y consulta de cuota fallida.
- root: panel integrado con Horarios/Correos y diálogo de encargado. Tres pruebas UI verdes; formularios simulados comprobados. Confirmaciones nuevas internas para evitar ventanas sobre el chat.
- Integración de bundles terminada, revisión independiente aplicada y 202 pruebas integradas aprobadas, 0 fallos.
- Verificación remota detectó regreso de cuenta al iframe; doGet ahora inserta la dirección real del despliegue. Prueba de regresión incluida.
- Respaldo del despliegue actual versión 7 guardado en tmp/app5s-admin-backup-20261001.
- Apps Script: versión 9 activa en el mismo deployment. Panel HTTP200, menú y retorno de cuenta comprobados en el navegador. Solicitud final-state con QR falso lee Accesos y devuelve «Acceso QR inválido», sin escribir ni reservar estación. GitHub y Pages pendientes.

No se han cambiado datos operativos ni enviado correos de prueba. El nuevo enlace superior vuelve al escáner y no cierra Google.
