# Inspecciones 5S DETECO

Aplicación web móvil para inspecciones semanales 5S por estación, registro fotográfico de hallazgos y seguimiento de kaizen.

> **Demo no productiva.** No usar para registrar inspecciones reales todavía.

## Estado de conexión

La aplicación aún no está conectada a Google Sheets ni Google Drive. En `app/config.js`, `bridgeEndpoint` permanece vacío; por eso la interfaz conserva borradores localmente y no sincroniza inspecciones.

## Contenido

- `app/`: interfaz, lógica de inspección, pruebas y backend de Apps Script.
- `docs/`: estado, requisitos y guía de despliegue.
- `PAUTA_APP_5S_DETECO.md`: pauta funcional aprobada.

## Pruebas locales

Con Node.js, desde la raíz:

```powershell
node --test app/tests/*.test.mjs app/backend/tests/*.test.cjs
node app/backend/build-deploy.cjs
```

La suite local aprobó 84 pruebas; son pruebas simuladas y no sustituyen la validación contra Google Sheets, Drive, Apps Script o teléfonos reales.

## Publicar la demo en GitHub Pages

1. Sube **el contenido de esta carpeta** al repositorio público `DETECO/inspecciones-5s-deteco` (no subas el ZIP como un único archivo).
2. En GitHub, abre **Settings → Pages**. Selecciona **Deploy from a branch**, rama `main`, carpeta `/(root)` y guarda.
3. La demo quedará en `https://deteco.github.io/inspecciones-5s-deteco/app/`.

Antes de usarla en producción, despliega y autoriza Apps Script, configura `app/config.js`, conecta Sheets/Drive y prueba el flujo desde teléfonos. Genera los QR definitivos solo después de verificar esa conexión. No compartas enlaces administrativos ni tokens QR.
