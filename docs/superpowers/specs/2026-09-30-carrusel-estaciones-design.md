# Portada por carrusel y transición por estación

## Objetivo

Actualizar la portada de Inspección 5S DETECO con el carrusel de estaciones y uniformes aprobado por Ivan, y mostrar una transición breve que confirme visualmente la estación leída por QR.

## Decisiones de diseño aprobadas

- La identidad sigue usando el logotipo y la paleta oficial DETECO: naranjo, grafito, gris y blanco.
- El carrusel presenta las seis áreas de planta con uniforme definido: Hormigón (gris), Soldadura (café), Electricidad (azul), Bodega (polera negra y casco blanco), Carpintería (rojo) y Enfierradura (verde).
- El carrusel es informativo; no inicia una inspección ni sustituye el QR. El botón principal abre la cámara y cada QR sigue determinando su estación.
- Los códigos vigentes para las nueve estaciones siguen funcionando. Tras escanear cualquiera, la pantalla de transición muestra el nombre real leído, incluso para Oficina, Mantención y Obra Santa Julia.
- La transición reproduce el arco naranjo minimalista elegido. Es breve, respeta movimiento reducido y no espera una consulta de red; la identificación continúa por el flujo actual.
- La portada prioriza el botón grande «Escanear QR», con administración y ayuda accesibles, en móvil y escritorio.

## Comportamiento

1. La portada muestra marca, distintivo semanal, el carrusel de seis uniformes, la acción de escaneo y ayuda.
2. Las flechas y los indicadores permiten recorrer las seis láminas; un gesto horizontal también cambia de lámina. La selección no se guarda ni modifica la estación activa.
3. Al leer un QR válido, se conserva la ruta/token en sessionStorage, se detiene la cámara y se muestra el arco junto al nombre de la estación.
4. Tras una pausa visual corta, la aplicación presenta inmediatamente la identificación existente. La reserva, validación, respuestas, fotos y sincronización no cambian.
5. Un QR inválido conserva el mensaje de error actual y no muestra una estación ficticia.

## Límites

- No se cambia el contenido de Apps Script, Sheets, Drive, el catálogo de nueve QR ni el horario.
- No se incorporan bibliotecas o recursos externos para la portada/carrusel/transición.
- Las ilustraciones vectoriales son representaciones del uniforme; no sustituyen fotografías oficiales de cada área.

## Validación

- Pruebas de catálogo visual: seis estaciones y combinación acordada de Bodega.
- Pruebas de flujo: guarda la ruta del QR, muestra el nombre escaneado y continúa a identificación; la lectura inválida no inicia la transición.
- Pruebas responsivas y de accesibilidad: controles etiquetados, anuncios de lámina, foco visible y `prefers-reduced-motion`.
- Suite completa, vista previa local y comprobación de GitHub Pages tras publicar.
