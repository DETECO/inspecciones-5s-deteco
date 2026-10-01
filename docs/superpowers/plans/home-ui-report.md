# Informe UI de Inicio — 2026-10-01

- `styles.css`: `.shell.home-shell` ocupa el alto visible y permite desplazamiento vertical. Su contenido es una columna flexible: la foto toma el espacio restante y se reduce antes de afectar texto, Escanear QR o Ver instrucciones. En escritorio conserva el margen exterior de 24 px. El control de administración tiene mínimo táctil de 44 px y su imagen mide 24 px.
- `assets/icons/settings.svg`: engranaje neutro de 24 × 24, centrado en `viewBox="0 0 24 24"`.
- `tests/home-viewport.test.mjs`: la prueba falló primero por ausencia del layout flexible y del icono; tras el cambio pasó. También pasaron `tests/pwa-home.test.mjs` y `tests/branding.test.mjs`: 10/10 pruebas, `node --test tests/home-viewport.test.mjs tests/pwa-home.test.mjs tests/branding.test.mjs`.

Integración pendiente del root: poner `home-shell` en el contenedor `.shell` únicamente en Inicio; sustituir el SVG inline del vínculo `.admin-settings-link` por `<img src="./assets/icons/settings.svg" alt="">`. El nombre accesible sigue en el vínculo. Verificar visualmente 320 × 568, 375 × 667, 390 × 844 y escritorio después de integrar la clase.

La prueba automatizada verifica reglas de estructura CSS y el activo SVG; no ejecuta un motor de navegador ni acredita aún las medidas visuales finales.
