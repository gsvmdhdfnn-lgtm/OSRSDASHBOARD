import { archivePage, createBooking, getBookings, getTimeOff, getWeeklyHours } from '../lib/notion.js';
import { computeSlots, settings, SLOT_MINUTES } from '../lib/slots.js';
import { mailEnabled, sendBookingEmails } from '../lib/mail.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const name = String(body.name ?? '').trim().slice(0, 100);
  const email = String(body.email ?? '').trim().slice(0, 200);
  const notes = String(body.notes ?? '').trim().slice(0, 1000);

  // Honeypot: real people never fill this hidden field in.
  if (body.website) return res.status(200).json({ ok: true });
  if (!name) return res.status(400).json({ error: 'Please enter your name.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

  const start = new Date(body.start);
  if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'Please choose a time.' });
  const end = new Date(start.getTime() + SLOT_MINUTES * 60000);

  try {
    // Re-check against live data so nobody can book a slot that isn't offered.
    const [hours, timeOff, bookings] = await Promise.all([getWeeklyHours(), getTimeOff(), getBookings()]);
    const open = computeSlots({ hours, timeOff, bookings, ...settings() });
    if (!open.some((s) => s.start === start.toISOString())) {
      return res.status(409).json({ error: 'Sorry, that time is no longer available. Please pick another.' });
    }

    const page = await createBooking({ start, end, name, email, notes });

    // Two people could click the same slot at the same moment; the earliest booking wins.
    const clashes = (await getBookings()).filter((b) => b.start < end && b.end > start);
    if (clashes.length > 1 && clashes[0].id !== page.id) {
      await archivePage(page.id);
      return res.status(409).json({ error: 'Sorry, someone just booked that time. Please pick another.' });
    }

    try {
      await sendBookingEmails({ id: page.id, start, end, name, email, notes });
    } catch (err) {
      console.error('Booking saved but email failed:', err);
    }

    res.status(200).json({ ok: true, start: start.toISOString(), emailed: mailEnabled() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong saving your booking. Please try again.' });
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
