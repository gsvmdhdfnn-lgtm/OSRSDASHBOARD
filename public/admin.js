const TZ = 'Europe/London';
const $ = (id) => document.getElementById(id);
const TOKEN_KEY = 'booking-admin-token';

const storage = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(TOKEN_KEY, v); } catch { /* private mode */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } },
};
let token = storage.get();
let unseenIds = [];

async function api(action, body) {
  const res = await fetch(`/api/admin?action=${action}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && action !== 'login') {
    showLogin();
    throw new Error(data.error);
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function showLogin() {
  token = null;
  storage.clear();
  $('app').hidden = true;
  $('login').hidden = false;
  $('password').focus();
}

function showError(err) {
  $('app-error').textContent = err.message;
  $('app-error').hidden = !err.message;
}

const fmtWhen = (iso) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDate = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}

function listItem(details, button) {
  return el('li', {}, el('div', { className: 'details' }, ...details), button);
}

function emptyItem(text) {
  return el('li', { className: 'muted' }, text);
}

async function refresh() {
  const data = await api('overview');
  $('login').hidden = true;
  $('app').hidden = false;
  showError({});

  $('email-status').textContent = data.emailEnabled
    ? 'Email notifications are on.'
    : 'New bookings show up here. This page checks for new ones every minute while it’s open.';

  const fresh = data.bookings.filter((b) => !b.seen);
  unseenIds = fresh.map((b) => b.id);
  $('new-alert').hidden = !fresh.length;
  $('new-title').textContent = `🔔 ${fresh.length} new booking${fresh.length === 1 ? '' : 's'}`;
  document.title = fresh.length ? `(${fresh.length}) Booking hub` : 'Booking hub';

  $('bookings').replaceChildren(
    ...(data.bookings.length
      ? data.bookings.map((b) =>
          listItem(
            [
              el('strong', { textContent: fmtWhen(b.start) }, b.seen ? null : el('span', { className: 'badge', textContent: 'New' })),
              el('div', { textContent: `${b.name} · ` }, el('a', { href: `mailto:${b.email}`, textContent: b.email })),
              b.notes ? el('div', { className: 'muted small', textContent: b.notes }) : null,
            ],
            el('button', { className: 'danger', textContent: 'Cancel', onclick: () => cancelBooking(b) }),
          ),
        )
      : [emptyItem('No upcoming bookings yet.')]),
  );

  $('hours').replaceChildren(
    ...(data.hours.length
      ? data.hours.map((h) =>
          listItem(
            [el('strong', { textContent: h.day }), document.createTextNode(` ${h.from}–${h.to}`)],
            el('button', { className: 'danger', textContent: 'Remove', onclick: () => remove('remove-hours', h.id) }),
          ),
        )
      : [emptyItem('No hours yet, so clients can’t book. Add some below.')]),
  );

  $('time-off').replaceChildren(
    ...(data.timeOff.length
      ? data.timeOff.map((t) =>
          listItem(
            [
              el('strong', { textContent: t.start === t.end ? fmtDate(t.start) : `${fmtDate(t.start)} – ${fmtDate(t.end)}` }),
              t.label ? el('span', { className: 'muted', textContent: ` · ${t.label}` }) : null,
            ],
            el('button', { className: 'danger', textContent: 'Remove', onclick: () => remove('remove-time-off', t.id) }),
          ),
        )
      : [emptyItem('No time off booked.')]),
  );
}

async function run(fn) {
  try {
    await fn();
    await refresh();
  } catch (err) {
    showError(err);
  }
}

function remove(action, id) {
  if (!confirm('Remove this?')) return;
  run(() => api(action, { id }));
}

function cancelBooking(b) {
  if (!confirm(`Cancel ${b.name}'s session on ${fmtWhen(b.start)}?`)) return;
  const notify = confirm(`Email ${b.email} to let them know?`);
  const message = notify ? prompt('Add a message for them (optional):', '') ?? '' : '';
  run(() => api('cancel-booking', { id: b.id, notify, message }));
}

$('login').onsubmit = async (e) => {
  e.preventDefault();
  $('login-error').hidden = true;
  try {
    const { token: t } = await api('login', { password: $('password').value });
    token = t;
    storage.set(t);
    $('password').value = '';
    await refresh();
  } catch (err) {
    $('login-error').textContent = err.message;
    $('login-error').hidden = false;
  }
};

$('logout').onclick = showLogin;

$('mark-seen').onclick = () => run(() => api('mark-seen', { ids: unseenIds }));

// Check for new bookings every minute while the hub is open and visible.
setInterval(() => {
  if (token && !$('app').hidden && document.visibilityState === 'visible') refresh().catch(() => {});
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (token && !$('app').hidden && document.visibilityState === 'visible') refresh().catch(() => {});
});

$('hours-form').onsubmit = (e) => {
  e.preventDefault();
  run(() => api('add-hours', Object.fromEntries(new FormData(e.target))));
};

$('timeoff-form').onsubmit = (e) => {
  e.preventDefault();
  run(async () => {
    await api('add-time-off', Object.fromEntries(new FormData(e.target)));
    e.target.reset();
  });
};

$('share-link').value = `${location.origin}/`;
$('copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('share-link').value);
    $('copy').textContent = 'Copied';
  } catch {
    $('share-link').select();
  }
  setTimeout(() => ($('copy').textContent = 'Copy'), 1500);
};

if (token) refresh().catch(() => {});
else showLogin();
