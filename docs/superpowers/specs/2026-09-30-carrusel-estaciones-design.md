# Portada fotográfica y transición por estación

## Objetivo

Actualizar la portada de Inspección 5S DETECO según la referencia fotográfica de Ivan y mostrar una transición breve que confirme visualmente la estación leída por QR.

## Decisiones de diseño aprobadas

- La identidad sigue usando el logotipo y la paleta oficial DETECO: naranjo, grafito, gris y blanco.
- La portada usa el logotipo DETECO y una fotografía real de escaneo en planta; no usa dibujos vectoriales ni carrusel de uniformes.
- La cabecera muestra un acceso de engranaje al panel de administración. La portada destaca «5S SEMANAL», «Inspección 5S» y el botón grande «Escanear QR».
- La fotografía es ilustrativa; no sustituye el QR instalado en cada estación. Solo un QR leído correctamente determina la estación.
- Los códigos vigentes para las nueve estaciones siguen funcionando. Tras escanear cualquiera, la pantalla de transición muestra el nombre real leído, incluso para Oficina, Mantención y Obra Santa Julia.
- La transición reproduce el arco naranjo minimalista elegido. Es breve, respeta movimiento reducido y no espera una consulta de red; la identificación continúa por el flujo actual.
- La portada prioriza el botón grande «Escanear QR», con administración y ayuda accesibles, en móvil y escritorio.

## Comportamiento

1. La portada muestra el logotipo, acceso administrativo, fotografía, distintivo semanal, botón de cámara y ayuda.
2. El botón «Escanear QR» abre la cámara; la estación no puede elegirse manualmente desde la portada.
3. Al leer un QR válido, se conserva la ruta/token en sessionStorage, se detiene la cámara y se muestra el arco junto al nombre de la estación.
4. Tras una pausa visual corta, la aplicación presenta inmediatamente la identificación existente. La reserva, validación, respuestas, fotos y sincronización no cambian.
5. Un QR inválido conserva el mensaje de error actual y no muestra una estación ficticia.

## Límites

- No se cambia el contenido de Apps Script, Sheets, Drive, el catálogo de nueve QR ni el horario.
- Se reutiliza la fotografía local `assets/qr-estacion-hero.png`; no se añaden imágenes externas ni dibujos vectoriales.
- La portada y sus acciones deben seguir funcionando en móvil y escritorio.
- El panel debe construir sus enlaces de acceso sin URLs `https://` dentro de template strings JavaScript inline de Apps Script.

## Validación

- Pruebas de portada: imagen fotográfica, acceso directo al escáner, ayuda, marca y ausencia del carrusel/dibujos.
- Prueba de regresión: enlaces del panel sin el patrón que se altera al servirse desde Apps Script.
- Pruebas de flujo: guarda la ruta del QR, muestra el nombre escaneado y continúa a identificación; la lectura inválida no inicia la transición.
- Pruebas responsivas y de accesibilidad: control etiquetado, foco visible y `prefers-reduced-motion`.
- Suite completa, vista previa local y comprobación de GitHub Pages tras publicar.
