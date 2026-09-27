import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTime, zonedToUtc } from '../lib/time.js';
import { computeSlots } from '../lib/slots.js';

test('UK wall-clock converts correctly in winter and summer', () => {
  assert.equal(zonedToUtc('2026-01-15', '09:00').toISOString(), '2026-01-15T09:00:00.000Z');
  assert.equal(zonedToUtc('2026-07-15', '09:00').toISOString(), '2026-07-15T08:00:00.000Z');
  // Clocks go back on 25 Oct 2026
  assert.equal(zonedToUtc('2026-10-24', '09:00').toISOString(), '2026-10-24T08:00:00.000Z');
  assert.equal(zonedToUtc('2026-10-26', '09:00').toISOString(), '2026-10-26T09:00:00.000Z');
});

test('parseTime accepts common formats', () => {
  assert.equal(parseTime('9'), '09:00');
  assert.equal(parseTime('9:30'), '09:30');
  assert.equal(parseTime('5pm'), '17:00');
  assert.equal(parseTime('12am'), '00:00');
  assert.equal(parseTime('17.15'), '17:15');
  assert.equal(parseTime('nonsense'), null);
  assert.equal(parseTime('25:00'), null);
});

const now = new Date('2026-09-28T07:00:00Z'); // Monday 08:00 UK
const hours = [
  { day: 'Monday', from: '09:00', to: '12:00' },
  { day: 'Monday', from: '13:00', to: '15:30' },
  { day: 'Wednesday', from: '10:00', to: '12:00' },
];

test('builds 60-minute slots inside weekly hours', () => {
  const slots = computeSlots({ hours, timeOff: [], bookings: [], now, daysAhead: 7, minNoticeHours: 0 });
  const monday = slots.filter((s) => s.date === '2026-09-28').map((s) => s.time);
  assert.deepEqual(monday, ['09:00', '10:00', '11:00', '13:00', '14:00']);
  assert.deepEqual(slots.filter((s) => s.date === '2026-09-30').map((s) => s.time), ['10:00', '11:00']);
  assert.equal(slots.find((s) => s.date === '2026-09-28').start, '2026-09-28T08:00:00.000Z');
});

test('respects minimum notice, bookings and time off', () => {
  const bookings = [{ start: new Date('2026-10-05T09:00:00Z'), end: new Date('2026-10-05T10:00:00Z') }]; // Mon 10:00 UK
  const timeOff = [{ start: '2026-09-30', end: '2026-09-30' }];
  const slots = computeSlots({ hours, timeOff, bookings, now, daysAhead: 7, minNoticeHours: 3 });
  assert.deepEqual(slots.filter((s) => s.date === '2026-09-28').map((s) => s.time), ['11:00', '13:00', '14:00']);
  assert.equal(slots.filter((s) => s.date === '2026-09-30').length, 0);
  assert.deepEqual(slots.filter((s) => s.date === '2026-10-05').map((s) => s.time), ['09:00', '11:00', '13:00', '14:00']);
});
