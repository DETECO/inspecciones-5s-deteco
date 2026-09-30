# Inspecciones 5S DETECO

Aplicación web móvil para inspecciones semanales 5S por estación, registro fotográfico de hallazgos y seguimiento de kaizen.

> **Estado: conectada a Apps Script, Google Sheets y Drive reales; en etapa de pruebas funcionales.** El inicio reserva la estación sin escribir respuestas en el Sheet. Solo al cerrar se envían fotos y se registra la inspección completa en los recursos reales. Coordina una prueba antes de usar una estación que esté en operación.

## Aplicación

[ Abrir Inspección 5S DETECO ](https://deteco.github.io/inspecciones-5s-deteco/)

El acceso operativo se realiza escaneando el QR físico de la estación. La página general no permite elegir una estación manualmente.

## Datos y seguridad

- La interfaz se publica en GitHub Pages y se comunica con un puente de Google Apps Script.
- El acceso a cada estación se valida con el token incluido en su QR. Los tokens no se publican en este repositorio.
- Las inspecciones y evidencias se guardan en el Google Sheet y Drive configurados por DETECO. Sus identificadores y credenciales no están en el código público.
- El panel de administración exige una cuenta Workspace autorizada.

## Código

- `index.html`, `styles.css`, `client/`, `domain/`, `transport/` y `assets/`: aplicación web.
- `config.js`: URL pública del puente; no contiene tokens QR.
- `backend/`: código fuente y paquete desplegable de Apps Script.
- `tests/`: pruebas automatizadas.

## Pruebas

Ejecutar `node --test tests/*.test.mjs backend/tests/*.test.cjs`. El flujo operativo nuevo no envía respuestas ni fotos mientras se completa el formulario. Al iniciar se mantiene únicamente una reserva independiente; al cerrar se suben las fotos y se envía el registro completo. Una inspección solo se anuncia cerrada tras confirmación del servidor. Las pruebas incluyen 25 respuestas locales, cambios de módulo, cierre fallido y reintentos sin duplicar. No sustituyen la prueba real desde un teléfono.

Las fotos grandes se reducen automáticamente en el teléfono antes del envío (JPEG, lado mayor de hasta 1920 px, menos de 1,45 MB). El límite del servidor se conserva. Los archivos fuente de más de 30 MB o formatos que el navegador no pueda decodificar muestran un error. No se permite retomar ni transferir inspecciones: salir o recargar antes del cierre obliga a comenzar de cero. Si falla el envío, mantener la página abierta y pulsar cerrar nuevamente; se conserva la hora original de término mientras no se editen datos. Los avances antiguos quedan intactos, pero no se cargan ni se sincronizan automáticamente.

Para comprobar la conversión real en un navegador, servir el repositorio localmente y abrir `tests/browser-photo.html`. `tests/browser-local-inspection.html` permite revisar la interfaz en modo local con un QR de prueba, sin usar el Sheet ni Drive.
