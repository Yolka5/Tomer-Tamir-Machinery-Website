/* BeaverOS — data modules: projects, school, hobbies, calendar, dashboard.
   All collections are per-user (uid field). */

let db, user, toast, fs;

let projects = [];
let school = [];
let hobbies = [];
let events = [];
let memories = [];

let calCursor = new Date();
let calSelected = toDateStr(new Date());

const $ = (id) => document.getElementById(id);

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function dueLabel(dateStr) {
  const d = daysUntil(dateStr);
  if (d < 0) return { text: Math.abs(d) + 'd overdue', cls: 'beaver-due--overdue' };
  if (d === 0) return { text: 'today', cls: 'beaver-due--soon' };
  if (d === 1) return { text: 'tomorrow', cls: 'beaver-due--soon' };
  if (d <= 3) return { text: d + ' days', cls: 'beaver-due--soon' };
  return { text: d + ' days', cls: '' };
}

const PROJECT_FLOW = { idea: 'active', active: 'done', done: 'idea' };
const PROJECT_META = {
  active: { label: 'Active', cls: 'os-status--run' },
  idea:   { label: 'Idea',   cls: 'os-status--dev' },
  done:   { label: 'Done',   cls: 'os-status--idle' }
};

/* ---------- Generic per-user CRUD helpers ---------- */

function col(name) { return fs.collection(db, name); }

async function addRow(collection, data) {
  data.uid = user.uid;
  data.createdAt = fs.serverTimestamp();
  await fs.addDoc(col(collection), data);
}

async function updateRow(collection, id, data) {
  await fs.updateDoc(fs.doc(db, collection, id), data);
}

async function deleteRow(collection, id) {
  await fs.deleteDoc(fs.doc(db, collection, id));
}

function listen(collection, assign) {
  fs.onSnapshot(
    fs.query(col(collection), fs.where('uid', '==', user.uid)),
    (snap) => {
      assign(snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAtMs: data.createdAt && data.createdAt.toMillis ? data.createdAt.toMillis() : 0
        };
      }));
      renderAll();
    },
    (err) => toast(collection + ': ' + err.message, true)
  );
}

/* ---------- Projects ---------- */

function renderProjects() {
  const wrap = $('projects-groups');
  const empty = $('projects-empty');
  const count = $('projects-count');
  if (!wrap) return;

  const active = projects.filter((p) => p.status === 'active').length;
  if (count) count.textContent = projects.length ? active + ' active · ' + projects.length + ' total' : '—';

  if (!projects.length) {
    wrap.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  wrap.innerHTML = ['active', 'idea', 'done'].map((status) => {
    const meta = PROJECT_META[status];
    const rows = projects
      .filter((p) => (p.status || 'idea') === status)
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    if (!rows.length) return '';
    return `
      <div class="os-personal-group">
        <h3>${meta.label} <span class="dim">· ${rows.length}</span></h3>
        ${rows.map((p) => `
          <div class="os-task ${status === 'done' ? 'is-done' : ''}" data-id="${esc(p.id)}">
            <button type="button" class="os-status ${meta.cls} os-task__status" data-act="cycle" title="Move to ${PROJECT_META[PROJECT_FLOW[status]].label}">${meta.label}</button>
            <span class="os-task__title">${esc(p.name)}</span>
            <button type="button" class="os-btn os-btn--icon" data-act="del" aria-label="Delete">✕</button>
          </div>`).join('')}
      </div>`;
  }).join('');

  wrap.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('.os-task').dataset.id;
      const p = projects.find((x) => x.id === id);
      if (!p) return;
      if (btn.dataset.act === 'cycle') {
        await updateRow('beaverProjects', id, { status: PROJECT_FLOW[p.status || 'idea'] });
      } else {
        if (!confirm('Delete "' + p.name + '"?')) return;
        await deleteRow('beaverProjects', id);
      }
    });
  });
}

/* ---------- School ---------- */

function renderSchool() {
  const list = $('school-list');
  const empty = $('school-empty');
  const count = $('school-count');
  if (!list) return;

  const open = school.filter((s) => !s.done);
  if (count) count.textContent = school.length ? open.length + ' open' : '—';

  if (!school.length) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const sorted = school.slice().sort((a, b) =>
    (a.done === b.done ? 0 : a.done ? 1 : -1) || String(a.due).localeCompare(String(b.due))
  );

  list.innerHTML = sorted.map((s) => {
    const due = dueLabel(s.due);
    return `
      <li class="${s.done ? 'is-done' : ''}" data-id="${esc(s.id)}">
        <span style="display:flex; align-items:center; gap:0.75rem;">
          <button type="button" class="beaver-check ${s.done ? 'is-done' : ''}" data-act="toggle" aria-label="Toggle done">${s.done ? '✓' : ''}</button>
          <span>${esc(s.title)}${s.course ? ' <span class="dim">· ' + esc(s.course) + '</span>' : ''}</span>
        </span>
        <span style="display:flex; align-items:center; gap:0.5rem;">
          ${s.done ? '' : `<span class="beaver-due ${due.cls}">${due.text}</span>`}
          <button type="button" class="os-btn os-btn--icon" data-act="del" aria-label="Delete">✕</button>
        </span>
      </li>`;
  }).join('');

  list.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('li').dataset.id;
      const s = school.find((x) => x.id === id);
      if (!s) return;
      if (btn.dataset.act === 'toggle') {
        await updateRow('beaverSchool', id, { done: !s.done });
      } else {
        if (!confirm('Delete "' + s.title + '"?')) return;
        await deleteRow('beaverSchool', id);
      }
    });
  });
}

/* ---------- Hobbies ---------- */

function renderHobbies() {
  const grid = $('hobbies-grid');
  const empty = $('hobbies-empty');
  const count = $('hobbies-count');
  if (!grid) return;

  if (count) count.textContent = hobbies.length ? hobbies.length + ' tracked' : '—';

  if (!hobbies.length) {
    grid.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  grid.innerHTML = hobbies.map((h) => {
    const last = h.lastDone
      ? dueLabelToPast(h.lastDone)
      : 'never logged';
    return `
      <article class="os-project-card" data-id="${esc(h.id)}">
        <div class="os-project-card__top">
          <h3>${esc(h.name)}</h3>
          <span class="beaver-hobby__streak">${Number(h.sessions) || 0}</span>
        </div>
        <p class="os-project-card__desc">Sessions logged · last: ${esc(last)}</p>
        <div class="os-project-card__foot">
          <button type="button" class="os-btn os-btn--primary" data-act="log">+ Log session</button>
          <button type="button" class="os-btn os-btn--icon" data-act="del" aria-label="Delete">✕</button>
        </div>
      </article>`;
  }).join('');

  grid.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('.os-project-card').dataset.id;
      const h = hobbies.find((x) => x.id === id);
      if (!h) return;
      if (btn.dataset.act === 'log') {
        await updateRow('beaverHobbies', id, {
          sessions: (Number(h.sessions) || 0) + 1,
          lastDone: toDateStr(new Date())
        });
        toast('Session logged — nice.');
      } else {
        if (!confirm('Delete "' + h.name + '"?')) return;
        await deleteRow('beaverHobbies', id);
      }
    });
  });
}

function dueLabelToPast(dateStr) {
  const d = -daysUntil(dateStr);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return d + ' days ago';
}

/* ---------- Calendar ---------- */

function renderCalendar() {
  const grid = $('cal-grid');
  const title = $('cal-title');
  if (!grid) return;

  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();
  if (title) {
    title.textContent = calCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const gridStart = new Date(year, month, 1 - startOffset);
  const todayStr = toDateStr(new Date());

  const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let html = dows.map((d) => `<div class="beaver-cal__dow">${d}</div>`).join('');

  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    const dstr = toDateStr(day);
    const dayEvents = events.filter((e) => e.date === dstr);
    const classes = [
      'beaver-cal__day',
      day.getMonth() !== month ? 'is-out' : '',
      dstr === todayStr ? 'is-today' : '',
      dstr === calSelected ? 'is-selected' : ''
    ].filter(Boolean).join(' ');

    html += `
      <button type="button" class="${classes}" data-date="${dstr}">
        ${day.getDate()}
        ${dayEvents.length ? `<span class="beaver-cal__dots">${dayEvents.slice(0, 4).map(() => '<i></i>').join('')}</span>` : ''}
      </button>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.beaver-cal__day').forEach((btn) => {
    btn.addEventListener('click', () => {
      calSelected = btn.dataset.date;
      renderCalendar();
      renderDayPanel();
    });
  });

  renderDayPanel();
}

function renderDayPanel() {
  const title = $('cal-day-title');
  const list = $('cal-day-list');
  if (!title || !list) return;

  const d = new Date(calSelected + 'T00:00:00');
  title.textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const dayEvents = events
    .filter((e) => e.date === calSelected)
    .sort((a, b) => String(a.time || '99').localeCompare(String(b.time || '99')));

  list.innerHTML = dayEvents.length
    ? dayEvents.map((e) => `
        <li data-id="${esc(e.id)}">
          <span>${e.time ? '<span class="dim">' + esc(e.time) + '</span> · ' : ''}${esc(e.title)}</span>
          <button type="button" class="os-btn os-btn--icon" data-act="del" aria-label="Delete">✕</button>
        </li>`).join('')
    : '<li><span class="dim">Nothing scheduled.</span></li>';

  list.querySelectorAll('button[data-act="del"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteRow('beaverEvents', btn.closest('li').dataset.id);
    });
  });
}

/* ---------- Dashboard ---------- */

function renderDashboard() {
  const openSchool = school.filter((s) => !s.done);
  const soon = openSchool.filter((s) => daysUntil(s.due) <= 7);
  const activeProjects = projects.filter((p) => p.status === 'active');
  const todayStr = toDateStr(new Date());
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toDateStr(tomorrow);
  const todayEvents = events.filter((e) => e.date === todayStr);
  const totalSessions = hobbies.reduce((sum, h) => sum + (Number(h.sessions) || 0), 0);

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('kpi-projects', activeProjects.length);
  set('kpi-school', soon.length);
  set('kpi-events', todayEvents.length);
  set('kpi-hobbies', totalSessions);

  const dashSchool = $('dash-school');
  if (dashSchool) {
    const next = openSchool.sort((a, b) => String(a.due).localeCompare(String(b.due))).slice(0, 5);
    dashSchool.innerHTML = next.length
      ? next.map((s) => {
          const due = dueLabel(s.due);
          return `<li><span>${esc(s.title)}${s.course ? ' <span class="dim">· ' + esc(s.course) + '</span>' : ''}</span><span class="beaver-due ${due.cls}">${due.text}</span></li>`;
        }).join('')
      : '<li><span class="dim">Nothing due. Enjoy it.</span></li>';
  }

  const dashProjects = $('dash-projects');
  if (dashProjects) {
    dashProjects.innerHTML = activeProjects.length
      ? activeProjects.slice(0, 5).map((p) =>
          `<li><span>${esc(p.name)}</span><span class="os-status os-status--run">Active</span></li>`).join('')
      : '<li><span class="dim">No active projects — start one.</span></li>';
  }

  const dashEvents = $('dash-events');
  if (dashEvents) {
    const upcoming = events
      .filter((e) => e.date === todayStr || e.date === tomorrowStr)
      .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
    dashEvents.innerHTML = upcoming.length
      ? upcoming.slice(0, 6).map((e) =>
          `<li><span>${esc(e.title)}${e.time ? ' <span class="dim">· ' + esc(e.time) + '</span>' : ''}</span><span class="dim">${e.date === todayStr ? 'today' : 'tomorrow'}</span></li>`).join('')
      : '<li><span class="dim">Clear schedule for the next two days.</span></li>';
  }
}

function renderAll() {
  renderProjects();
  renderSchool();
  renderHobbies();
  renderCalendar();
  renderDashboard();
}

/* ---------- Marcus integration ---------- */

function marcusContext() {
  const todayStr = toDateStr(new Date());
  const lines = [];
  lines.push('Today is ' + new Date().toDateString() + '.');
  lines.push('Operator: ' + (user.displayName || 'unknown') + (user.email ? ' <' + user.email + '>' : '') + '.');

  const memLines = memories
    .slice()
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
    .slice(0, 40)
    .map((m) => '- ' + m.text);
  lines.push('MEMORY (facts Marcus learned in BeaverOS — not gemini.google.com chats):');
  lines.push(memLines.length ? memLines.join('\n') : '(none yet — ask Marcus to remember something)');

  const openSchool = school.filter((s) => !s.done)
    .sort((a, b) => String(a.due).localeCompare(String(b.due)));
  lines.push('SCHOOL (' + openSchool.length + ' open): ' +
    (openSchool.map((s) => s.title + (s.course ? ' [' + s.course + ']' : '') + ' due ' + s.due).join('; ') || 'none'));

  lines.push('PROJECTS: ' +
    (projects.map((p) => p.name + ' (' + (p.status || 'idea') + ')').join('; ') || 'none'));

  lines.push('HOBBIES: ' +
    (hobbies.map((h) => h.name + ' (' + (Number(h.sessions) || 0) + ' sessions, last ' + (h.lastDone || 'never') + ')').join('; ') || 'none'));

  const upcoming = events.filter((e) => e.date >= todayStr)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 15);
  lines.push('CALENDAR (upcoming): ' +
    (upcoming.map((e) => e.date + (e.time ? ' ' + e.time : '') + ' ' + e.title).join('; ') || 'empty'));

  return lines.join('\n');
}

const marcusActions = {
  addSchool: async (a) => {
    if (!a.title || !a.due) throw new Error('missing title/due');
    await addRow('beaverSchool', { title: a.title, course: a.course || '', due: a.due, done: false });
    return 'Added assignment: ' + a.title;
  },
  addProject: async (a) => {
    if (!a.name) throw new Error('missing name');
    await addRow('beaverProjects', { name: a.name, status: 'idea' });
    return 'Added project: ' + a.name;
  },
  addHobby: async (a) => {
    if (!a.name) throw new Error('missing name');
    await addRow('beaverHobbies', { name: a.name, sessions: 0, lastDone: '' });
    return 'Added hobby: ' + a.name;
  },
  addEvent: async (a) => {
    if (!a.title || !a.date) throw new Error('missing title/date');
    await addRow('beaverEvents', { title: a.title, date: a.date, time: a.time || '' });
    return 'Added event: ' + a.title + ' on ' + a.date;
  },
  remember: async (a) => {
    if (!a.text) throw new Error('missing text');
    const text = String(a.text).trim();
    if (!text) throw new Error('empty memory');
    const dup = memories.some((m) => m.text.toLowerCase() === text.toLowerCase());
    if (dup) return 'Already remembered that.';
    await addRow('beaverMemory', { text: text });
    return 'Remembered: ' + text;
  }
};

function updateMemoryCount() {
  const el = $('marcus-memory-count');
  if (!el) return;
  const n = memories.length;
  el.textContent = 'Memory · ' + n + ' note' + (n === 1 ? '' : 's');
}

async function marcusLoadChat() {
  const ref = fs.doc(db, 'beaverMarcusChat', user.uid);
  const snap = await fs.getDoc(ref);
  if (!snap.exists()) return [];
  const rows = snap.data().messages;
  return Array.isArray(rows) ? rows.slice(-40) : [];
}

async function marcusSaveChat(messages) {
  const ref = fs.doc(db, 'beaverMarcusChat', user.uid);
  await fs.setDoc(ref, {
    uid: user.uid,
    messages: messages.slice(-40),
    updatedAt: fs.serverTimestamp()
  }, { merge: true });
}

/* ---------- Init ---------- */

export async function initModules(database, currentUser, showToast) {
  db = database;
  user = currentUser;
  toast = showToast;

  fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  listen('beaverProjects', (rows) => { projects = rows; });
  listen('beaverSchool', (rows) => { school = rows; });
  listen('beaverHobbies', (rows) => { hobbies = rows; });
  listen('beaverEvents', (rows) => { events = rows; });
  listen('beaverMemory', (rows) => {
    memories = rows;
    updateMemoryCount();
  });

  $('project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('project-input');
    if (!input.value.trim()) return;
    await addRow('beaverProjects', { name: input.value.trim(), status: 'idea' });
    input.value = '';
  });

  $('school-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('school-title').value.trim();
    const due = $('school-due').value;
    if (!title || !due) return;
    await addRow('beaverSchool', {
      title: title,
      course: $('school-course').value.trim(),
      due: due,
      done: false
    });
    $('school-title').value = '';
    $('school-course').value = '';
    $('school-due').value = '';
  });

  $('hobby-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('hobby-input');
    if (!input.value.trim()) return;
    await addRow('beaverHobbies', { name: input.value.trim(), sessions: 0, lastDone: '' });
    input.value = '';
  });

  $('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('event-title').value.trim();
    if (!title) return;
    await addRow('beaverEvents', {
      title: title,
      date: calSelected,
      time: $('event-time').value || ''
    });
    $('event-title').value = '';
    $('event-time').value = '';
  });

  $('cal-prev').addEventListener('click', () => {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1);
    renderCalendar();
  });
  $('cal-next').addEventListener('click', () => {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1);
    renderCalendar();
  });
  $('cal-today').addEventListener('click', () => {
    calCursor = new Date();
    calSelected = toDateStr(new Date());
    renderCalendar();
  });

  renderAll();

  return { marcusContext, marcusActions, marcusLoadChat, marcusSaveChat };
}
