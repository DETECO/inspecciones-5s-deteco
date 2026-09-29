# Inspecciones 5S DETECO

Aplicación web móvil para inspecciones semanales 5S por estación, registro fotográfico de hallazgos y seguimiento de kaizen.

> **Estado: conectada a Apps Script, Google Sheets y Drive reales; en etapa de pruebas funcionales.** Las reservas, respuestas y fotos guardadas desde un QR válido se registran en los recursos reales. Coordina una prueba antes de usar una estación que esté en operación.

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

La suite local aprobó 94 pruebas con almacenamiento simulado. Esto valida la lógica, pero no reemplaza la prueba real desde un teléfono. Antes del uso rutinario, valida con una estación coordinada el inicio, respuestas, fotografías, sincronización y cierre. Al iniciar, la estación queda reservada en la semana ISO actual y los datos se guardan en el Sheet y Drive reales.
