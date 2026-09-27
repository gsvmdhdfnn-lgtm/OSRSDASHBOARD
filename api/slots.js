import { getBookings, getTimeOff, getWeeklyHours } from '../lib/notion.js';
import { computeSlots, settings, SLOT_MINUTES } from '../lib/slots.js';
import { TIME_ZONE } from '../lib/time.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const [hours, timeOff, bookings] = await Promise.all([getWeeklyHours(), getTimeOff(), getBookings()]);
    res.status(200).json({
      businessName: process.env.BUSINESS_NAME || '1-to-1 Sessions',
      timeZone: TIME_ZONE,
      slotMinutes: SLOT_MINUTES,
      slots: computeSlots({ hours, timeOff, bookings, ...settings() }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load availability. Please try again shortly.' });
  }
}
