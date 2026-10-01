# Inicio, encargados, horarios y avisos — propuesta para aprobación

Estado: aprobado por Ivan el 2026-10-01; implementación y publicación pendientes.

## Diagnóstico confirmado en el código actual
- El SVG del engranaje dibuja el contorno descentrado respecto de su círculo central.
- La portada suma un encabezado, una foto con mínimo de 300 px, textos, controles y márgenes. No distribuye estos elementos dentro de la altura disponible del teléfono.
- Admin.html conserva una advertencia permanente de sincronización y una confirmación de liberación del flujo anterior. Ese texto no es un error de autenticación de Google.
- El snapshot administrativo lee Estado y Accesos por cada estación; cada consulta vuelve a abrir el libro. Es trabajo repetido evitable. No se ha medido aún el tiempo real de Google.
- Configuracion ya tiene la columna Encargado del área y el servidor la utiliza para atribuir Kaizen nuevos, pero el panel no permite editarla.
- No existe implementación de MailApp ni programación semanal en el backend actual.
- Los días, apertura y límite de cierre se encuentran fijos en domain/calendar.mjs. La app y el servidor usan esas reglas; cambiar solo la interfaz dejaría bloqueos contradictorios.

## Enfoque recomendado
Ampliar la app existente, sin sustituir la autenticación, el Sheet o el backend. La alternativa de migrar a otro servicio de datos no se justifica para estos cambios. Editar solo el Sheet manualmente tampoco cubriría la configuración solicitada en el panel.

## Inicio
Conservar foto, logo y colores aprobados. Sustituir el engranaje por un icono de interfaz centrado y legible, con control táctil de al menos 44 px. La portada usa el alto disponible del navegador y reduce primero la fotografía y márgenes para que Escanear QR y Ver instrucciones sean visibles sin desplazamiento en teléfonos habituales. No ocultar controles con overflow ni impedir el desplazamiento cuando el usuario aumenta el texto por accesibilidad. Las instrucciones siguen en un diálogo.

## Administración
Eliminar el aviso permanente obsoleto. La advertencia solo aparece al liberar una reserva activa: explica que las respuestas aún no enviadas no se recuperan ni se retoman y que una nueva inspección empieza de cero. No borrar registros históricos ni liberar estaciones automáticamente.

Agrupar las lecturas de Estado y Accesos, abrir el libro una vez por ejecución y mantener las comprobaciones de cuenta y permisos en el servidor. No usar datos privados en cachés públicas ni prometer un tiempo fijo de respuesta de Google.

## Encargados
Cada tarjeta muestra el encargado del área por separado del inspector que inició la inspección. Quienes tengan permiso de configuración pueden agregar, cambiar o quitar ese nombre. Guardar exclusivamente la columna existente Encargado del área, validar el nombre y protegerlo de fórmulas. Registrar cambios en Auditoria. La asignación rige hacia adelante y no sobrescribe responsables ni Kaizen históricos.

## Avisos por correo
Nueva sección lateral Correos, disponible para configuración autorizada. Permite guardar destinatarios del resumen general y destinatarios por estación, habilitar el resumen semanal de viernes y elegir su hora en America/Santiago. Hora inicial propuesta: 16:00. La programación de Apps Script utiliza una ventana horaria aproximada, no garantiza un minuto exacto.

Incluir también el interruptor separado de aviso al cerrar una inspección solicitado anteriormente. Ambos envíos quedan desactivados hasta que el administrador configure destinatarios y los habilite. No enviar pruebas ni emails a destinatarios inventados.

El resumen usa semana ISO: estaciones activas, cerradas, sin cierre y vencidas; porcentaje de estaciones cerradas sobre las activas; nota 5S de cada inspección cerrada y promedio de las cerradas; GD independiente solo cuando aplica; hallazgos y Kaizen pendientes. No presentar ausencia de inspección como nota cero ni mezclar el puntaje GD con 5S. Filtrar los resúmenes por estación cuando corresponda.

Mantener los registros de configuración y envíos separados de las inspecciones, sin mover sus columnas. Validar correos y límites de destinatarios, evitar envíos repetidos por semana/estación y permitir consulta del resultado o error del último envío. Un fallo de correo nunca impide cerrar la inspección ni cambia su resultado. Si Google requiere una autorización adicional para enviar correo o crear la programación, solicitarla antes de activar el servicio.

## Horarios de inspección
Nueva sección lateral Horarios para usuarios con permiso de configuración. Regla general para todas las estaciones: habilitar o deshabilitar cada día de lunes a domingo y definir inicio, límite para iniciar y límite para terminar una inspección ya abierta. La opción de terminar no permite recuperar inspecciones cerradas o retomar desde otro dispositivo.

Conservar los valores actuales hasta que se guarden cambios: lunes a miércoles desde 08:15, iniciar y terminar antes de 17:00; jueves desde 08:15, iniciar antes de 12:00 y terminar antes de 17:00; viernes a domingo deshabilitados. Mostrar permanentemente America/Santiago (hora de Chile, con cambios estacionales). No tomar la zona horaria del teléfono.

Validar al menos un día habilitado, horas válidas y orden inicio < límite de inicio <= límite de cierre. No agregar ventanas nocturnas ni horarios distintos por estación en esta entrega. Confirmar y auditar los cambios. La nueva configuración rige para nuevas inspecciones; una inspección en curso conserva los límites con que se inició, sin modificar sus respuestas ni habilitar retomar. Ninguna sesión se extiende a otra semana ISO.

El servidor sigue siendo autoridad y valida inicio y cierre. La interfaz recibe la configuración vigente sin exigir cuenta Google al inspector ni bloquear la apertura visual del QR. Evitar que una copia vieja del horario en el navegador niegue un inicio válido del servidor. Los cálculos de vencimiento también deben respetar la regla configurada y la semana ISO, sin mantener el jueves como fecha fija.

El resumen del viernes refleja los datos hasta su envío. Si hay horarios habilitados después de la hora del resumen —incluidos sábado o domingo—, el panel debe advertirlo y el correo identificarse como parcial, no afirmar que la semana quedó completa. No alterar por su cuenta la hora o los días elegidos.

## Idea futura: reconocimiento de excelencia
No implementarla en esta entrega. Dirección sugerida: insignia discreta con estrella y texto «5S perfecto · semana anterior», vinculada a una inspección efectivamente cerrada con nota 5,0 en la semana ISO anterior. Mostrarla en la estación reconocida y en su tarjeta administrativa, no como premio general en la portada sin estación. No concederla por semanas sin inspección ni mezclar GD con 5S; cualquier reconocimiento GD se definiría por separado. No modifica notas ni concede permisos.

## Verificación y publicación
Pruebas de permisos, validación de nombres/correos/horarios, límites horarios exactos, días deshabilitados, zona horaria de Chile, cambio de semana, cambios con sesiones en curso, lectura agrupada, ausencia de duplicados de envío, fallos de correo y preservación de datos. Validación visual móvil de portada y panel. Pruebas de correo con dobles locales, no con mensajes reales. Respaldar Apps Script y actualizar su implementación; publicar GitHub Pages y verificar el contenido en línea antes de confirmarlo al usuario.

No cambia el flujo de 25 preguntas más GD opcional, los QR ni el guardado al cierre. Los horarios actuales permanecen como valores iniciales y solo cambian por una acción explícita de un administrador autorizado.
