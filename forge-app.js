import { firebaseConfig, isConfigured } from './firebase-config.js';
import {
  initInventory, getItems, openAddItem, openEditItem, exportInventoryCsv, openCategoryManager
} from './forge-inventory.js?v=3';
import { initProjects, openAddProject } from './forge-projects.js?v=1';

/* ---------- UI helpers ---------- */

const toastEl = document.getElementById('toast');
let toastTimer;

export function showToast(message, isError) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.toggle('os-toast--error', !!isError);
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toastEl.classList.remove('is-visible');
  }, 2600);
}

export function timeAgo(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';
  const d = Math.floor(hr / 24);
  return d + 'd ago';
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- Section navigation ---------- */

const navItems = document.querySelectorAll('.os-nav__item');
const sections = document.querySelectorAll('.os-section');

export function gotoSection(name) {
  navItems.forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.section === name);
  });
  sections.forEach(function (s) { s.hidden = s.id !== 'section-' + name; });
}

navItems.forEach(function (btn) {
  btn.addEventListener('click', function () { gotoSection(btn.dataset.section); });
});

/* ---------- Clock ---------- */

const clock = document.getElementById('os-clock');
if (clock) {
  const tick = function () {
    const now = new Date();
    clock.textContent =
      now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' · ' +
      now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 30000);
}

/* ---------- Command palette ---------- */

const palette = document.getElementById('palette');
const paletteInput = document.getElementById('palette-input');
const paletteResults = document.getElementById('palette-results');
let paletteIndex = 0;
let currentResults = [];

const baseCommands = [
  { label: 'Go to Overview', hint: 'section', run: () => gotoSection('overview') },
  { label: 'Go to Inventory', hint: 'section', run: () => gotoSection('inventory') },
  { label: 'Go to Projects', hint: 'section', run: () => gotoSection('projects') },
  { label: 'Go to My Space', hint: 'section', run: () => gotoSection('personal') },
  { label: 'Add inventory item', hint: 'action', run: () => { gotoSection('inventory'); openAddItem(); } },
  { label: 'New project', hint: 'action', run: () => { gotoSection('projects'); openAddProject(); } },
  { label: 'Manage categories', hint: 'action', run: () => { gotoSection('inventory'); openCategoryManager(); } },
  { label: 'Export inventory CSV', hint: 'action', run: () => exportInventoryCsv() },
  { label: 'Go to Work orders', hint: 'section', run: () => gotoSection('workorders') },
  { label: 'Go to Machines', hint: 'section', run: () => gotoSection('machines') }
];

function openPalette() {
  if (!palette) return;
  palette.hidden = false;
  paletteInput.value = '';
  renderPalette('');
  paletteInput.focus();
}

function closePalette() {
  if (palette) palette.hidden = true;
}

function renderPalette(queryText) {
  const q = queryText.trim().toLowerCase();

  const commands = baseCommands.filter((c) => !q || c.label.toLowerCase().includes(q));
  const itemMatches = q
    ? getItems()
        .filter((i) => (i.name + ' ' + (i.sku || '')).toLowerCase().includes(q))
        .slice(0, 5)
        .map((i) => ({
          label: i.name + (i.sku ? ' · ' + i.sku : ''),
          hint: 'item · qty ' + i.qty,
          run: () => { gotoSection('inventory'); openEditItem(i.id); }
        }))
    : [];

  currentResults = commands.concat(itemMatches);
  paletteIndex = 0;

  paletteResults.innerHTML = currentResults.length
    ? currentResults.map((r, idx) => `
        <li class="os-palette__item ${idx === 0 ? 'is-selected' : ''}" data-idx="${idx}">
          <span>${esc(r.label)}</span><span class="os-palette__hint">${esc(r.hint)}</span>
        </li>`).join('')
    : '<li class="os-palette__empty">No matches</li>';

  paletteResults.querySelectorAll('.os-palette__item').forEach((el) => {
    el.addEventListener('click', () => {
      const r = currentResults[Number(el.dataset.idx)];
      closePalette();
      if (r) r.run();
    });
  });
}

function movePaletteSelection(delta) {
  if (!currentResults.length) return;
  paletteIndex = (paletteIndex + delta + currentResults.length) % currentResults.length;
  paletteResults.querySelectorAll('.os-palette__item').forEach((el, idx) => {
    el.classList.toggle('is-selected', idx === paletteIndex);
  });
}

if (palette) {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette.hidden ? openPalette() : closePalette();
      return;
    }
    if (palette.hidden) return;
    if (e.key === 'Escape') closePalette();
    else if (e.key === 'ArrowDown') { e.preventDefault(); movePaletteSelection(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); movePaletteSelection(-1); }
    else if (e.key === 'Enter') {
      const r = currentResults[paletteIndex];
      closePalette();
      if (r) r.run();
    }
  });

  paletteInput.addEventListener('input', (e) => renderPalette(e.target.value));
  palette.addEventListener('click', (e) => { if (e.target === palette) closePalette(); });

  const hintBtn = document.getElementById('palette-hint');
  if (hintBtn) hintBtn.addEventListener('click', openPalette);
}

/* ---------- Firebase ---------- */

const configBanner = document.getElementById('config-banner');
const userChip = document.getElementById('os-user');
const logoutBtn = document.getElementById('os-logout');

if (!isConfigured()) {
  if (configBanner) configBanner.hidden = false;
  if (userChip) userChip.textContent = 'not connected';
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () { window.location.href = 'login.html'; });
  }
} else {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const { getAuth, onAuthStateChanged, signOut } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = fs.getFirestore(app);

  let started = false;
  let currentUser = null;

  function userName() {
    return currentUser ? (currentUser.displayName || currentUser.email || 'employee') : '';
  }

  async function logActivity(message) {
    try {
      await fs.addDoc(fs.collection(db, 'activity'), {
        message: message,
        user: userName(),
        ts: fs.serverTimestamp()
      });
    } catch (err) {
      /* activity logging must never block the main action */
    }
  }

  function startFeeds() {
    /* Live activity feed */
    const activityList = document.getElementById('activity-list');
    if (activityList) {
      fs.onSnapshot(
        fs.query(fs.collection(db, 'activity'), fs.orderBy('ts', 'desc'), fs.limit(10)),
        (snap) => {
          const rows = snap.docs.map((d) => {
            const a = d.data();
            const ms = a.ts && a.ts.toMillis ? a.ts.toMillis() : 0;
            return `<li><span>${esc(a.message)} <span class="dim">· ${esc(a.user)}</span></span><span class="dim">${timeAgo(ms)}</span></li>`;
          });
          activityList.innerHTML = rows.length ? rows.join('') : '<li><span class="dim">No activity yet.</span></li>';
        }
      );
    }

    /* Announcements board */
    const announceList = document.getElementById('announce-list');
    const announceForm = document.getElementById('announce-form');
    if (announceList) {
      fs.onSnapshot(
        fs.query(fs.collection(db, 'announcements'), fs.orderBy('ts', 'desc'), fs.limit(10)),
        (snap) => {
          const rows = snap.docs.map((d) => {
            const a = d.data();
            const ms = a.ts && a.ts.toMillis ? a.ts.toMillis() : 0;
            return `
              <li data-id="${esc(d.id)}">
                <span><strong>${esc(a.user)}</strong> <span class="dim">· ${timeAgo(ms)}</span><br>${esc(a.text)}</span>
                <button type="button" class="os-btn os-btn--icon" data-act="del-announce" aria-label="Delete">✕</button>
              </li>`;
          });
          announceList.innerHTML = rows.length ? rows.join('') : '<li><span class="dim">No announcements. Post the first one.</span></li>';

          announceList.querySelectorAll('[data-act="del-announce"]').forEach((btn) => {
            btn.addEventListener('click', async () => {
              if (!confirm('Delete this announcement?')) return;
              await fs.deleteDoc(fs.doc(db, 'announcements', btn.closest('li').dataset.id));
            });
          });
        }
      );
    }

    if (announceForm) {
      announceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('announce-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        try {
          await fs.addDoc(fs.collection(db, 'announcements'), {
            text: text,
            user: userName(),
            ts: fs.serverTimestamp()
          });
        } catch (err) {
          showToast('Post failed: ' + err.message, true);
        }
      });
    }
  }

  function setGreeting() {
    const greetTitle = document.getElementById('greet-title');
    const greetSub = document.getElementById('greet-sub');
    if (!greetTitle) return;

    const hour = new Date().getHours();
    const timeOfDay = hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const firstName = userName().split(' ')[0] || 'operator';
    greetTitle.textContent = timeOfDay + ', ' + firstName;

    if (greetSub) {
      greetSub.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric'
      }) + ' — here\'s the state of the floor.';
    }
  }

  onAuthStateChanged(auth, function (user) {
    if (!user) {
      window.location.replace('login.html');
      return;
    }

    currentUser = user;
    if (userChip) userChip.textContent = userName();
    setGreeting();

    if (!started) {
      started = true;
      initInventory(db, user, showToast, logActivity);
      initProjects(db, user, showToast, logActivity);
      startFeeds();
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      await signOut(auth);
      window.location.href = 'login.html';
    });
  }
}
