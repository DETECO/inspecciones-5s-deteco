const presentation = (id, name, shirtColor, helmetColor, uniformLabel) => Object.freeze({
  id,
  name,
  shirtColor,
  helmetColor,
  uniformLabel,
});

const STATION_PRESENTATIONS = Object.freeze({
  hormigon: presentation('hormigon', 'HORMIGÓN', '#8a8b88', '#8a8b88', 'Polera y casco gris'),
  soldadura: presentation('soldadura', 'SOLDADURA', '#765440', '#765440', 'Polera y casco café'),
  electricidad: presentation('electricidad', 'ELECTRICIDAD', '#2871ad', '#2871ad', 'Polera y casco azul'),
  bodega: presentation('bodega', 'BODEGA', '#292927', '#ffffff', 'Polera negra y casco blanco'),
  carpinteria: presentation('carpinteria', 'CARPINTERÍA', '#c9413d', '#c9413d', 'Polera y casco rojo'),
  enfierradura: presentation('enfierradura', 'ENFIERRADURA', '#3f8758', '#3f8758', 'Polera y casco verde'),
});

export const HOME_CAROUSEL_STATIONS = Object.freeze([
  'hormigon',
  'soldadura',
  'electricidad',
  'bodega',
  'carpinteria',
  'enfierradura',
]);

export function getStationPresentation(stationId) {
  return STATION_PRESENTATIONS[stationId] || null;
}
