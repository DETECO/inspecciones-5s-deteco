# Portada y transición de estaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar una portada móvil/escritorio con carrusel visual de seis uniformes aprobados y confirmar por animación la estación identificada mediante QR.

**Architecture:** Mantener el SPA y los datos operacionales existentes. Añadir una presentación de uniformes pequeña y comprobable, renderizar el carrusel dentro de la portada y añadir una pantalla de transición en el flujo actual del lector antes de presentar la identificación.

**Tech Stack:** HTML renderizado por `client/app.mjs`, CSS existente, módulos ECMAScript, `node --test`, GitHub Pages.

## Global Constraints

- La estación de inspección solo se obtiene de un QR válido; el carrusel nunca selecciona ni reserva una estación.
- Se conservan las nueve rutas QR actuales y todo el flujo de reserva y sincronización.
- Colores conocidos: Hormigón gris, Soldadura café, Electricidad azul, Bodega polera negra/casco blanco, Carpintería rojo y Enfierradura verde.
- No agregar dependencias, imágenes remotas ni cambios al backend.
- Respetar `prefers-reduced-motion`, controles accesibles y el diseño DETECO existente.
- Antes de publicar, ejecutar `node --test tests/*.test.mjs` y comprobar la URL de GitHub Pages.

---

### Task 1: Catálogo visual de uniformes

**Files:**
- Create: `client/station-presentation.mjs`
- Test: `tests/station-presentation.test.mjs`

**Interfaces:**
- `HOME_CAROUSEL_STATIONS`: arreglo en orden aprobado de los seis IDs que se muestran en portada.
- `getStationPresentation(stationId)`: devuelve `{ id, name, shirtColor, helmetColor, uniformLabel }` para un área conocida; para un ID desconocido devuelve `null`.

- [x] Escribir pruebas para las seis áreas, colores y el casco blanco/polera negra de Bodega.
- [x] Ejecutar `node --test tests/station-presentation.test.mjs`; confirmar falla porque el módulo aún no existe.
- [x] Implementar el catálogo mínimo a partir de los colores aprobados.
- [x] Repetir la prueba; confirmar que pasa.

### Task 2: Portada con carrusel QR-first

**Files:**
- Modify: `client/app.mjs`
- Modify: `styles.css`
- Test: `tests/pwa-home.test.mjs`

**Interfaces:**
- La portada usa `HOME_CAROUSEL_STATIONS` y `getStationPresentation` para presentar seis láminas informativas.
- Acciones delegadas: `previous-station`, `next-station`, `set-station-slide` y `open-scanner`.

- [x] Añadir pruebas de portada para seis uniformes, nombre/etiqueta de color, navegación accesible y botón QR directo.
- [x] Ejecutar `node --test tests/pwa-home.test.mjs`; confirmar fallas por la portada antigua.
- [x] Implementar lámina vectorial, flechas, puntos e interacción por gesto horizontal; mantener la portada sin selección manual de estación.
- [x] Estilizar diseño responsivo con la paleta DETECO y foco visible.
- [x] Repetir `node --test tests/pwa-home.test.mjs`; confirmar que pasa.

### Task 3: Confirmación animada al leer QR

**Files:**
- Modify: `client/app.mjs`
- Modify: `styles.css`
- Test: `tests/scanner-navigation.test.mjs`

**Interfaces:**
- `stationOpeningPage()` muestra el nombre ya resuelto desde el QR y el arco de carga.
- La pantalla `station-opening` precede brevemente a `identity`; no agrega espera de red ni modifica `reserve`.

- [x] Añadir pruebas de estación reconocida, nombre dinámico, transición a identificación, movimiento reducido y conservación de validación/rechazo QR.
- [x] Ejecutar `node --test tests/scanner-navigation.test.mjs`; confirmar fallas esperadas.
- [x] Implementar la transición local breve y el arco CSS; dejar que el flujo de identidad/reserva existente continúe sin cambios.
- [x] Repetir la prueba; confirmar que pasa.

### Task 4: Verificar y publicar

**Files:**
- Review: cambios de `client/app.mjs`, `client/station-presentation.mjs`, `styles.css` y las pruebas.

- [x] Ejecutar `node --test tests/*.test.mjs` y revisar el diff completo.
- [x] Probar la portada en vista móvil; validar la navegación de carrusel y colores de Bodega. El reconocimiento válido/inválido del QR se cubre mediante las pruebas de ruta/flujo; la cámara real requiere la prueba en teléfono.
- [ ] Publicar a `DETECO/inspecciones-5s-deteco` solo si todo pasa.
- [ ] Verificar que el commit remoto coincide con `main` y que GitHub Pages sirve HTML/CSS actualizados con respuesta HTTP 200.
