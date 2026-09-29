const CHILE = 'America/Santiago';

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

export function inspectionWindow(date, started) {
  const { weekday, seconds } = chileClock(date);
  if (seconds < 8 * 3600 + 15 * 60 || seconds >= 17 * 3600) return 'closed';
  if (['Mon', 'Tue', 'Wed'].includes(weekday)) return 'open';
  if (weekday === 'Thu') {
    if (seconds < 12 * 3600) return 'open';
    return started ? 'late-continuation' : 'closed';
  }
  return 'closed';
}

export function weeklyDeadlinePassed(date) {
  const { weekday, seconds } = chileClock(date);
  if (weekday === 'Thu') return seconds >= 17 * 3600;
  return ['Fri', 'Sat', 'Sun'].includes(weekday);
}
