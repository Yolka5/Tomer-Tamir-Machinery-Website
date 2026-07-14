import { firebaseConfig, isConfigured } from '../../firebase-config.js';
import { initModules } from './beaver-modules.js?v=2';
import { initMarcus } from './marcus.js?v=2';

/* ---------- Toast ---------- */

const toastEl = document.getElementById('toast');
let toastTimer;

export function showToast(message, isError) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.toggle('os-toast--error', !!isError);
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
}

/* ---------- Navigation ---------- */

const navItems = document.querySelectorAll('.os-nav__item[data-section]');
const sections = document.querySelectorAll('.os-section');

export function gotoSection(name) {
  navItems.forEach((b) => b.classList.toggle('is-active', b.dataset.section === name));
  sections.forEach((s) => { s.hidden = s.id !== 'section-' + name; });
}

navItems.forEach((btn) => {
  btn.addEventListener('click', () => gotoSection(btn.dataset.section));
});

const dashMarcusBtn = document.getElementById('dash-open-marcus');
if (dashMarcusBtn) dashMarcusBtn.addEventListener('click', () => gotoSection('marcus'));

const forgeBtn = document.getElementById('open-forge');
if (forgeBtn) {
  forgeBtn.addEventListener('click', () => {
    window.open(window.location.origin + '/os.html', '_blank');
  });
}

/* ---------- Clock ---------- */

const clock = document.getElementById('os-clock');
if (clock) {
  const tick = () => {
    const now = new Date();
    clock.textContent =
      now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' · ' +
      now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 30000);
}

/* ---------- Auth + boot ---------- */

const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const authError = document.getElementById('auth-error');
const googleBtn = document.getElementById('google-signin');
const userChip = document.getElementById('os-user');
const logoutBtn = document.getElementById('os-logout');

function setGreeting(name) {
  const greetTitle = document.getElementById('greet-title');
  const greetSub = document.getElementById('greet-sub');
  if (!greetTitle) return;

  const hour = new Date().getHours();
  const timeOfDay = hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  greetTitle.textContent = timeOfDay + ', ' + (name.split(' ')[0] || 'operator');
  if (greetSub) {
    greetSub.textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric'
    }) + ' — your world at a glance.';
  }
}

if (!isConfigured()) {
  authView.hidden = false;
  googleBtn.disabled = true;
  authError.textContent = 'Firebase is not configured — check firebase-config.js in the site root.';
  authError.hidden = false;
} else {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const { getFirestore } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();

  let started = false;

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      appView.hidden = true;
      authView.hidden = false;
      return;
    }

    authView.hidden = true;
    appView.hidden = false;

    const name = user.displayName || user.email || 'operator';
    if (userChip) userChip.textContent = name;
    setGreeting(name);

    if (!started) {
      started = true;
      initModules(db, user, showToast).then((moduleApi) => {
        initMarcus(moduleApi, user, showToast);
      });
    }
  });

  googleBtn.addEventListener('click', async () => {
    authError.hidden = true;
    googleBtn.disabled = true;
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      googleBtn.disabled = false;
      if (err.code !== 'auth/popup-closed-by-user') {
        authError.textContent = 'Sign-in failed: ' + (err.message || err.code);
        authError.hidden = false;
      }
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
  });
}
