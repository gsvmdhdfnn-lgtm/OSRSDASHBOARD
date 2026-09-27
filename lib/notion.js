import { parseTime } from './time.js';
import { SLOT_MINUTES } from './slots.js';

const API = 'https://api.notion.com/v1';

export async function notion(path, { method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Notion ${res.status}: ${data.message}`);
  return data;
}

async function queryAll(databaseId, body = {}) {
  const results = [];
  let cursor;
  do {
    const page = await notion(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: { ...body, page_size: 100, ...(cursor && { start_cursor: cursor }) },
    });
    results.push(...page.results);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return results;
}

const plain = (prop) => (prop?.rich_text ?? prop?.title ?? []).map((t) => t.plain_text).join('').trim();

// "Weekly hours" database: Day (select), From (text), To (text)
export async function getWeeklyHours() {
  const rows = await queryAll(process.env.NOTION_HOURS_DB);
  return rows
    .map(({ id, properties: p }) => ({
      id,
      day: p.Day?.select?.name,
      from: parseTime(plain(p.From)),
      to: parseTime(plain(p.To)),
    }))
    .filter((h) => h.day && h.from && h.to && h.from < h.to);
}

// "Time off" database: Date (date, single day or range)
export async function getTimeOff() {
  const rows = await queryAll(process.env.NOTION_TIMEOFF_DB);
  return rows
    .filter(({ properties: p }) => p.Date?.date?.start)
    .map(({ id, properties: p }) => ({
      id,
      label: plain(p.Name),
      start: p.Date.date.start.slice(0, 10),
      end: (p.Date.date.end || p.Date.date.start).slice(0, 10),
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

// "Bookings" database: Name (title), Email, Start (date), Notes, Status (select)
export async function getBookings(since = new Date()) {
  const rows = await queryAll(process.env.NOTION_BOOKINGS_DB, {
    filter: {
      and: [
        { property: 'Start', date: { on_or_after: new Date(since.getTime() - 86400000).toISOString() } },
        { property: 'Status', select: { does_not_equal: 'Cancelled' } },
      ],
    },
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
  return rows
    .filter((r) => r.properties.Start?.date?.start)
    .map((r) => {
      const { start, end } = r.properties.Start.date;
      const s = new Date(start);
      const p = r.properties;
      return {
        id: r.id,
        start: s,
        end: end ? new Date(end) : new Date(s.getTime() + SLOT_MINUTES * 60000),
        name: plain(p.Name),
        email: p.Email?.email || '',
        notes: plain(p.Notes),
        seen: Boolean(p.Seen?.checkbox),
        createdAt: r.created_time,
      };
    });
}

export async function createBooking({ start, end, name, email, notes }) {
  return notion('/pages', {
    method: 'POST',
    body: {
      parent: { database_id: process.env.NOTION_BOOKINGS_DB },
      properties: {
        Name: { title: [{ text: { content: name } }] },
        Email: { email },
        Start: { date: { start: start.toISOString(), end: end.toISOString() } },
        Notes: { rich_text: notes ? [{ text: { content: notes } }] : [] },
        Status: { select: { name: 'Confirmed' } },
      },
    },
  });
}

export async function archivePage(id) {
  return notion(`/pages/${id}`, { method: 'PATCH', body: { archived: true } });
}

export async function markSeen(id) {
  return notion(`/pages/${id}`, { method: 'PATCH', body: { properties: { Seen: { checkbox: true } } } });
}

export async function setBookingStatus(id, status) {
  return notion(`/pages/${id}`, { method: 'PATCH', body: { properties: { Status: { select: { name: status } } } } });
}

export async function getPage(id) {
  return notion(`/pages/${id}`);
}

export async function createHours({ day, from, to }) {
  return notion('/pages', {
    method: 'POST',
    body: {
      parent: { database_id: process.env.NOTION_HOURS_DB },
      properties: {
        Name: { title: [{ text: { content: `${day} ${from}–${to}` } }] },
        Day: { select: { name: day } },
        From: { rich_text: [{ text: { content: from } }] },
        To: { rich_text: [{ text: { content: to } }] },
      },
    },
  });
}

export async function createTimeOff({ start, end, label }) {
  return notion('/pages', {
    method: 'POST',
    body: {
      parent: { database_id: process.env.NOTION_TIMEOFF_DB },
      properties: {
        Name: { title: [{ text: { content: label || 'Time off' } }] },
        Date: { date: { start, ...(end && end !== start && { end }) } },
      },
    },
  });
}
