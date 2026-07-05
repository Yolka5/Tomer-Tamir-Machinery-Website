/* TTM FORGE OS — Projects module (shared) + My Space (personal, per-user) */

let db, user, toast, logActivity;
let fs;

let projects = [];
let personal = [];
let editingProjectId = null;

const $ = (id) => document.getElementById(id);

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const PROJECT_STATUS = {
  planning: { label: 'Planning', cls: 'os-status--dev' },
  active:   { label: 'Active',   cls: 'os-status--run' },
  hold:     { label: 'On hold',  cls: 'os-status--warn' },
  done:     { label: 'Complete', cls: 'os-status--idle' }
};

const TASK_FLOW = { todo: 'doing', doing: 'done', done: 'todo' };
const TASK_META = {
  doing: { label: 'Doing', cls: 'os-status--run' },
  todo:  { label: 'To do', cls: 'os-status--dev' },
  done:  { label: 'Done',  cls: 'os-status--idle' }
};

/* ---------- Projects ---------- */

function renderProjects() {
  const grid = $('projects-grid');
  const empty = $('projects-empty');
  if (!grid) return;

  const kpi = $('kpi-projects');
  if (kpi) kpi.textContent = projects.filter((p) => p.status !== 'done').length;

  if (!projects.length) {
    grid.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const order = { active: 0, planning: 1, hold: 2, done: 3 };
  const sorted = projects.slice().sort((a, b) =>
    (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.name.localeCompare(b.name)
  );

  grid.innerHTML = sorted.map((p) => {
    const st = PROJECT_STATUS[p.status] || PROJECT_STATUS.planning;
    const progress = Math.max(0, Math.min(100, Number(p.progress) || 0));
    return `
      <article class="os-project-card ${p.status === 'done' ? 'is-done' : ''}" data-id="${esc(p.id)}">
        <div class="os-project-card__top">
          <h3>${esc(p.name)}</h3>
          <span class="os-status ${st.cls}">${st.label}</span>
        </div>
        ${p.description ? `<p class="os-project-card__desc">${esc(p.description)}</p>` : ''}
        <div class="os-project-card__meta">
          <div class="os-progress os-progress--wide"><span style="width:${progress}%"></span></div>
          <span class="os-project-card__pct">${progress}%</span>
        </div>
        <div class="os-project-card__foot">
          <span class="dim">${p.lead ? 'Lead: ' + esc(p.lead) : 'No lead set'}</span>
          <button type="button" class="os-btn os-btn--icon" data-act="edit">Edit</button>
        </div>
      </article>`;
  }).join('');

  grid.querySelectorAll('[data-act="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => openProjectModal(btn.closest('.os-project-card').dataset.id));
  });
}

export function openAddProject() {
  if (fs) openProjectModal(null);
}

function openProjectModal(projectId) {
  editingProjectId = projectId || null;
  const p = projectId ? projects.find((x) => x.id === projectId) : null;

  $('project-modal-title').textContent = p ? 'Edit project' : 'New project';
  $('project-name').value = p ? p.name : '';
  $('project-lead').value = p ? p.lead || '' : '';
  $('project-status').value = p ? p.status || 'planning' : 'planning';
  $('project-progress').value = p ? Number(p.progress) || 0 : 0;
  $('project-progress-out').textContent = $('project-progress').value;
  $('project-desc').value = p ? p.description || '' : '';
  $('project-delete').hidden = !p;

  $('project-modal').hidden = false;
  $('project-name').focus();
}

function closeProjectModal() {
  $('project-modal').hidden = true;
  editingProjectId = null;
}

async function saveProject(e) {
  e.preventDefault();

  const data = {
    name: $('project-name').value.trim(),
    lead: $('project-lead').value.trim(),
    status: $('project-status').value,
    progress: Number($('project-progress').value) || 0,
    description: $('project-desc').value.trim(),
    updatedAt: fs.serverTimestamp(),
    updatedBy: user.displayName || user.email || ''
  };
  if (!data.name) return;

  try {
    if (editingProjectId) {
      await fs.updateDoc(fs.doc(db, 'projects', editingProjectId), data);
      toast('Project updated');
      logActivity('Updated project "' + data.name + '"');
    } else {
      data.createdAt = fs.serverTimestamp();
      await fs.addDoc(fs.collection(db, 'projects'), data);
      toast('Project created');
      logActivity('Created project "' + data.name + '"');
    }
    closeProjectModal();
  } catch (err) {
    toast('Save failed: ' + err.message, true);
  }
}

async function deleteProject() {
  if (!editingProjectId) return;
  const p = projects.find((x) => x.id === editingProjectId);
  if (!p || !confirm('Delete project "' + p.name + '"?')) return;
  try {
    await fs.deleteDoc(fs.doc(db, 'projects', editingProjectId));
    toast('Project deleted');
    logActivity('Deleted project "' + p.name + '"');
    closeProjectModal();
  } catch (err) {
    toast('Delete failed: ' + err.message, true);
  }
}

/* ---------- My Space (personal) ---------- */

function renderPersonal() {
  const wrap = $('personal-groups');
  const empty = $('personal-empty');
  const count = $('personal-count');
  if (!wrap) return;

  const open = personal.filter((t) => t.status !== 'done').length;
  if (count) count.textContent = personal.length ? open + ' open · ' + personal.length + ' total' : 'Private';

  if (!personal.length) {
    wrap.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const groups = ['doing', 'todo', 'done'];
  wrap.innerHTML = groups.map((status) => {
    const meta = TASK_META[status];
    const rows = personal
      .filter((t) => (t.status || 'todo') === status)
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    if (!rows.length) return '';
    return `
      <div class="os-personal-group">
        <h3>${meta.label} <span class="dim">· ${rows.length}</span></h3>
        ${rows.map((t) => `
          <div class="os-task ${status === 'done' ? 'is-done' : ''}" data-id="${esc(t.id)}">
            <button type="button" class="os-status ${meta.cls} os-task__status" data-act="cycle" title="Click to move to ${TASK_META[TASK_FLOW[status]].label}">${meta.label}</button>
            <span class="os-task__title">${esc(t.title)}</span>
            <button type="button" class="os-btn os-btn--icon" data-act="del" aria-label="Delete">✕</button>
          </div>`).join('')}
      </div>`;
  }).join('');

  wrap.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('.os-task').dataset.id;
      const task = personal.find((t) => t.id === id);
      if (!task) return;

      if (btn.dataset.act === 'cycle') {
        const next = TASK_FLOW[task.status || 'todo'];
        await fs.updateDoc(fs.doc(db, 'personal', id), { status: next });
      } else {
        if (!confirm('Delete "' + task.title + '"?')) return;
        await fs.deleteDoc(fs.doc(db, 'personal', id));
        toast('Removed');
      }
    });
  });
}

async function addPersonal(e) {
  e.preventDefault();
  const input = $('personal-input');
  const title = input.value.trim();
  if (!title) return;
  input.value = '';
  try {
    await fs.addDoc(fs.collection(db, 'personal'), {
      uid: user.uid,
      title: title,
      status: 'todo',
      createdAt: fs.serverTimestamp()
    });
  } catch (err) {
    toast('Save failed: ' + err.message, true);
  }
}

/* ---------- Init ---------- */

export async function initProjects(database, currentUser, showToast, logFn) {
  db = database;
  user = currentUser;
  toast = showToast;
  logActivity = logFn || function () {};

  fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  fs.onSnapshot(
    fs.query(fs.collection(db, 'projects'), fs.orderBy('name')),
    (snap) => {
      projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderProjects();
    },
    (err) => toast('Projects: ' + err.message, true)
  );

  fs.onSnapshot(
    fs.query(fs.collection(db, 'personal'), fs.where('uid', '==', user.uid)),
    (snap) => {
      personal = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAtMs: data.createdAt && data.createdAt.toMillis ? data.createdAt.toMillis() : 0
        };
      });
      renderPersonal();
    },
    (err) => toast('My Space: ' + err.message, true)
  );

  $('btn-add-project').addEventListener('click', () => openProjectModal(null));
  $('project-cancel').addEventListener('click', closeProjectModal);
  $('project-form').addEventListener('submit', saveProject);
  $('project-delete').addEventListener('click', deleteProject);
  $('project-modal').addEventListener('click', (e) => {
    if (e.target === $('project-modal')) closeProjectModal();
  });
  $('project-progress').addEventListener('input', (e) => {
    $('project-progress-out').textContent = e.target.value;
  });

  $('personal-form').addEventListener('submit', addPersonal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProjectModal();
  });
}
