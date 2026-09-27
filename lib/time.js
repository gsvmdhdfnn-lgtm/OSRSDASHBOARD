// All scheduling happens in UK time, regardless of where the server runs.
export const TIME_ZONE = 'Europe/London';

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  weekday: 'long',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// Wall-clock parts of an instant in UK time.
export function zonedParts(date) {
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    hm: `${p.hour}:${p.minute}`,
    weekday: p.weekday,
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour,
    minute: +p.minute,
    second: +p.second,
  };
}

// Minutes UK time is ahead of UTC at the given instant (0 in winter, 60 in summer).
function offsetMinutes(date) {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

// UK wall-clock date + time -> real instant. e.g. ('2026-07-01', '09:00') -> 08:00Z
export function zonedToUtc(ymd, hm) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = offsetMinutes(new Date(guess));
  let utc = guess - first * 60000;
  const second = offsetMinutes(new Date(utc));
  if (second !== first) utc = guess - second * 60000;
  return new Date(utc);
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Accepts "9", "09:00", "9:30", "9am", "5:30pm", "17.00". Returns "HH:MM" or null.
export function parseTime(value) {
  const m = String(value ?? '').trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = +(m[2] ?? 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function toMinutes(hm) {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
