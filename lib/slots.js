import { addDays, fromMinutes, toMinutes, zonedParts, zonedToUtc } from './time.js';

export const SLOT_MINUTES = 60;

export const settings = () => ({
  daysAhead: Number(process.env.DAYS_AHEAD) || 28,
  minNoticeHours: Number(process.env.MIN_NOTICE_HOURS ?? 12),
});

/**
 * Work out every bookable slot.
 *
 * hours:    [{ day: 'Monday', from: '09:00', to: '17:00' }]  (UK time; several rows per day allowed)
 * timeOff:  [{ start: '2026-12-24', end: '2026-12-26' }]      (inclusive UK dates)
 * bookings: [{ start: Date, end: Date }]                     (already-taken sessions)
 */
export function computeSlots({ hours, timeOff, bookings, now = new Date(), daysAhead = 28, minNoticeHours = 12 }) {
  const earliest = now.getTime() + minNoticeHours * 3600000;
  const today = zonedParts(now).ymd;
  const slots = [];

  for (let i = 0; i <= daysAhead; i++) {
    const ymd = addDays(today, i);
    if (timeOff.some((t) => ymd >= t.start && ymd <= (t.end || t.start))) continue;

    // Weekday of a calendar date doesn't depend on time zone.
    const weekday = new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
    const seen = new Set();

    for (const block of hours.filter((h) => h.day === weekday)) {
      const endMin = toMinutes(block.to);
      for (let m = toMinutes(block.from); m + SLOT_MINUTES <= endMin; m += SLOT_MINUTES) {
        const time = fromMinutes(m);
        if (seen.has(time)) continue;
        seen.add(time);

        const start = zonedToUtc(ymd, time);
        const end = new Date(start.getTime() + SLOT_MINUTES * 60000);
        if (start.getTime() < earliest) continue;
        if (bookings.some((b) => b.start < end && b.end > start)) continue;

        slots.push({ start: start.toISOString(), date: ymd, time });
      }
    }
  }

  return slots.sort((a, b) => a.start.localeCompare(b.start));
}
