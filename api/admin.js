import { checkPassword, isAuthorised, issueToken } from '../lib/auth.js';
import {
  archivePage,
  createHours,
  createTimeOff,
  getBookings,
  getPage,
  getTimeOff,
  getWeeklyHours,
  setBookingStatus,
} from '../lib/notion.js';
import { sendCancellationEmail, mailEnabled } from '../lib/mail.js';
import { parseTime } from '../lib/time.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const sameId = (a, b) => String(a).replace(/-/g, '') === String(b).replace(/-/g, '');

// One endpoint for the admin page: /api/admin?action=...
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = req.query.action;
  const body = (typeof req.body === 'string' ? safeJson(req.body) : req.body) || {};

  if (action === 'login') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD is not set on the server.' });
    if (!checkPassword(body.password)) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      return res.status(401).json({ error: 'Wrong password.' });
    }
    return res.status(200).json({ token: issueToken() });
  }

  if (!isAuthorised(req)) return res.status(401).json({ error: 'Please log in again.' });

  try {
    switch (action) {
      case 'overview': {
        const [hours, timeOff, bookings] = await Promise.all([getWeeklyHours(), getTimeOff(), getBookings()]);
        hours.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.from.localeCompare(b.from));
        return res.status(200).json({
          hours,
          timeOff,
          bookings: bookings
            .filter((b) => b.end > new Date())
            .sort((a, b) => a.start - b.start)
            .map((b) => ({ ...b, start: b.start.toISOString(), end: b.end.toISOString() })),
          emailEnabled: mailEnabled(),
        });
      }

      case 'add-hours': {
        const day = DAYS.find((d) => d === body.day);
        const from = parseTime(body.from);
        const to = parseTime(body.to);
        if (!day || !from || !to || from >= to) return res.status(400).json({ error: 'Choose a day and a start time before the end time.' });
        await createHours({ day, from, to });
        return res.status(200).json({ ok: true });
      }

      case 'add-time-off': {
        const start = String(body.start ?? '');
        const end = String(body.end || start);
        if (!YMD_RE.test(start) || !YMD_RE.test(end) || end < start) return res.status(400).json({ error: 'Choose a valid date range.' });
        await createTimeOff({ start, end, label: String(body.label ?? '').trim().slice(0, 100) });
        return res.status(200).json({ ok: true });
      }

      case 'remove-hours':
      case 'remove-time-off': {
        const db = action === 'remove-hours' ? process.env.NOTION_HOURS_DB : process.env.NOTION_TIMEOFF_DB;
        const page = await getPage(body.id);
        if (!sameId(page.parent?.database_id, db)) return res.status(400).json({ error: 'Not found.' });
        await archivePage(body.id);
        return res.status(200).json({ ok: true });
      }

      case 'cancel-booking': {
        const page = await getPage(body.id);
        if (!sameId(page.parent?.database_id, process.env.NOTION_BOOKINGS_DB)) return res.status(400).json({ error: 'Not found.' });
        await setBookingStatus(body.id, 'Cancelled');
        const p = page.properties;
        let emailed = false;
        if (body.notify) {
          try {
            await sendCancellationEmail({
              start: new Date(p.Start.date.start),
              name: p.Name.title.map((t) => t.plain_text).join(''),
              email: p.Email?.email,
              message: String(body.message ?? '').trim().slice(0, 1000),
            });
            emailed = mailEnabled();
          } catch (err) {
            console.error('Cancellation email failed:', err);
          }
        }
        return res.status(200).json({ ok: true, emailed });
      }

      default:
        return res.status(404).json({ error: 'Unknown action.' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong talking to Notion. Please try again.' });
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
