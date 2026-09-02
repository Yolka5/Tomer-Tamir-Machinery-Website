/* Field-band → T-90M: a black world map zooms Ukraine, then the product page. */

const WORLD = '-180 -90 360 180';
const UKRAINE = '21.6 -53.4 19.4 9.6';
const DURATION = 2300;

function parseBox(s) {
  return s.split(/\s+/).map(Number);
}

function mixBox(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function go(href) {
  const curtain = document.getElementById('page-transition');
  if (curtain) {
    curtain.classList.remove('page-transition--out');
    curtain.classList.add('page-transition--active');
  }
  window.setTimeout(() => {
    window.location.href = href;
  }, curtain ? 380 : 0);
}

function mount() {
  let root = document.querySelector('[data-ttm-map]');
  if (root) return Promise.resolve(root);

  root = document.createElement('div');
  root.className = 'ttm-map';
  root.dataset.ttmMap = '';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="ttm-map__hud">
      <p class="ttm-map__k">Track</p>
      <p class="ttm-map__v">World</p>
    </div>
    <div class="ttm-map__reticle"></div>
    <p class="ttm-map__fix">50.45° N · 30.52° E</p>
  `;
  document.body.appendChild(root);

  return fetch('maps/world.svg')
    .then((res) => {
      if (!res.ok) throw new Error('map missing');
      return res.text();
    })
    .then((svg) => {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const el = doc.documentElement;
      if (!el || el.tagName.toLowerCase() !== 'svg') throw new Error('map parse');
      el.classList.add('ttm-map__svg');
      el.setAttribute('viewBox', WORLD);
      root.insertBefore(document.importNode(el, true), root.firstChild);
      return root;
    });
}

function play(root, href) {
  const svg = root.querySelector('svg');
  const title = root.querySelector('.ttm-map__v');
  const from = parseBox(WORLD);
  const to = parseBox(UKRAINE);
  root.dataset.on = '1';
  document.body.style.overflow = 'hidden';

  if (!svg) {
    go(href);
    return;
  }

  svg.setAttribute('viewBox', WORLD);
  const start = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - start) / DURATION);
    const u = ease(t);
    svg.setAttribute('viewBox', mixBox(from, to, u).join(' '));
    if (u > 0.38) {
      root.dataset.lock = '1';
      if (title) title.textContent = 'Ukraine';
    }
    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }
    root.dataset.go = '1';
    setTimeout(() => go(href), 220);
  }

  requestAnimationFrame(frame);
}

function bind() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  function onJump(e) {
    const node = e.target;
    const el = node && node.nodeType === 1 ? node : node && node.parentElement;
    const link = el && el.closest ? el.closest('[data-map-jump]') : e.currentTarget;
    if (!link || !link.closest || !link.hasAttribute('data-map-jump')) return;
    const href = link.getAttribute('data-map-jump') || link.getAttribute('href');
    if (!href || reduce.matches) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    mount().then((root) => play(root, href)).catch(() => go(href));
  }
  document.addEventListener('click', onJump, true);
}

bind();
