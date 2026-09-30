# Guardado final: implementación y verificación

Fecha: 2026-09-30. Implementación final del backend realizada por el agente principal.

## Cambios

- `FinalSubmission.gs` implementa inicio, reserva independiente, recibos de fotografías propios, estado de solo lectura y cierre completo.
- `Code.gs` integra el protocolo tras validar el QR y bajo el bloqueo existente; administración muestra y libera las reservas temporales.
- Solo cerrar escribe las respuestas en el Sheet. Las fotos se envían durante ese cierre, no durante las preguntas.
- El snapshot cerrado se conserva antes de materializar tablas; un fallo puede reintentarse desde la misma página. Una confirmación perdida no duplica filas ni repite el conteo de inspector tras materialización confirmada.
- Se conservan los datos antiguos. La limpieza afecta únicamente reservas y recibos temporales de este protocolo de semanas anteriores; nunca archivos Drive ni filas del Sheet.

## Evidencia

`node --test backend/tests/final-reservation.test.cjs`: primera ejecución 3 fallos porque faltaba `app5sFinalHandle_`; implementación posterior 3 aprobados. Prueba añadida de cierre confirmado repetido falló por escrituras repetidas (5 frente a 3); marcador durable de materialización corrigió el caso. Con fotografía propia y rechazo de referencia ajena: 4 aprobados.

`node --test backend/tests/integration.test.cjs backend/tests/final-reservation.test.cjs`: 22 aprobados. El simulador existente ejecuta el dispatcher y las funciones reales con Sheet/Drive en memoria. Verifica todas las tablas idénticas antes y después de inicio/subida de foto; tras cierre hay una inspección, 25 respuestas y un hallazgo. Repetir el cierre no cambia las tablas. Administración puede liberar una reserva nueva.

`node --test tests/*.test.mjs backend/tests/*.test.cjs`: 163 aprobados, 0 fallidos. Bundle generado analizado con `vm.Script` sin errores de sintaxis. Recorrido de navegador local: 25 preguntas, vuelta al primer módulo conservando respuestas, revisión 100% y cierre local correcto.

## Límites

Las pruebas no crearon ni liberaron reservas reales, no escribieron inspecciones en producción y no simulan todos los permisos/redes de iOS. La prueba real desde el teléfono sigue siendo necesaria. Salir o recargar antes de cerrar descarta las respuestas en memoria; no existe retomar. Si falla el envío, mantener esa página abierta para reintentar.
