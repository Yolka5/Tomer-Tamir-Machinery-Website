/* MP7 act → CAD library: a drawing-sheet wipe, then the archive. */

const DURATION = 1600;

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
  let root = document.querySelector('[data-ttm-cad]');
  if (root) return root;

  root = document.createElement('div');
  root.className = 'ttm-cad';
  root.dataset.ttmCad = '';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="ttm-cad__grid"></div>
    <div class="ttm-cad__frame"></div>
    <div class="ttm-cad__hud">
      <p class="ttm-cad__k">Sheet</p>
      <p class="ttm-cad__v">CAD Library</p>
    </div>
    <p class="ttm-cad__fix">30+ platforms · exterior + cutaway</p>
  `;
  document.body.appendChild(root);
  return root;
}

function play(root, href) {
  root.dataset.on = '1';
  document.body.style.overflow = 'hidden';
  const start = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - start) / DURATION);
    root.style.setProperty('--draw', ease(t).toFixed(4));
    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }
    root.dataset.go = '1';
    setTimeout(() => go(href), 180);
  }

  requestAnimationFrame(frame);
}

function bind() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', (e) => {
    const node = e.target;
    const el = node && node.nodeType === 1 ? node : node && node.parentElement;
    const link = el && el.closest ? el.closest('[data-cad-jump]') : null;
    if (!link || !link.hasAttribute('data-cad-jump')) return;
    const href = link.getAttribute('data-cad-jump') || link.getAttribute('href');
    if (!href || reduce.matches) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    play(mount(), href);
  }, true);
}

bind();
