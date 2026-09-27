const TZ = 'Europe/London';
const $ = (id) => document.getElementById(id);

const state = { slots: [], byDate: new Map(), month: null, date: null, slot: null };

const fmtDate = (ymd, opts) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
const fmtWhen = (iso) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

async function load() {
  $('loading').hidden = false;
  $('pick').hidden = true;
  try {
    const res = await fetch('/api/slots');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.businessName) {
      $('business').textContent = data.businessName;
      document.title = `Book a session · ${data.businessName}`;
    }
    state.slots = data.slots;
    state.byDate = new Map();
    for (const s of data.slots) {
      if (!state.byDate.has(s.date)) state.byDate.set(s.date, []);
      state.byDate.get(s.date).push(s);
    }
    if (state.date && !state.byDate.has(state.date)) state.date = null;
    state.slot = null;
    state.month ??= (data.slots[0]?.date ?? new Date().toISOString()).slice(0, 7);

    $('loading').hidden = true;
    $('pick').hidden = false;
    $('none').hidden = data.slots.length > 0;
    render();
  } catch (err) {
    $('loading').hidden = true;
    $('load-error').hidden = false;
    $('load-error').querySelector('p').textContent = err.message || 'Could not load available times.';
  }
}

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

function render() {
  const [y, m] = state.month.split('-').map(Number);
  $('month').textContent = fmtDate(`${state.month}-01`, { month: 'long', year: 'numeric' });

  const first = state.slots[0]?.date.slice(0, 7);
  const last = state.slots.at(-1)?.date.slice(0, 7);
  $('prev').disabled = !first || state.month <= first;
  $('next').disabled = !last || state.month >= last;

  const cal = $('calendar');
  cal.replaceChildren(
    ...['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => Object.assign(document.createElement('div'), { className: 'cal-dow', textContent: d })),
  );
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let i = 0; i < offset; i++) cal.append(Object.assign(document.createElement('button'), { className: 'cal-day empty', disabled: true }));
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${state.month}-${String(d).padStart(2, '0')}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = d;
    btn.className = 'cal-day';
    if (state.byDate.has(ymd)) {
      btn.classList.add('available');
      btn.setAttribute('aria-label', `${fmtDate(ymd, { weekday: 'long', day: 'numeric', month: 'long' })}, ${state.byDate.get(ymd).length} times free`);
      btn.onclick = () => pickDate(ymd);
    } else {
      btn.disabled = true;
    }
    if (ymd === state.date) btn.classList.add('selected');
    cal.append(btn);
  }

  $('times-card').hidden = !state.date;
  if (state.date) {
    $('times-title').textContent = fmtDate(state.date, { weekday: 'long', day: 'numeric', month: 'long' });
    $('times').replaceChildren(
      ...state.byDate.get(state.date).map((s) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = s.time;
        if (s === state.slot) b.classList.add('selected');
        b.onclick = () => pickSlot(s);
        return b;
      }),
    );
  }

  $('form').hidden = !state.slot;
  if (state.slot) $('summary').textContent = `${fmtWhen(state.slot.start)} · 60 minutes (UK time)`;
}

function pickDate(ymd) {
  state.date = ymd;
  state.slot = null;
  render();
  $('times-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function pickSlot(slot) {
  state.slot = slot;
  $('form-error').hidden = true;
  $('notice').hidden = true;
  render();
  $('form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('name').focus({ preventScroll: true });
}

$('prev').onclick = () => { state.month = shiftMonth(state.month, -1); render(); };
$('next').onclick = () => { state.month = shiftMonth(state.month, 1); render(); };

$('form').onsubmit = async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const showError = (msg) => {
    $('form-error').textContent = msg;
    $('form-error').hidden = false;
  };
  if (!form.get('name').trim()) return showError('Please enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.get('email').trim())) return showError('Please enter a valid email address.');

  $('submit').disabled = true;
  $('submit').textContent = 'Booking…';
  try {
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...Object.fromEntries(form), start: state.slot.start }),
    });
    const data = await res.json();
    if (res.status === 409) {
      await load();
      $('notice').textContent = data.error;
      $('notice').hidden = false;
      $('notice').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!res.ok) throw new Error(data.error);

    $('pick').hidden = true;
    $('done').hidden = false;
    $('done-text').textContent = `See you on ${fmtWhen(state.slot.start)} (UK time).`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    $('submit').disabled = false;
    $('submit').textContent = 'Confirm booking';
  }
};

load();
