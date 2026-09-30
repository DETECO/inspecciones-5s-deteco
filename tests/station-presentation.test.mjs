import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const moduleUrl = new URL('../client/station-presentation.mjs', import.meta.url);
const presentation = existsSync(moduleUrl) ? await import(moduleUrl) : null;

test('define las seis estaciones acordadas para el carrusel de planta', () => {
  assert.ok(presentation, 'falta el catálogo visual del carrusel');
  assert.deepEqual(presentation.HOME_CAROUSEL_STATIONS, [
    'hormigon', 'soldadura', 'electricidad', 'bodega', 'carpinteria', 'enfierradura',
  ]);
});

test('mantiene colores de uniforme acordados y Bodega con polera negra y casco blanco', () => {
  assert.ok(presentation, 'falta el catálogo visual del carrusel');
  const uniforms = Object.fromEntries(presentation.HOME_CAROUSEL_STATIONS.map(id => [
    id,
    presentation.getStationPresentation(id),
  ]));

  assert.equal(uniforms.hormigon.uniformLabel, 'Polera y casco gris');
  assert.equal(uniforms.soldadura.uniformLabel, 'Polera y casco café');
  assert.equal(uniforms.electricidad.uniformLabel, 'Polera y casco azul');
  assert.equal(uniforms.bodega.uniformLabel, 'Polera negra y casco blanco');
  assert.equal(uniforms.carpinteria.uniformLabel, 'Polera y casco rojo');
  assert.equal(uniforms.enfierradura.uniformLabel, 'Polera y casco verde');
  assert.notEqual(uniforms.bodega.shirtColor, uniforms.bodega.helmetColor);
});

test('no asigna uniforme inventado a una estación que no aparece en el carrusel', () => {
  assert.ok(presentation, 'falta el catálogo visual del carrusel');
  assert.equal(presentation.getStationPresentation('oficina'), null);
});
