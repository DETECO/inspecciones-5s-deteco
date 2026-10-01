const CHILE = 'America/Santiago';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DEFAULT_INSPECTION_SCHEDULE = Object.freeze({ days: DAYS.map((day, index) => Object.freeze({
  day, enabled: index < 4, start: '08:15', lastStart: index === 3 ? '12:00' : '17:00', end: '17:00',
})) });

export function normalizeInspectionSchedule(value) {
  if (!value || !Array.isArray(value.days) || value.days.length !== 7) throw new Error('El horario debe contener siete días.');
  const days = value.days.map((item, index) => {
    if (!item || item.day !== DAYS[index] || typeof item.enabled !== 'boolean') throw new Error('Días del horario inválidos.');
    const minutes = field => {
      if (typeof item[field] !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item[field])) throw new Error('Hora de horario inválida.');
      return Number(item[field].slice(0, 2)) * 60 + Number(item[field].slice(3));
    };
    const start = minutes('start'), lastStart = minutes('lastStart'), end = minutes('end');
    if (!(start < lastStart && lastStart <= end)) throw new Error('Límites del horario inválidos.');
    return { day: item.day, enabled: item.enabled, start: item.start, lastStart: item.lastStart, end: item.end };
  });
  if (!days.some(day => day.enabled)) throw new Error('Se requiere al menos un día habilitado.');
  return { days };
}

function chileClock(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return {
    weekday: part('weekday'),
    seconds: Number(part('hour')) * 3600 + Number(part('minute')) * 60 + Number(part('second')),
  };
}

export function isoWeekChile(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = type => Number(parts.find(item => item.type === type).value);
  const thursday = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - (firstThursday.getUTCDay() || 7));
  const isoWeek = 1 + Math.round((thursday - firstThursday) / 604800000);
  return { isoYear, isoWeek, key: `${isoYear}-W${String(isoWeek).padStart(2, '0')}` };
}

export function inspectionWindow(date, started, schedule = DEFAULT_INSPECTION_SCHEDULE) {
  const { weekday, seconds } = chileClock(date);
  const day = schedule.days.find(item => item.day === weekday);
  if (!day?.enabled) return 'closed';
  const limit = time => (Number(time.slice(0, 2)) * 60 + Number(time.slice(3))) * 60;
  if (seconds < limit(day.start) || seconds >= limit(day.end)) return 'closed';
  return seconds < limit(day.lastStart) ? 'open' : started && day.lastStart !== day.end ? 'late-continuation' : 'closed';
}

export function weeklyDeadlinePassed(date, schedule = DEFAULT_INSPECTION_SCHEDULE) {
  const { weekday, seconds } = chileClock(date);
  const last = [...schedule.days].reverse().find(day => day.enabled);
  const today = DAYS.indexOf(weekday), finalDay = DAYS.indexOf(last.day);
  return today > finalDay || today === finalDay && seconds >= (Number(last.end.slice(0, 2)) * 60 + Number(last.end.slice(3))) * 60;
}
