# Claridad del panel administrativo

Solicitud aprobada: corregir los mensajes y evaluar el botón de actualización.

Diagnóstico: la tarjeta traduce cualquier estado histórico open como En progreso aunque no haya editor ni reserva activa. La consulta administrativa es de lectura; no corrige ese registro. El botón sí permite ver cierres desde otros dispositivos y tiene valor sin un sistema de consultas periódicas.

Cambio acotado: conservar los estados y registros del Sheet. Mostrar Pendiente cuando no hay cierre ni editor activo; mostrar En progreso solo con reserva/editor. No mostrar inspector ni inicio de una prueba antigua como si estuviera activa. Mantener Cerrada y Cerrada incompleta, QR, encargados, permisos y liberación de reservas reales. Quitar textos técnicos de ausencia de editor y liberación cuando no hay reserva.

Mantener una consulta manual secundaria llamada Ver últimos estados, con ayuda que explique lectura sin modificar datos. Ocultarla en formularios Horarios/Correos para no descartar ediciones; sus formularios conservan Guardar y Reintentar. La sección Correos se presenta como Correos y resúmenes para que el envío semanal sea localizable.

Pruebas: reproducir tarjeta antigua sin editor; comprobar reserva activa, cierre, vencimiento y cambio de estado entre consultas. Pruebas de navegación y botón; suite completa y bundle. Respaldar Apps Script v9, desplegar el mismo enlace, subir main y verificar Pages/HTML remoto. No borrar históricos, liberar estaciones ni enviar correos reales.

Verificación ejecutada: 208 pruebas aprobadas, cero fallos. Vista móvil de 390 x 844 comprobada con datos simulados: botón secundario, ayuda de última consulta y navegación Correos y resúmenes; al consultar de nuevo se refleja el cierre simulado. Formularios de configuración sin botón de consulta. Código de servidor y manifiesto idénticos al respaldo v9; únicamente cambia el HTML del panel. Apps Script actualizado a v10 en el mismo despliegue. No se modificaron registros históricos, encargados reales, destinatarios ni horarios, ni se enviaron correos.
