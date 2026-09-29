const station = (id, name, kind) => Object.freeze({ id, name, kind });
const module = (id, title, rows) => Object.freeze({
  id,
  title,
  questions: Object.freeze(rows.map(([questionId, text]) => Object.freeze({ id: questionId, moduleId: id, text }))),
});

export const STATIONS = Object.freeze([
  station('oficina', 'OFICINA', 'planta'),
  station('hormigon', 'HORMIGON', 'planta'),
  station('soldadura', 'SOLDADURA', 'planta'),
  station('electricidad', 'ELECTRICIDAD', 'planta'),
  station('bodega', 'BODEGA', 'planta'),
  station('mantencion', 'MANTENCION', 'planta'),
  station('carpinteria', 'CARPINTERIA', 'planta'),
  station('enfierradura', 'ENFIERRADURA', 'planta'),
  station('obra-santa-julia', 'OBRA SANTA JULIA', 'obra'),
]);

export const MODULES = Object.freeze([
  module('separar', 'SEPARAR', [
    ['SEP-01', '¿Está el área de trabajo libre de artículos innecesarios?'],
    ['SEP-02', '¿Están las vías, pasillos y sectores de trabajo libres de estorbos?'],
    ['SEP-03', '¿Los artículos se encuentran en la cantidad necesaria?'],
    ['SEP-04', '¿Se utiliza el sistema de tarjetas naranjas?'],
  ]),
  module('organizar', 'ORGANIZAR', [
    ['ORG-01', '¿Existe un lugar específico para cada elemento y está marcado visualmente?'],
    ['ORG-02', '¿Los insumos están claramente rotulados y organizados?'],
    ['ORG-03', '¿Se indica la demanda semanal para cada tipo de material?'],
    ['ORG-04', '¿Existe un mapa visible para localizar los insumos?'],
    ['ORG-05', '¿Se vuelven a colocar las cosas en su lugar después de utilizarlas?'],
  ]),
  module('limpiar', 'LIMPIAR', [
    ['LIM-01', '¿Son las áreas de trabajo limpias? ¿Se mantiene la limpieza durante la jornada laboral?'],
    ['LIM-02', '¿Los equipos y/o herramientas se mantienen en buenas condiciones y limpios?'],
    ['LIM-03', '¿Existe un lugar definido para útiles de aseo?'],
    ['LIM-04', '¿Los basureros o contenedores de reciclaje se encuentran debidamente identificados?'],
    ['LIM-05', '¿Existe un programa de limpieza conocido por todos?'],
  ]),
  module('estandarizar', 'ESTANDARIZAR', [
    ['EST-01', '¿Se encuentran los sectores demarcados correctamente?'],
    ['EST-02', '¿Se encuentran identificados con su nombre los elementos de almacenaje?'],
    ['EST-03', '¿Se utiliza un sistema de alerta visual para quiebres de stock según el estándar definido?'],
    ['EST-04', '¿Existe un estándar definido por la organización para identificar todos los elementos?'],
    ['EST-05', '¿Existe señalética de seguridad actualizada y acorde a la infraestructura?'],
    ['EST-06', '¿Se encuentra actualizada ZN Online según el estándar definido?'],
  ]),
  module('sustentar', 'SUSTENTAR', [
    ['SUS-01', '¿El personal del área comprende la metodología 5S? (Realizar encuesta al personal).'],
    ['SUS-02', '¿Se identifica compromiso y disciplina en 5S por parte del personal del área y jefatura?'],
    ['SUS-03', '¿Se realiza una rutina de revisión de alerta visual para quiebres de stock?'],
    ['SUS-04', '¿Se encuentra publicada la última auditoría 5S en el panel de gestión del área?'],
    ['SUS-05', '¿Existe un cierre de las no conformidades de la auditoría anterior?'],
  ]),
]);

export const QUESTIONS = Object.freeze(MODULES.flatMap(item => item.questions));
const questionsById = new Map(QUESTIONS.map(question => [question.id, question]));

export function getQuestion(id) {
  return questionsById.get(id) ?? null;
}
