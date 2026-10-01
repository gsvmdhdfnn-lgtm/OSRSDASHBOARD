// Task Organiser: plain JavaScript, no libraries.
// Tasks are kept in this browser's localStorage under one key.

const STORAGE_KEY = 'task-organiser.tasks.v1';
const MAX_TITLE_LENGTH = 200;

const EMPTY_MESSAGES = {
  all: ['No tasks yet', 'Add your first task above. It will be saved in this browser.'],
  outstanding: ['Nothing outstanding', 'You’re all caught up. Add a task above whenever you need to.'],
  completed: ['No completed tasks yet', 'Tick a task when you finish it and it will appear here.'],
};

// ---------- Page elements ----------
const form = document.getElementById('add-form');
const input = document.getElementById('task-title');
const error = document.getElementById('title-error');
const list = document.getElementById('task-list');
const empty = document.getElementById('empty-state');
const emptyTitle = document.getElementById('empty-title');
const emptyText = document.getElementById('empty-text');
const summary = document.getElementById('summary');
const status = document.getElementById('status');
const storageNote = document.getElementById('storage-note');
const filterButtons = document.querySelectorAll('.filter');

// ---------- State ----------
let storageWorks = true;
let tasks = loadTasks();
let currentFilter = 'all';

// ---------- Saving and loading ----------
function loadTasks() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageWorks = false; // storage is blocked or unavailable
    return [];
  }
  try {
    const saved = JSON.parse(raw || '[]');
    if (!Array.isArray(saved)) return [];
    // Keep only well-formed tasks, in case saved data was edited or damaged.
    return saved
      .filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string' && t.title.trim())
      .map((t) => ({ id: t.id, title: t.title.slice(0, MAX_TITLE_LENGTH), done: t.done === true }));
  } catch {
    return []; // saved data was unreadable; start with an empty list
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    storageWorks = true;
  } catch {
    storageWorks = false;
  }
  showStorageWarning();
}

function showStorageWarning() {
  if (storageWorks) return;
  storageNote.parentElement.classList.add('is-warning');
  storageNote.textContent =
    'Saving isn’t available in this browser right now (it may be in private mode or storage is full or blocked). ' +
    'Your tasks will be lost when you close or refresh this page.';
}

function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// ---------- Actions ----------
function addTask(rawTitle) {
  const title = rawTitle.trim();
  if (!title) {
    showError('Please enter a task title. It can’t be blank.');
    return false;
  }
  tasks.unshift({ id: newId(), title: title.slice(0, MAX_TITLE_LENGTH), done: false });
  saveTasks();
  // Show the new task even if the "Completed" filter was selected.
  if (currentFilter === 'completed') setFilter('all');
  render();
  announce(`Added “${title}”.`);
  return true;
}

function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveTasks();
  render();
  announce(task.done ? `Marked “${task.title}” as complete.` : `Moved “${task.title}” back to outstanding.`);
}

function deleteTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  render();
  announce(`Deleted “${task.title}”.`);
}

function setFilter(filter) {
  currentFilter = filter;
  filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
}

// ---------- Messages ----------
function showError(message) {
  error.textContent = message;
  input.setAttribute('aria-invalid', 'true');
  input.focus();
}

function clearError() {
  error.textContent = '';
  input.removeAttribute('aria-invalid');
}

// Read out by screen readers without moving focus.
function announce(message) {
  status.textContent = '';
  requestAnimationFrame(() => {
    status.textContent = message;
  });
}

// ---------- Drawing the page ----------
function visibleTasks() {
  if (currentFilter === 'outstanding') return tasks.filter((t) => !t.done);
  if (currentFilter === 'completed') return tasks.filter((t) => t.done);
  return tasks;
}

const TRASH_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M8 6V4h8v2"/>' +
  '<path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

function renderTask(task) {
  const item = document.createElement('li');
  item.className = task.done ? 'task is-done' : 'task';
  item.dataset.id = task.id;

  const label = document.createElement('label');
  label.className = 'task-label';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-check';
  checkbox.checked = task.done;

  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = task.title; // textContent never runs HTML, so typed tags show as plain text.

  label.append(checkbox, title);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete';
  remove.setAttribute('aria-label', `Delete task: ${task.title}`);
  remove.innerHTML = TRASH_ICON; // fixed icon markup, never user text

  item.append(label, remove);
  return item;
}

function render() {
  // Remember which task had keyboard focus so it isn't lost when the list is redrawn.
  const focused = document.activeElement;
  const focusedItem = focused && list.contains(focused) ? focused.closest('.task') : null;
  const focusedId = focusedItem ? focusedItem.dataset.id : null;
  const focusedRole = focused && focused.classList.contains('delete') ? 'delete' : 'check';
  const oldIds = [...list.children].map((li) => li.dataset.id);

  const shown = visibleTasks();
  list.replaceChildren(...shown.map(renderTask));

  // Counts and summary
  const done = tasks.filter((t) => t.done).length;
  const outstanding = tasks.length - done;
  document.querySelector('[data-count="all"]').textContent = tasks.length;
  document.querySelector('[data-count="outstanding"]').textContent = outstanding;
  document.querySelector('[data-count="completed"]').textContent = done;
  summary.textContent = tasks.length
    ? `${outstanding} outstanding · ${done} completed`
    : 'A calm place to keep track of what needs doing.';

  // Empty state
  empty.hidden = shown.length > 0;
  if (!shown.length) {
    const [heading, text] = EMPTY_MESSAGES[currentFilter];
    emptyTitle.textContent = heading;
    emptyText.textContent = text;
  }

  // Restore focus: same task if still shown, otherwise the next one in the list, otherwise the input.
  if (focusedId) {
    let target = list.querySelector(`[data-id="${CSS.escape(focusedId)}"]`);
    if (!target) {
      const nextId = oldIds.slice(oldIds.indexOf(focusedId) + 1).find((id) => shown.some((t) => t.id === id));
      target = nextId ? list.querySelector(`[data-id="${CSS.escape(nextId)}"]`) : list.lastElementChild;
    }
    const el = target && target.querySelector(focusedRole === 'delete' ? '.delete' : '.task-check');
    (el || input).focus();
  }
}

// ---------- Events ----------
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (addTask(input.value)) {
    input.value = '';
    clearError();
    input.focus();
  }
});

input.addEventListener('input', () => {
  if (input.value.trim()) clearError();
});

// One listener for the whole list handles every task's checkbox and delete button.
list.addEventListener('change', (event) => {
  if (event.target.classList.contains('task-check')) {
    toggleTask(event.target.closest('.task').dataset.id);
  }
});

list.addEventListener('click', (event) => {
  const button = event.target.closest('.delete');
  if (button) deleteTask(button.closest('.task').dataset.id);
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setFilter(button.dataset.filter);
    render();
  });
});

// Keep several open tabs in step: if tasks change in another tab, redraw here.
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    tasks = loadTasks();
    render();
  }
});

// ---------- Start ----------
render();
showStorageWarning();
