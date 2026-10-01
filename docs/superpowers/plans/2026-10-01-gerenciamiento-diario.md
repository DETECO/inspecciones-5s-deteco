# Gerenciamiento Diario Implementation Plan

**Goal:** Añadir el módulo opcional aprobado sin cambiar la nota 5S ni el guardado al cierre.
**Architecture:** Catálogo GD separado y lista de preguntas activa por decisión. Snapshot único con validación de servidor, misma persistencia y fotos; interfaz reutiliza tarjetas existentes.
**Tech Stack:** ES modules, Apps Script, Sheets, Drive, node:test.

## Global Constraints
- 25 preguntas 5S existentes intactas; 8 GD opcionales, obligatorias si corresponde.
- 0–5 hallazgos y una foto por hallazgo, nota GD separada.
- Sin guardados intermedios, ni retomar, ni cambios de horario/autenticación.
- No borrar datos históricos ni cambiar columnas existentes.

## Task 1: Dominio y servidor
- [ ] Añadir tests de catálogo GD, cierre opcional, nota independiente, faltantes/fotos, payload inválido y compatibilidad antigua.
- [ ] Ejecutar `node --test tests/daily-management.test.mjs backend/tests/final-reservation.test.cjs` y comprobar fallo por función faltante o GD rechazado.
- [ ] Modificar `domain/catalog.mjs`, `domain/scoring.mjs`, `domain/inspection.mjs`, añadir `domain/daily-management.mjs` y registrar en `backend/build-core.cjs`.
- [ ] Validar decisión y 25/33 respuestas en `backend/FinalSubmission.gs`. Reutilizar `app5sFinalSnapshot_` y recibos existentes.
- [ ] Persistir preguntas GD y nota independiente en `backend/Code.gs`; incluir GD en la consulta Kaizen y no descartar sus hallazgos al sincronizar el cierre.
- [ ] Ejecutar tests de dominio y servidor, incluyendo materialización idempotente.

## Task 2: Recorrido y envío
- [ ] Añadir tests de UI para decisión después de 25, No/cancelar/confirmar, Sí/ocho preguntas, navegación y cierre con fotos.
- [ ] Ejecutar `node --test tests/final-flow-ui.test.mjs tests/final-submit.test.mjs` para comprobar nuevos fallos.
- [ ] Modificar `client/app.mjs` y `client/final-submit.mjs`: pantalla de decisión, módulo GD, contador dinámico, confirmación, resultado separado y campo de decisión en envío final.
- [ ] Verificar que responder o cambiar módulos no realiza llamadas a Google y que cancelar no cierra.

## Task 3: Revisión y publicación
- Revisión independiente solicitada, pero no ejecutada por límite de uso del agente. Revisión manual del responsable y pruebas ampliadas como alternativa; no se atribuye aprobación al agente.
- [ ] Ejecutar `node --test tests/*.test.mjs backend/tests/*.test.cjs`, generar paquete con `node backend/build-deploy.cjs`, comprobar sintaxis y diff.
- [ ] Respaldar código desplegado, subir backend autorizado y actualizar implementación existente.
- [ ] Publicar frontend con nuevas claves de versión; verificar Pages HTTP 200 y contenido idéntico local/publicado.
- [ ] Informar pruebas, publicación y cualquier límite de verificación desde teléfono.

## Evidencia de ejecución
- Tareas 1 y 2 completadas con ciclos de prueba fallida y corrección.
- Suite completa: 178 pruebas aprobadas, 0 fallos (2026-10-01).
- Navegador local: ambos recorridos cerrados; GD muestra 8 preguntas, 33/33 respuestas y nota independiente. Sin errores de consola. Configuración local sin conexión a Google; no se crearon registros reales.
- Respaldo del código desplegado v6 conservado en `../app5s-gd-backup-20261001`.
- Apps Script cargado y deployment existente actualizado a v7, con URL, permisos y horario conservados.
- Pendiente al escribir esta evidencia: publicar y comprobar contenido público de GitHub Pages. La comprobación desde un teléfono real corresponde a las pruebas del usuario.
