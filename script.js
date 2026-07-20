(function () {
  'use strict';

  const header = document.getElementById('header');
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.querySelector('.nav__menu');
  const navActions = document.querySelector('.nav__actions');
  const navLinks = document.querySelectorAll('.nav__link');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  document.querySelectorAll('.footer__bottom').forEach(function (el) {
    if (el.querySelector('.footer__disclaimer')) return;
    var note = document.createElement('p');
    note.className = 'footer__disclaimer';
    note.textContent =
      'This website is a joke and should not be taken seriously. It is not a commercial offering, ' +
      'does not represent real products or services for sale, and is not affiliated with any third-party manufacturers or governments.';
    el.appendChild(note);
  });

  function onScroll() {
    if (header) {
      header.classList.toggle('scrolled', window.scrollY > 60);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ===== Global smooth scroll =====
     Native mouse-wheel scrolling jumps the page in fixed OS-defined steps,
     which is what made scroll-linked motion (the hero pin, parallax) feel
     stepped/clanky no matter how much easing was layered on top of it.
     This intercepts wheel input, feeds it into a virtual target, and eases
     the real scroll position toward that target every frame — so every
     "scroll" event the rest of the page reacts to already arrives smooth.
     Keyboard, scrollbar-drag, and touch scrolling are left native; touch
     already has its own momentum and doesn't need this. */
  var smoothScrollTo = null;

  (function initSmoothScroll() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    var current = window.scrollY;
    var target = current;
    var looping = false;
    var EASE = 0.01;

    function maxScroll() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    function clampScroll(y) {
      return Math.max(0, Math.min(maxScroll(), y));
    }

    function isInsideScrollable(node) {
      while (node && node !== document.documentElement) {
        if (node.nodeType === 1) {
          if (node.matches && node.matches('model-viewer, .viewer3d, [data-scroll-ignore]')) return true;
          var style = window.getComputedStyle(node);
          if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 2) {
            return true;
          }
        }
        node = node.parentNode;
      }
      return false;
    }

    /* behavior:'instant' is required here — html has scroll-behavior:smooth
       for anchor-link jumps, which would otherwise make the browser layer
       its own smoothing on top of every per-frame position we set,
       fighting our easing and making the motion arrive late/erratic. */
    function setScroll(y) {
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    }

    function loop() {
      current += (target - current) * EASE;
      if (Math.abs(target - current) < 0.4) {
        current = target;
        looping = false;
      }
      setScroll(current);
      if (looping) requestAnimationFrame(loop);
    }

    function startLoop() {
      if (!looping) {
        looping = true;
        requestAnimationFrame(loop);
      }
    }

    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.defaultPrevented) return;
      if (isInsideScrollable(e.target)) return;

      if (!looping) current = target = window.scrollY;

      var delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 18;
      else if (e.deltaMode === 2) delta *= window.innerHeight;

      target = clampScroll(target + delta);
      e.preventDefault();
      startLoop();
    }, { passive: false });

    window.addEventListener('resize', function () {
      target = clampScroll(target);
    }, { passive: true });

    smoothScrollTo = function (y, opts) {
      var clamped = clampScroll(y);
      if (opts && opts.instant) {
        current = target = clamped;
        setScroll(current);
        return;
      }
      if (!looping) current = window.scrollY;
      target = clamped;
      startLoop();
    };
  })();

  function toggleMenu() {
    if (!navMenu) return;
    navMenu.classList.toggle('open');
    if (navActions) navActions.classList.toggle('open');
    navToggle.classList.toggle('active');
    document.body.style.overflow = navMenu.classList.contains('open') ? 'hidden' : '';
  }

  if (navToggle) navToggle.addEventListener('click', toggleMenu);

  document.querySelectorAll('.nav__dropdown-toggle').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var dropdown = this.closest('.nav__dropdown');
      var isOpen = dropdown.classList.contains('is-open');
      document.querySelectorAll('.nav__dropdown').forEach(function (d) {
        d.classList.remove('is-open');
        var t = d.querySelector('.nav__dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        dropdown.classList.add('is-open');
        this.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', function () {
    document.querySelectorAll('.nav__dropdown.is-open').forEach(function (d) {
      d.classList.remove('is-open');
      var t = d.querySelector('.nav__dropdown-toggle');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  });

  document.querySelectorAll('.nav__dropdown-menu').forEach(function (menu) {
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
  });

  document.querySelectorAll('.nav__dropdown-link').forEach(function (link) {
    link.addEventListener('click', function () {
      if (navMenu && navMenu.classList.contains('open')) toggleMenu();
    });
  });

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      if (navMenu && navMenu.classList.contains('open')) toggleMenu();
    });
  });

  const animateObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });

  function markVisibleIfInView(el) {
    var rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      el.classList.add('visible');
    }
  }

  function observeAnimate(el) {
    markVisibleIfInView(el);
    animateObserver.observe(el);
  }

  document.querySelectorAll('.animate-in').forEach(observeAnimate);

  document.querySelectorAll('.arsenal__mosaic .arsenal-tile.animate-in').forEach(function (el, i) {
    el.style.setProperty('--delay', (i * 0.08) + 's');
    el.classList.add('animate-in--scale');
  });

  document.querySelectorAll('.team__grid .team__card.animate-in').forEach(function (el, i) {
    el.style.setProperty('--delay', (i * 0.1) + 's');
  });

  document.querySelectorAll('.team__photo--private img').forEach(function (img) {
    img.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    img.setAttribute('oncontextmenu', 'return false');
  });

  document.querySelectorAll('.beaver-pillars .beaver-pillar.animate-in').forEach(function (el, i) {
    el.style.setProperty('--delay', (i * 0.08) + 's');
  });

  document.querySelectorAll('.beaver-roadmap__item.animate-in').forEach(function (el, i) {
    el.style.setProperty('--delay', (i * 0.1) + 's');
  });

  /* 3D viewer — model-viewer loads only after the user clicks */
  var modelViewerScriptPromise = null;

  function loadModelViewerScript() {
    if (modelViewerScriptPromise) return modelViewerScriptPromise;
    modelViewerScriptPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.type = 'module';
      s.src = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load 3D viewer')); };
      document.head.appendChild(s);
    });
    return modelViewerScriptPromise;
  }

  document.querySelectorAll('.viewer3d').forEach(function (shell) {
    var btn = shell.querySelector('.viewer3d__load');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var overlay = shell.querySelector('.viewer3d__overlay');
      overlay.innerHTML =
        '<span class="viewer3d__loading"><span class="viewer3d__spinner"></span>Loading model…</span>';

      loadModelViewerScript().then(function () {
        var mv = document.createElement('model-viewer');
        mv.setAttribute('src', shell.dataset.model);
        mv.setAttribute('alt', (shell.dataset.name || '3D model') + ' — interactive 3D view');
        mv.setAttribute('camera-controls', '');
        mv.setAttribute('auto-rotate', '');
        mv.setAttribute('auto-rotate-delay', '1500');
        mv.setAttribute('rotation-per-second', '18deg');
        mv.setAttribute('interaction-prompt', 'none');
        mv.setAttribute('shadow-intensity', '1');
        mv.setAttribute('exposure', '0.95');

        mv.addEventListener('load', function () {
          var poster = shell.querySelector('.viewer3d__poster');
          if (poster) poster.remove();
          if (overlay) overlay.remove();
        });
        mv.addEventListener('error', function () {
          overlay.innerHTML = '<span class="viewer3d__loading">Failed to load the model — try refreshing.</span>';
        });

        shell.appendChild(mv);
      }).catch(function () {
        overlay.innerHTML = '<span class="viewer3d__loading">Failed to load the 3D viewer — check your connection.</span>';
      });
    }, { once: true });
  });

  document.querySelectorAll('.workshop__grid .workshop__item.animate-in').forEach(function (el, i) {
    el.style.setProperty('--delay', (i * 0.08) + 's');
  });

  document.querySelectorAll('.process__grid .process__step.animate-in').forEach(function (el, i) {
    el.style.setProperty('--delay', (i * 0.1) + 's');
  });

  document.querySelectorAll('.about__stat-num').forEach(function (el) {
    const counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const target = parseInt(el.getAttribute('data-target'), 10);
        const start = performance.now();
        function step(now) {
          const progress = Math.min((now - start) / 1500, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(target * ease);
          if (progress < 1) requestAnimationFrame(step);
          else el.textContent = target;
        }
        requestAnimationFrame(step);
        counterObserver.unobserve(el);
      });
    }, { threshold: 0.5 });
    counterObserver.observe(el);
  });

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        if (smoothScrollTo) {
          smoothScrollTo(target.getBoundingClientRect().top + window.scrollY);
        } else {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  /* ===== Hero cinematic scroll pin =====
     Scroll acts as a timeline: the slider shrinks into a bordered 3D "3D
     element" card with ghost depth-layers behind it, tilts with the mouse,
     then swings side to side as two separate text beats stagger in and
     hand off past it. This never touches the slide fade/cycle logic below
     — it only transforms the new wrapper elements around the untouched
     slider. */
  (function initHeroPin() {
    var section = document.getElementById('hero');
    var viewport = document.getElementById('hero-viewport');
    var intro = document.getElementById('hero-pin-intro');
    var card = document.getElementById('hero-card');
    var frame = document.getElementById('hero-card-frame');
    var border = document.getElementById('hero-card-border');
    var layer1 = document.getElementById('hero-card-layer-1');
    var layer2 = document.getElementById('hero-card-layer-2');
    var glass = document.getElementById('hero-card-glass');
    var tracesWrap = document.getElementById('hero-card-traces');
    var reveal1 = document.getElementById('hero-pin-reveal');
    var reveal2 = document.getElementById('hero-pin-reveal-2');
    if (!section || !viewport || !intro || !card || !frame || !border || !reveal1 || !reveal2) return;

    var overlay = card.querySelector('.hero__overlay');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mqDesktop = window.matchMedia('(min-width: 861px)');

    /* Timeline (fractions of the pin's scrollable range):
       0 ───────── shrink+tilt ───────── HOLD1 ── move ── HOLD2 ── move ── HOLD3 ───────── 1
       shrink into a floating card, a beat to feel the tilt, slide right for
       text #1, a beat to read it, swing left for text #2, then linger. */
    var SHRINK_END = 0.14;
    var HOLD1_END = 0.20;
    var MOVE1_END = 0.40;
    var HOLD2_END = 0.48;
    var MOVE2_END = 0.68;

    /* Text handoff — a posT boundary (0=center, 1=text#1, 2=text#2) where
       reveal #1 finishes clearing out and reveal #2 starts staggering in.
       Splitting it here (rather than 50/50) gives #1 a quick, snappy exit
       and gives #2 the bulk of the room for its own word cascade. */
    var SPLIT = 1.25;
    var REVEAL_DURATION = 0.34;

    /* Cushioned "physics" state — the card's rendered scale/position/base
       rotation each chase their own target with independent decay, instead
       of being a rigid function of the (already-eased) scroll value. That
       extra stage of lag is what makes the card feel like it has weight
       and settles into place rather than snapping to wherever scroll says
       it should be. */
    var PHYSICS_EASE = 0.08;
    var curScale = 1, curMoveX = 0, curLiftY = 0, curBaseRotY = 0;

    var raw = 0;
    var smooth = 0;
    var mouseX = 0, mouseY = 0;
    var mouseSmoothX = 0, mouseSmoothY = 0;
    var active = false;
    var ticking = false;

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function collectMasks(root) {
      var list = [];
      root.querySelectorAll('[data-reveal-start]').forEach(function (el) {
        list.push({ el: el, start: parseFloat(el.getAttribute('data-reveal-start')) || 0 });
      });
      return list;
    }

    var reveal1Masks = collectMasks(reveal1);
    var reveal2Masks = collectMasks(reveal2);

    /* ===== Schematic traces =====
       Runs Sobel edge detection over each (untouched) slider image once,
       producing a transparent canvas with dark graphite contour lines —
       a "technical drawing" of the render. The canvases live on the front
       glass sheet and cross-fade in sync with the slide cycle by watching
       the slides' class changes, so the slider logic itself stays intact. */
    var tracesBuilt = false;

    function buildTrace(img, index, canvases, onDone) {
      try {
        var maxW = 720;
        var s = Math.min(1, maxW / img.naturalWidth);
        var w = Math.max(2, Math.round(img.naturalWidth * s));
        var h = Math.max(2, Math.round(img.naturalHeight * s));
        var c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        var ctx = c.getContext('2d', { willReadFrequently: true });
        /* Composite onto white first so transparent-PNG renders don't
           produce a giant edge at the alpha boundary of every pixel. */
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        var data = ctx.getImageData(0, 0, w, h).data;
        var gray = new Float32Array(w * h);
        for (var p = 0, q = 0; p < gray.length; p++, q += 4) {
          gray[p] = data[q] * 0.299 + data[q + 1] * 0.587 + data[q + 2] * 0.114;
        }
        var out = ctx.createImageData(w, h);
        var od = out.data;
        for (var y = 1; y < h - 1; y++) {
          for (var x = 1; x < w - 1; x++) {
            var i0 = y * w + x;
            var gx =
              -gray[i0 - w - 1] - 2 * gray[i0 - 1] - gray[i0 + w - 1] +
              gray[i0 - w + 1] + 2 * gray[i0 + 1] + gray[i0 + w + 1];
            var gy =
              -gray[i0 - w - 1] - 2 * gray[i0 - w] - gray[i0 - w + 1] +
              gray[i0 + w - 1] + 2 * gray[i0 + w] + gray[i0 + w + 1];
            var mag = Math.sqrt(gx * gx + gy * gy);
            var a = (mag - 70) / 180;
            if (a > 0) {
              if (a > 1) a = 1;
              var o = i0 * 4;
              /* Adaptive linework: light contours over dark image regions,
                 dark graphite over light ones — so the trace stays legible
                 on the dark T-90M render and the white product renders
                 alike. */
              if (gray[i0] < 110) {
                od[o] = 235;
                od[o + 1] = 238;
                od[o + 2] = 242;
              } else {
                od[o] = 28;
                od[o + 1] = 30;
                od[o + 2] = 34;
              }
              od[o + 3] = Math.round(a * 165);
            }
          }
        }
        ctx.putImageData(out, 0, 0);
        c.className = 'hero-card__trace-img';
        canvases[index] = c;
        tracesWrap.appendChild(c);
        onDone();
      } catch (err) {
        /* Tainted canvas / decode failure — glass just stays traceless. */
      }
    }

    function ensureTraces() {
      if (tracesBuilt || !glass || !tracesWrap) return;
      tracesBuilt = true;

      var slides = Array.prototype.slice.call(document.querySelectorAll('.hero__slides .hero__slide'));
      if (!slides.length) return;
      var canvases = new Array(slides.length);

      function syncActive() {
        var idx = 0;
        for (var i = 0; i < slides.length; i++) {
          if (slides[i].classList.contains('hero__slide--active')) { idx = i; break; }
        }
        for (var j = 0; j < canvases.length; j++) {
          if (canvases[j]) canvases[j].classList.toggle('is-active', j === idx);
        }
      }

      slides.forEach(function (img, i) {
        function schedule() {
          /* Stagger the pixel work so four Sobel passes never land in the
             same frame. */
          setTimeout(function () { buildTrace(img, i, canvases, syncActive); }, 80 + i * 200);
        }
        if (img.complete && img.naturalWidth) schedule();
        else img.addEventListener('load', schedule, { once: true });
      });

      var mo = new MutationObserver(syncActive);
      slides.forEach(function (s) {
        mo.observe(s, { attributes: true, attributeFilter: ['class'] });
      });
    }

    function computeRaw() {
      var rect = section.getBoundingClientRect();
      var total = section.offsetHeight - window.innerHeight;
      if (total <= 0) return 0;
      return clamp(-rect.top / total, 0, 1);
    }

    /* Continuous 0→1→2 position driver: 0 = centered, 1 = slid right
       (text #1), 2 = slid left (text #2). Piecewise-eased between holds. */
    function computePosT(t) {
      if (t <= HOLD1_END) return 0;
      if (t < MOVE1_END) return easeInOutCubic((t - HOLD1_END) / (MOVE1_END - HOLD1_END));
      if (t <= HOLD2_END) return 1;
      if (t < MOVE2_END) return 1 + easeInOutCubic((t - HOLD2_END) / (MOVE2_END - HOLD2_END));
      return 2;
    }

    /* Gate #1: rises 0→1 as the card arrives at position 1 (posT 0→1),
       then falls back to 0 quickly once it leaves (posT 1→SPLIT) — fully
       clear before reveal #2 is allowed to start. */
    function computeGate1(posT) {
      if (posT <= 1) return posT;
      return clamp(1 - (posT - 1) / (SPLIT - 1), 0, 1);
    }

    /* Gate #2: stays 0 until the card has crossed the split point, then
       rises 0→1 as it arrives at position 2 (posT SPLIT→2). */
    function computeGate2(posT) {
      return clamp((posT - SPLIT) / (2 - SPLIT), 0, 1);
    }

    function applyMasks(masks, gate) {
      for (var i = 0; i < masks.length; i++) {
        var t = easeOutCubic(clamp((gate - masks[i].start) / REVEAL_DURATION, 0, 1));
        masks[i].el.style.transform = 'translateY(' + ((1 - t) * 100).toFixed(2) + '%)';
        masks[i].el.style.opacity = t.toFixed(3);
      }
    }

    function computeTargets() {
      var shrinkT = easeOutCubic(clamp(smooth / SHRINK_END, 0, 1));
      var posT = computePosT(smooth);

      var vw = window.innerWidth, vh = window.innerHeight;
      var targetW = Math.min(vw * 0.42, 560);
      var targetH = Math.min(vh * 0.58, 560);
      var scaleTarget = Math.min(targetW / vw, targetH / vh);
      var offset = vw * 0.19;

      return {
        shrinkT: shrinkT,
        posT: posT,
        scale: lerp(1, scaleTarget, shrinkT),
        moveX: posT <= 1 ? lerp(0, offset, posT) : lerp(offset, -offset, posT - 1),
        liftY: lerp(0, -vh * 0.045, shrinkT),
        baseRotY: posT <= 1 ? lerp(0, -7, posT) : lerp(-7, 7, posT - 1)
      };
    }

    function render(targets) {
      var shrinkT = targets.shrinkT;
      var tiltIntensity = shrinkT;

      /* Mouse contribution rides on top of the cushioned base rotation,
         already smoothed via mouseSmoothX/Y — no extra lag stacked on
         top, so the tilt still tracks the cursor directly. */
      var rotY = curBaseRotY + mouseSmoothX * 8 * tiltIntensity;
      var rotX = clamp(-mouseSmoothY * 5 * tiltIntensity, -8, 8);

      var radius = lerp(0, 28, shrinkT);

      card.style.transform =
        'translate3d(' + curMoveX.toFixed(2) + 'px,' + curLiftY.toFixed(2) + 'px,0) ' +
        'rotateX(' + rotX.toFixed(2) + 'deg) rotateY(' + rotY.toFixed(2) + 'deg) ' +
        'scale(' + curScale.toFixed(4) + ')';

      frame.style.borderRadius = radius.toFixed(1) + 'px';
      border.style.borderRadius = radius.toFixed(1) + 'px';
      border.style.opacity = shrinkT.toFixed(3);

      /* Depth is faked with plain 2D offsets driven by the mouse (bigger
         multiplier = "further back") rather than real translateZ inside a
         preserve-3d group — nesting real 3D depth-sorted, backdrop-filtered
         siblings under a rotating card is unreliable across engines (it
         can flip which layer paints on top past certain tilt angles). This
         reads the same to the eye and never breaks.
         Each sheet also drifts diagonally down-left as the card shrinks, so
         the stack fans out like a spread deck: photo top-right, sheets
         cascading behind it, schematic glass floating in front between them.
         (Raw px values are ~3.4x the visual result — children of .hero-card
         render at ~0.29 scale once shrunk.) */
      if (layer1) {
        layer1.style.borderRadius = radius.toFixed(1) + 'px';
        layer1.style.opacity = (shrinkT * 0.85).toFixed(3);
        layer1.style.transform =
          'translate3d(' + (lerp(0, -70, shrinkT) + mouseSmoothX * 26 * tiltIntensity).toFixed(1) + 'px,' +
          (lerp(0, 50, shrinkT) + mouseSmoothY * 16 * tiltIntensity).toFixed(1) + 'px,0) rotateZ(-1.1deg)';
      }
      if (layer2) {
        layer2.style.borderRadius = radius.toFixed(1) + 'px';
        layer2.style.opacity = (shrinkT * 0.65).toFixed(3);
        layer2.style.transform =
          'translate3d(' + (lerp(0, -150, shrinkT) + mouseSmoothX * 54 * tiltIntensity).toFixed(1) + 'px,' +
          (lerp(0, 105, shrinkT) + mouseSmoothY * 34 * tiltIntensity).toFixed(1) + 'px,0) rotateZ(1.7deg)';
      }
      if (glass) {
        /* Negative mouse multipliers: the front sheet parallaxes opposite
           to the back sheets, which is what sells "in front of the photo".
           Base offsets are pushed further from the photo so the schematic
           outline reads as a distinct floating layer, not a skin. */
        var glassX = lerp(0, -155, shrinkT) + mouseSmoothX * -92 * tiltIntensity;
        var glassY = lerp(0, 118, shrinkT) + mouseSmoothY * -58 * tiltIntensity;
        glass.style.borderRadius = radius.toFixed(1) + 'px';
        glass.style.opacity = (shrinkT * 0.95).toFixed(3);
        glass.style.visibility = shrinkT < 0.02 ? 'hidden' : 'visible';
        glass.style.transform =
          'translate3d(' + glassX.toFixed(1) + 'px,' + glassY.toFixed(1) + 'px,0) rotateZ(-0.5deg)';
      }

      if (overlay) overlay.style.opacity = (1 - shrinkT).toFixed(3);

      var introOpacity = clamp(1 - smooth / (SHRINK_END * 0.72), 0, 1);
      intro.style.opacity = introOpacity.toFixed(3);
      intro.style.transform = 'translateY(' + (-(1 - introOpacity) * 34).toFixed(1) + 'px)';
      intro.style.visibility = introOpacity < 0.02 ? 'hidden' : 'visible';
      intro.style.pointerEvents = introOpacity < 0.6 ? 'none' : 'auto';

      var gate1 = computeGate1(targets.posT);
      var gate2 = computeGate2(targets.posT);

      reveal1.style.visibility = gate1 < 0.02 ? 'hidden' : 'visible';
      reveal1.style.pointerEvents = gate1 > 0.6 ? 'auto' : 'none';
      applyMasks(reveal1Masks, gate1);

      reveal2.style.visibility = gate2 < 0.02 ? 'hidden' : 'visible';
      reveal2.style.pointerEvents = gate2 > 0.6 ? 'auto' : 'none';
      applyMasks(reveal2Masks, gate2);
    }

    function resetStyles() {
      [intro, card, frame, border, layer1, layer2, glass, reveal1, reveal2].forEach(function (el) {
        if (!el) return;
        el.style.transform = '';
        el.style.opacity = '';
        el.style.visibility = '';
        el.style.pointerEvents = '';
        el.style.borderRadius = '';
      });
      reveal1Masks.concat(reveal2Masks).forEach(function (m) {
        m.el.style.transform = '';
        m.el.style.opacity = '';
      });
      if (overlay) overlay.style.opacity = '';
      curScale = 1; curMoveX = 0; curLiftY = 0; curBaseRotY = 0;
    }

    function frameTick() {
      ticking = false;
      if (!active) return;

      raw = computeRaw();
      smooth = lerp(smooth, raw, 0.16);
      mouseSmoothX = lerp(mouseSmoothX, mouseX, 0.09);
      mouseSmoothY = lerp(mouseSmoothY, mouseY, 0.09);

      var targets = computeTargets();
      curScale += (targets.scale - curScale) * PHYSICS_EASE;
      curMoveX += (targets.moveX - curMoveX) * PHYSICS_EASE;
      curLiftY += (targets.liftY - curLiftY) * PHYSICS_EASE;
      curBaseRotY += (targets.baseRotY - curBaseRotY) * PHYSICS_EASE;

      render(targets);

      var unsettled =
        Math.abs(raw - smooth) > 0.0005 ||
        Math.abs(mouseX - mouseSmoothX) > 0.0005 ||
        Math.abs(mouseY - mouseSmoothY) > 0.0005 ||
        Math.abs(targets.scale - curScale) > 0.0003 ||
        Math.abs(targets.moveX - curMoveX) > 0.05 ||
        Math.abs(targets.liftY - curLiftY) > 0.05 ||
        Math.abs(targets.baseRotY - curBaseRotY) > 0.01;
      if (unsettled) requestTick();
    }

    function requestTick() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(frameTick);
      }
    }

    function updateActive() {
      var shouldBeActive = mqDesktop.matches && !reduceMotion;
      if (shouldBeActive === active) return;
      active = shouldBeActive;
      if (!active) resetStyles();
      else {
        ensureTraces();
        requestTick();
      }
    }

    window.addEventListener('scroll', function () {
      if (active) requestTick();
    }, { passive: true });

    window.addEventListener('mousemove', function (e) {
      if (!active) return;
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
      requestTick();
    }, { passive: true });

    window.addEventListener('resize', function () {
      updateActive();
      if (active) requestTick();
    }, { passive: true });

    if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', updateActive);

    updateActive();
  })();

  /* ===== Hero product orbit =====
     Eight featured systems sit on an ellipse around the center label.
     Hovering a tile swaps "Product: X" with that system's name + color,
     with the same ease-out / spring language used elsewhere on the site. */
  (function initHeroOrbit() {
    var orbit = document.getElementById('hero-orbit');
    var ring = document.getElementById('hero-orbit-ring');
    var nameEl = document.getElementById('hero-orbit-name');
    if (!orbit || !ring || !nameEl) return;

    var tiles = Array.prototype.slice.call(ring.querySelectorAll('.hero-orbit__tile'));
    if (!tiles.length) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mqDesktop = window.matchMedia('(min-width: 861px)');
    var defaultName = nameEl.getAttribute('data-default') || 'Systems';
    var defaultColor = '#0a0a0a';
    var currentName = defaultName;
    var swapTimer = null;
    var raf = 0;
    var t0 = performance.now();
    var mouseX = 0;
    var mouseY = 0;
    var smoothX = 0;
    var smoothY = 0;

    nameEl.style.setProperty('--orbit-color', defaultColor);

    function setProduct(name, color) {
      if (name === currentName) return;
      currentName = name;
      clearTimeout(swapTimer);
      nameEl.classList.add('is-swap');
      swapTimer = setTimeout(function () {
        nameEl.textContent = name;
        var next = color || defaultColor;
        nameEl.style.color = next;
        nameEl.style.setProperty('--orbit-color', next);
        orbit.style.setProperty('--orbit-color', next);
        nameEl.classList.remove('is-swap');
      }, 160);
    }

    function layout() {
      if (!mqDesktop.matches) {
        tiles.forEach(function (tile) {
          tile.style.transform = '';
          tile.style.width = '';
        });
        return;
      }

      var rect = orbit.getBoundingClientRect();
      var radiusX = Math.min(rect.width * 0.36, 440);
      var radiusY = Math.min(rect.height * 0.34, 260);
      var n = tiles.length;

      tiles.forEach(function (tile, i) {
        var angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        var sizeBoost = (i % 3 === 0) ? 1.08 : (i % 2 === 0 ? 0.94 : 1);
        tile.dataset.angle = String(angle);
        tile.dataset.rx = String(radiusX);
        tile.dataset.ry = String(radiusY);
        tile.dataset.boost = String(sizeBoost);
        tile.style.width = 'clamp(' + Math.round(68 * sizeBoost) + 'px, ' + (9.2 * sizeBoost).toFixed(2) + 'vw, ' + Math.round(128 * sizeBoost) + 'px)';

        if (reduceMotion) {
          var x = Math.cos(angle) * radiusX;
          var y = Math.sin(angle) * radiusY;
          tile.style.transform =
            'translate(calc(-50% + ' + x.toFixed(1) + 'px), calc(-50% + ' + y.toFixed(1) + 'px)) scale(' + sizeBoost.toFixed(3) + ')';
        }
      });
    }

    function tick(now) {
      raf = 0;
      if (!mqDesktop.matches || reduceMotion) return;

      smoothX += (mouseX - smoothX) * 0.08;
      smoothY += (mouseY - smoothY) * 0.08;
      var elapsed = (now - t0) / 1000;

      tiles.forEach(function (tile, i) {
        var angle = parseFloat(tile.dataset.angle) || 0;
        var rx = parseFloat(tile.dataset.rx) || 0;
        var ry = parseFloat(tile.dataset.ry) || 0;
        var boost = parseFloat(tile.dataset.boost) || 1;
        var floatY = Math.sin(elapsed * 1.15 + i * 0.85) * 7;
        var floatX = Math.cos(elapsed * 0.9 + i * 0.7) * 4;
        var paraX = smoothX * (18 + (i % 4) * 4);
        var paraY = smoothY * (12 + (i % 3) * 3);
        var x = Math.cos(angle) * rx + floatX + paraX;
        var y = Math.sin(angle) * ry + floatY + paraY;
        var hot = tile.classList.contains('is-hot');
        var scale = hot ? 1.12 * boost : boost;
        tile.style.transform =
          'translate(calc(-50% + ' + x.toFixed(1) + 'px), calc(-50% + ' + y.toFixed(1) + 'px)) scale(' + scale.toFixed(3) + ')';
      });

      raf = requestAnimationFrame(tick);
    }

    function startMotion() {
      if (reduceMotion || !mqDesktop.matches) return;
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function stopMotion() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    tiles.forEach(function (tile) {
      var color = tile.getAttribute('data-color') || '#0a0a0a';
      tile.style.setProperty('--orbit-color', color);

      tile.addEventListener('mouseenter', function () {
        tiles.forEach(function (t) { t.classList.toggle('is-hot', t === tile); });
        setProduct(tile.getAttribute('data-name') || defaultName, color);
      });

      tile.addEventListener('focus', function () {
        tiles.forEach(function (t) { t.classList.toggle('is-hot', t === tile); });
        setProduct(tile.getAttribute('data-name') || defaultName, color);
      });

      tile.addEventListener('mouseleave', function () {
        tile.classList.remove('is-hot');
        if (!ring.querySelector('.hero-orbit__tile.is-hot')) {
          setProduct(defaultName, defaultColor);
        }
      });

      tile.addEventListener('blur', function () {
        tile.classList.remove('is-hot');
        if (!ring.querySelector('.hero-orbit__tile.is-hot')) {
          setProduct(defaultName, defaultColor);
        }
      });
    });

    ring.addEventListener('mouseleave', function () {
      tiles.forEach(function (t) { t.classList.remove('is-hot'); });
      setProduct(defaultName, defaultColor);
    });

    window.addEventListener('mousemove', function (e) {
      if (!mqDesktop.matches) return;
      var rect = orbit.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }, { passive: true });

    window.addEventListener('resize', function () {
      layout();
      if (mqDesktop.matches && !reduceMotion) startMotion();
      else {
        stopMotion();
        tiles.forEach(function (tile) {
          tile.style.transform = '';
          tile.style.width = '';
        });
      }
    }, { passive: true });

    if (mqDesktop.addEventListener) {
      mqDesktop.addEventListener('change', function () {
        layout();
        if (mqDesktop.matches && !reduceMotion) startMotion();
        else stopMotion();
      });
    }

    layout();
    startMotion();
  })();

  /* ===== About section parallax alignment =====
     The image drifts slightly faster than the text, so it visually
     "catches up" and lines up with the text block exactly as the
     section crosses the vertical center of the screen. */
  (function initAboutParallax() {
    var grid = document.querySelector('.about__grid');
    var visual = document.querySelector('.about__visual');
    if (!grid || !visual) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var target = 0;
    var current = 0;
    var ticking = false;

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function computeTarget() {
      var rect = grid.getBoundingClientRect();
      var viewportCenter = window.innerHeight / 2;
      var elCenter = rect.top + rect.height / 2;
      return clamp((elCenter - viewportCenter) * 0.18, -70, 70);
    }

    function frameTick() {
      ticking = false;
      target = computeTarget();
      current += (target - current) * 0.16;
      visual.style.transform = 'translateY(' + current.toFixed(1) + 'px)';
      if (Math.abs(target - current) > 0.3) requestTick();
    }

    function requestTick() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(frameTick);
      }
    }

    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', requestTick, { passive: true });
    requestTick();
  })();

  var heroSlides = document.querySelectorAll('.hero__slide');
  var heroDots = document.querySelectorAll('.hero__dot');
  var slideIndex = 0;
  var slideTimer;

  function goToSlide(index) {
    if (!heroSlides.length) return;
    slideIndex = (index + heroSlides.length) % heroSlides.length;
    heroSlides.forEach(function (s, i) {
      s.classList.toggle('hero__slide--active', i === slideIndex);
    });
    heroDots.forEach(function (d, i) {
      d.classList.toggle('hero__dot--active', i === slideIndex);
    });
  }

  function startSlideShow() {
    if (heroSlides.length <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    slideTimer = setInterval(function () {
      goToSlide(slideIndex + 1);
    }, 5500);
  }

  if (heroSlides.length > 1) {
    heroDots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        clearInterval(slideTimer);
        goToSlide(parseInt(this.getAttribute('data-slide'), 10));
        startSlideShow();
      });
    });
    startSlideShow();
  }

  document.querySelectorAll('.btn').forEach(function (btn) {
    btn.addEventListener('mousemove', function (e) {
      var rect = btn.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      btn.style.setProperty('--pointer-x', x + '%');
      btn.style.setProperty('--pointer-y', y + '%');
    });
  });

  document.querySelectorAll('.arsenal-tile').forEach(function (card) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--spot-x', x + '%');
      card.style.setProperty('--spot-y', y + '%');
    });
  });

  var contactForm = document.querySelector('.contact__form:not(.lib-request__form)');
  if (contactForm) {
    var nextInput = contactForm.querySelector('[name="_next"]');
    if (nextInput) {
      nextInput.value = window.location.href.split('?')[0] + '?contact=sent#contact';
    }
  }

  if (new URLSearchParams(window.location.search).get('contact') === 'sent') {
    var successEl = document.getElementById('contact-success');
    if (successEl) successEl.hidden = false;
  }

  var libForm = document.querySelector('.lib-request__form');
  if (libForm) {
    var libNext = libForm.querySelector('[name="_next"]');
    if (libNext) {
      libNext.value = window.location.href.split('?')[0] + '?request=sent#request';
    }
  }

  if (new URLSearchParams(window.location.search).get('request') === 'sent') {
    var libSuccess = document.getElementById('lib-success');
    if (libSuccess) libSuccess.hidden = false;
  }

  document.querySelectorAll('.faq__trigger').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = this.closest('.faq__item');
      var wasOpen = item.classList.contains('is-open');
      document.querySelectorAll('.faq__item').forEach(function (i) {
        i.classList.remove('is-open');
        var t = i.querySelector('.faq__trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('is-open');
        this.setAttribute('aria-expanded', 'true');
      }
    });
  });

  var backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    function updateBackToTop() {
      if (window.scrollY > 400) {
        backToTop.removeAttribute('hidden');
        backToTop.classList.add('is-visible');
      } else {
        backToTop.classList.remove('is-visible');
        backToTop.setAttribute('hidden', '');
      }
    }
    window.addEventListener('scroll', updateBackToTop, { passive: true });
    updateBackToTop();
    backToTop.addEventListener('click', function () {
      if (smoothScrollTo) {
        smoothScrollTo(0);
        return;
      }
      var hero = document.getElementById('hero');
      if (hero) hero.scrollIntoView({ behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* Scroll progress bar */
  var scrollProgress = document.getElementById('scroll-progress');
  var scrollBar = scrollProgress && scrollProgress.querySelector('.scroll-progress__bar');
  if (scrollBar) {
    function updateScrollProgress() {
      var doc = document.documentElement;
      var scrollTop = doc.scrollTop || document.body.scrollTop;
      var scrollHeight = doc.scrollHeight - doc.clientHeight;
      var pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      scrollBar.style.width = pct + '%';
    }
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    updateScrollProgress();
  }

  /* Hero cursor spotlight */
  var hero = document.getElementById('hero-viewport');
  var spotlight = document.getElementById('hero-spotlight');
  if (hero && spotlight && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hero.addEventListener('mousemove', function (e) {
      var rect = hero.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      spotlight.style.setProperty('--spot-x', x + '%');
      spotlight.style.setProperty('--spot-y', y + '%');
    });
  }

  /* ===== System compare ===== */
  (function initCompare() {
    var root = document.getElementById('compare-app');
    if (!root) return;

    var platforms = {
      beaver: {
        id: 'beaver',
        name: 'TTM Beaver',
        short: 'Beaver',
        href: 'beaver.html',
        image: 'TTMNewLogo.png',
        logo: true,
        class: 'Assault rifle',
        cartridge: '7.62×39mm',
        status: 'In development',
        role: 'General-purpose / modern conflict',
        magazine: 'Standard AK-pattern (30 rd typical)',
        feed: 'Rock-and-lock AK magazines',
        barrel: '14.5″ (target)',
        twist: '1:9.5″ RH (target)',
        oal: '34.5″ / 26.2″ collapsed (target)',
        weight: '7.4 lb unloaded (target)',
        weightLb: 7.4,
        rof: '600–700 RPM (target)',
        range: '~400 m',
        rangeM: 400,
        velocity: '~715 m/s (M43-class)',
        gas: 'Refined short-stroke gas piston',
        receiver: 'Weight-optimized, in-house',
        controls: 'Fully ambidextrous',
        stock: 'Integrated collapsible',
        suppressor: 'Thread / QD ready',
        notes: 'Keeps AK ammo/mag logistics; trades long-stroke familiarity for lighter mass and ambi controls. Specs are program targets.',
        manufacturing: '100% TTM in-house',
        lead: 'Yoni',
        provisional: true
      },
      sigspear: {
        id: 'sigspear',
        name: 'SIG SPEAR',
        short: 'SPEAR',
        href: 'sigspear.html',
        image: 'Sigspear5.png',
        logo: false,
        class: 'Battle rifle / carbine',
        cartridge: '.277 Fury (6.8×51mm)',
        status: 'Production',
        role: 'Extended reach / barrier defeat',
        magazine: 'SR-25 pattern · 20 / 25 rd',
        feed: 'Detachable box (SR-25 / Magpul)',
        barrel: '13″ CHF',
        twist: '1:7″ RH (typical)',
        oal: '~36″ with suppressor · folding stock',
        weight: '8.4 lb unloaded · ~9.8 lb w/ suppressor',
        weightLb: 8.4,
        rof: 'Select-fire (cyclic rate unpublished)',
        range: '600–800+ m',
        rangeM: 700,
        velocity: '~915 m/s',
        gas: 'Short-stroke gas piston, rotating bolt',
        receiver: 'Monolithic upper, aluminum',
        controls: 'Ambidextrous core controls',
        stock: 'Folding / collapsible',
        suppressor: 'SLX QD suppressor ready',
        notes: 'Hybrid-case 6.8×51 runs much higher pressure than 5.56/7.62 NATO — heavier rifle, fewer rounds carried, longer effective reach.',
        manufacturing: '100% TTM in-house',
        lead: 'Yoni',
        provisional: false
      },
      mk47: {
        id: 'mk47',
        name: 'CMMG MK47',
        short: 'MK47',
        href: 'cmmg-mk47.html',
        image: 'TTM%20CMMG%20MK47/Main%20CMMG.png',
        logo: false,
        class: 'Carbine (AR / AK hybrid)',
        cartridge: '7.62×39mm',
        status: 'Production',
        role: 'AK logistics on AR controls',
        magazine: 'Standard AK-pattern (30 rd typical)',
        feed: 'Rock-and-lock AK magazines',
        barrel: '16.1″ medium taper',
        twist: '1:10″ RH',
        oal: '~36.8″ / 33.5″ collapsed',
        weight: '~7.2 lb unloaded',
        weightLb: 7.2,
        rof: 'Semi · select-fire config available',
        range: '~400 m',
        rangeM: 400,
        velocity: '~710 m/s (16″, M43-class)',
        gas: 'Carbine-length direct impingement',
        receiver: 'Billet 7075, TTM-machined',
        controls: 'AR fire controls · AK paddle mag release',
        stock: 'Collapsible carbine stock',
        suppressor: '5/8×24 thread ready',
        notes: 'AR ergonomics and parts commonality with AK magazine/ammo logistics. Uses a .308-class bolt for 7.62×39 strength.',
        manufacturing: '100% TTM in-house',
        lead: 'TTM manufacturing cell',
        provisional: false
      },
      mp7: {
        id: 'mp7',
        name: 'MP7',
        short: 'MP7',
        href: 'mp7.html',
        image: 'TTM%20MP7/MP7%20Side1%20.png',
        logo: false,
        class: 'PDW',
        cartridge: '4.6×30mm',
        status: 'Production',
        role: 'CQB / vehicle crew / security',
        magazine: '20 / 30 / 40 rd proprietary',
        feed: 'Grip magazine (pistol-grip feed)',
        barrel: '7.1″ (180 mm)',
        twist: '6-groove RH',
        oal: '25.2″ / 16.3″ collapsed',
        weight: '~4.2–4.4 lb unloaded',
        weightLb: 4.3,
        rof: '~950 RPM',
        range: '~200 m',
        rangeM: 200,
        velocity: '~680–735 m/s (load dependent)',
        gas: 'Short-stroke gas piston, closed bolt',
        receiver: 'Polymer receiver · steel barrel/bolt',
        controls: 'Fully ambidextrous',
        stock: 'Retractable buttstock',
        suppressor: 'Dedicated PDW suppressor ready',
        notes: 'Armor-piercing PDW round in a handgun-sized package. Short effective range vs rifles; excellent for confined spaces and soft-armor threats.',
        manufacturing: '100% TTM in-house',
        lead: 'TTM manufacturing cell',
        provisional: false
      },
      m4a1: {
        id: 'm4a1',
        name: 'M4A1',
        short: 'M4A1',
        href: 'm4a1.html',
        image: 'M4A1.png',
        logo: false,
        class: 'Carbine',
        cartridge: '5.56×45mm NATO',
        status: 'Production',
        role: 'General-purpose / CQB',
        magazine: 'STANAG · 30 rd typical',
        feed: 'Detachable box (AR/STANAG)',
        barrel: '14.5″',
        twist: '1:7″ RH',
        oal: '33.0″ / 29.8″ collapsed',
        weight: '~6.4–6.9 lb unloaded',
        weightLb: 6.6,
        rof: '700–950 RPM',
        range: '500 m point · 600 m area',
        rangeM: 500,
        velocity: '~880–900 m/s (M855-class)',
        gas: 'Direct impingement, select-fire',
        receiver: 'Forged aluminum, TTM-machined',
        controls: 'Ambidextrous-capable',
        stock: 'Collapsible carbine stock',
        suppressor: '1/2×28 thread / QD ready',
        notes: 'Baseline NATO carbine: lightest full-size rifle here, deepest mag/ammo ecosystem, shorter reach and barrier performance than 6.8 or 7.62×39.',
        manufacturing: '100% TTM in-house',
        lead: 'TTM manufacturing cell',
        provisional: false
      },
      an94: {
        id: 'an94',
        name: 'AN-94',
        short: 'AN-94',
        href: 'an94.html',
        image: 'AN94.png',
        logo: false,
        class: 'Assault rifle',
        cartridge: '5.45×39mm',
        status: 'Production',
        role: 'Hyperburst / assault',
        magazine: 'AK-74 pattern · 30 / 45 / 60 rd',
        feed: 'Canted AK-74 magazines',
        barrel: '15.9″ (405 mm)',
        twist: '1:7.7″ RH (195 mm)',
        oal: '37.1″ / 28.7″ folded',
        weight: '8.5 lb unloaded',
        weightLb: 8.5,
        rof: '600 RPM auto · ~1,800 RPM 2-rd hyperburst',
        range: '~700 m (sights)',
        rangeM: 700,
        velocity: '~900 m/s',
        gas: 'Gas + blowback shifted pulse (BBSP)',
        receiver: 'Recoiling barrel / firing unit',
        controls: 'Right-biased service layout',
        stock: 'Side-folding',
        suppressor: 'Integral muzzle brake / device',
        notes: 'Two-round hyperburst lands before full recoil is felt — high hit probability, high mechanical complexity and parts count.',
        manufacturing: '100% TTM in-house',
        lead: 'TTM manufacturing cell',
        provisional: false
      },
      ruger: {
        id: 'ruger',
        name: 'Ruger Precision',
        short: 'Ruger PR',
        href: 'ruger-precision.html',
        image: 'Ruger%20Precison%20.png',
        logo: false,
        class: 'Precision rifle',
        cartridge: '6.5 Creedmoor / .308 Win (config)',
        status: 'Production',
        role: 'Long-range / marksman',
        magazine: 'AICS / Magpul · 10 rd typical',
        feed: 'Multi-mag interface (AICS / SR-25)',
        barrel: '24″ CHF free-floated (6.5 CM)',
        twist: '1:8″ RH (6.5 CM)',
        oal: '43.3–46.8″ / ~35.6″ folded',
        weight: '~10.7 lb unloaded (6.5 CM Gen 3)',
        weightLb: 10.7,
        rof: 'Bolt-action',
        range: '1,000+ m',
        rangeM: 1000,
        velocity: '~820–860 m/s (6.5 CM, load dependent)',
        gas: 'Manual bolt-action',
        receiver: 'Pre-hardened 4140 upper · aluminum lower',
        controls: 'Bolt · ambi safety · mag catch',
        stock: 'Folding adjustable MSR chassis',
        suppressor: '5/8×24 thread ready',
        notes: 'Marksman/precision role — not a volume-of-fire rifle. Best ballistic coefficient and wind hold of the small-arms set.',
        manufacturing: '100% TTM in-house',
        lead: 'TTM manufacturing cell',
        provisional: false
      }
    };

    var groups = [
      {
        title: 'Identity',
        rows: [
          { key: 'class', label: 'Class' },
          { key: 'status', label: 'Status' },
          { key: 'role', label: 'Primary role' },
          { key: 'cartridge', label: 'Cartridge' },
          { key: 'magazine', label: 'Magazines' },
          { key: 'feed', label: 'Feed system' }
        ]
      },
      {
        title: 'Ballistics',
        rows: [
          { key: 'range', label: 'Effective range', compare: 'higher', numKey: 'rangeM' },
          { key: 'velocity', label: 'Muzzle velocity' },
          { key: 'rof', label: 'Rate of fire' }
        ]
      },
      {
        title: 'Dimensions & mass',
        rows: [
          { key: 'barrel', label: 'Barrel length' },
          { key: 'twist', label: 'Rifling twist' },
          { key: 'oal', label: 'Overall length' },
          { key: 'weight', label: 'Weight', compare: 'lower', numKey: 'weightLb' }
        ]
      },
      {
        title: 'Architecture',
        rows: [
          { key: 'gas', label: 'Operating system' },
          { key: 'receiver', label: 'Receiver' },
          { key: 'controls', label: 'Controls' },
          { key: 'stock', label: 'Stock' },
          { key: 'suppressor', label: 'Suppressor' }
        ]
      },
      {
        title: 'Trade-offs',
        rows: [
          { key: 'notes', label: 'What to know' }
        ]
      },
      {
        title: 'Program',
        rows: [
          { key: 'manufacturing', label: 'Manufacturing' },
          { key: 'lead', label: 'Program lead' }
        ]
      }
    ];

    var presets = [
      { a: 'beaver', b: 'mk47', label: 'Beaver vs MK47' },
      { a: 'm4a1', b: 'sigspear', label: 'M4A1 vs SPEAR' },
      { a: 'an94', b: 'm4a1', label: 'AN-94 vs M4A1' },
      { a: 'ruger', b: 'sigspear', label: 'Ruger vs SPEAR' },
      { a: 'mp7', b: 'm4a1', label: 'MP7 vs M4A1' },
      { a: 'mk47', b: 'm4a1', label: 'MK47 vs M4A1' }
    ];

    var order = ['beaver', 'sigspear', 'mk47', 'mp7', 'm4a1', 'an94', 'ruger'];
    var state = { a: null, b: null, diffOnly: false };

    var presetsEl = document.getElementById('compare-presets');
    var slotsEl = document.getElementById('compare-slots');
    var toolbarEl = document.getElementById('compare-toolbar');
    var tableWrap = document.getElementById('compare-table-wrap');
    var thead = document.getElementById('compare-thead');
    var tbody = document.getElementById('compare-tbody');
    var emptyEl = document.getElementById('compare-empty');
    var diffOnlyInput = document.getElementById('compare-diff-only');
    var swapBtn = document.getElementById('compare-swap');
    var diffCountEl = document.getElementById('compare-diff-count');

    function imgClass(p) {
      return p.logo ? ' compare-pick__img--logo' : '';
    }

    function headImgClass(p) {
      return p.logo ? ' compare-head__img--logo' : '';
    }

    function renderPresets() {
      presetsEl.innerHTML = presets.map(function (p) {
        var active = state.a === p.a && state.b === p.b ? ' is-active' : '';
        return '<button type="button" class="compare-preset' + active + '" data-a="' + p.a + '" data-b="' + p.b + '">' + p.label + '</button>';
      }).join('');
    }

    function renderSlots() {
      function side(sideKey, label) {
        var selected = state[sideKey];
        var other = sideKey === 'a' ? state.b : state.a;
        var cards = order.map(function (id) {
          var p = platforms[id];
          var sel = selected === id ? ' is-selected' : '';
          var taken = other === id;
          var dis = taken ? ' is-disabled' : '';
          var disabledAttr = taken ? ' disabled' : '';
          return (
            '<button type="button" class="compare-pick' + sel + dis + '" data-side="' + sideKey + '" data-id="' + id + '"' + disabledAttr + '>' +
              '<span class="compare-pick__img' + imgClass(p) + '"><img src="' + p.image + '" alt="" loading="lazy"></span>' +
              '<span class="compare-pick__name">' + p.short + '</span>' +
              '<span class="compare-pick__meta">' + p.cartridge + (p.provisional ? ' · provisional' : '') + '</span>' +
            '</button>'
          );
        }).join('');
        return (
          '<div class="compare-slot" data-side="' + sideKey + '">' +
            '<span class="compare-slot__label">' + label + '</span>' +
            '<div class="compare-slot__grid">' + cards + '</div>' +
          '</div>'
        );
      }
      slotsEl.innerHTML = side('a', 'Side A') + '<div class="compare-vs" aria-hidden="true">VS</div>' + side('b', 'Side B');
    }

    function syncUrl() {
      if (!state.a || !state.b) return;
      var url = new URL(window.location.href);
      url.searchParams.set('a', state.a);
      url.searchParams.set('b', state.b);
      if (state.diffOnly) url.searchParams.set('diff', '1');
      else url.searchParams.delete('diff');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }

    function renderTable() {
      var a = state.a && platforms[state.a];
      var b = state.b && platforms[state.b];
      var ready = !!(a && b);

      toolbarEl.hidden = !ready;
      tableWrap.hidden = !ready;
      emptyEl.hidden = ready;
      if (!ready) {
        diffCountEl.textContent = '';
        return;
      }

      thead.innerHTML =
        '<tr>' +
          '<th scope="col">Parameter</th>' +
          '<th scope="col">' +
            '<div class="compare-head">' +
              '<span class="compare-head__img' + headImgClass(a) + '"><img src="' + a.image + '" alt=""></span>' +
              '<span><span class="compare-head__name">' + a.name + '</span>' +
              '<span class="compare-head__meta">' + a.cartridge + (a.provisional ? ' · provisional' : '') + '</span>' +
              '<a class="compare-head__link" href="' + a.href + '">View system →</a></span>' +
            '</div>' +
          '</th>' +
          '<th scope="col">' +
            '<div class="compare-head">' +
              '<span class="compare-head__img' + headImgClass(b) + '"><img src="' + b.image + '" alt=""></span>' +
              '<span><span class="compare-head__name">' + b.name + '</span>' +
              '<span class="compare-head__meta">' + b.cartridge + (b.provisional ? ' · provisional' : '') + '</span>' +
              '<a class="compare-head__link" href="' + b.href + '">View system →</a></span>' +
            '</div>' +
          '</th>' +
        '</tr>';

      var html = '';
      var diffCount = 0;
      var shownDiffs = 0;

      groups.forEach(function (group) {
        var rowHtml = '';
        var groupHasVisible = false;

        group.rows.forEach(function (row) {
          var va = a[row.key];
          var vb = b[row.key];
          var same = String(va).toLowerCase() === String(vb).toLowerCase();
          if (!same) diffCount += 1;
          if (state.diffOnly && same) return;

          groupHasVisible = true;
          if (!same) shownDiffs += 1;

          var noteClass = row.key === 'notes' ? ' compare-row__cell--note' : '';
          var cellA = '<td class="compare-row__cell' + noteClass + '">' + va + '</td>';
          var cellB = '<td class="compare-row__cell' + noteClass + '">' + vb + '</td>';

          if (!same && row.compare && row.numKey != null && a[row.numKey] != null && b[row.numKey] != null) {
            var na = a[row.numKey];
            var nb = b[row.numKey];
            var aWins = row.compare === 'higher' ? na > nb : na < nb;
            var bWins = row.compare === 'higher' ? nb > na : nb < na;
            var winClass = row.compare === 'lower' ? ' compare-row__cell--win compare-row__cell--win-low' : ' compare-row__cell--win';
            if (aWins) cellA = '<td class="compare-row__cell' + winClass + '">' + va + '</td>';
            if (bWins) cellB = '<td class="compare-row__cell' + winClass + '">' + vb + '</td>';
          }

          rowHtml +=
            '<tr class="compare-row' + (same ? ' compare-row--same' : ' compare-row--diff') + '">' +
              '<th scope="row" class="compare-row__label">' + row.label + '</th>' +
              cellA + cellB +
            '</tr>';
        });

        if (groupHasVisible) {
          html += '<tr class="compare-group"><td colspan="3">' + group.title + '</td></tr>' + rowHtml;
        }
      });

      tbody.innerHTML = html;
      diffCountEl.textContent = diffCount + ' parameter' + (diffCount === 1 ? '' : 's') + ' differ' +
        (state.diffOnly ? ' · showing ' + shownDiffs : '');
      syncUrl();
    }

    function setPair(a, b) {
      if (!platforms[a] || !platforms[b] || a === b) return;
      state.a = a;
      state.b = b;
      renderPresets();
      renderSlots();
      renderTable();
    }

    function readUrl() {
      var params = new URLSearchParams(window.location.search);
      var a = params.get('a');
      var b = params.get('b');
      state.diffOnly = params.get('diff') === '1';
      if (diffOnlyInput) diffOnlyInput.checked = state.diffOnly;
      if (a && b && platforms[a] && platforms[b] && a !== b) {
        state.a = a;
        state.b = b;
      } else {
        state.a = 'beaver';
        state.b = 'mk47';
      }
    }

    presetsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.compare-preset');
      if (!btn) return;
      setPair(btn.getAttribute('data-a'), btn.getAttribute('data-b'));
    });

    slotsEl.addEventListener('click', function (e) {
      var pick = e.target.closest('.compare-pick');
      if (!pick || pick.classList.contains('is-disabled')) return;
      var side = pick.getAttribute('data-side');
      var id = pick.getAttribute('data-id');
      state[side] = id;
      renderPresets();
      renderSlots();
      renderTable();
    });

    if (diffOnlyInput) {
      diffOnlyInput.addEventListener('change', function () {
        state.diffOnly = diffOnlyInput.checked;
        renderTable();
      });
    }

    if (swapBtn) {
      swapBtn.addEventListener('click', function () {
        var tmp = state.a;
        state.a = state.b;
        state.b = tmp;
        renderPresets();
        renderSlots();
        renderTable();
      });
    }

    readUrl();
    renderPresets();
    renderSlots();
    renderTable();
  })();

  /* ===== Mission fit ===== */
  (function initMission() {
    var root = document.getElementById('mission-app');
    if (!root) return;

    var catalog = {
      beaver: {
        id: 'beaver',
        name: 'TTM Beaver',
        href: 'beaver.html',
        image: 'TTMNewLogo.png',
        logo: true,
        meta: '7.62×39 · In development'
      },
      sigspear: {
        id: 'sigspear',
        name: 'SIG SPEAR',
        href: 'sigspear.html',
        image: 'Sigspear5.png',
        logo: false,
        meta: '.277 Fury · 6.8×51'
      },
      mk47: {
        id: 'mk47',
        name: 'CMMG MK47',
        href: 'cmmg-mk47.html',
        image: 'TTM%20CMMG%20MK47/Main%20CMMG.png',
        logo: false,
        meta: '7.62×39 · AR / AK hybrid'
      },
      mp7: {
        id: 'mp7',
        name: 'MP7',
        href: 'mp7.html',
        image: 'TTM%20MP7/MP7%20Side1%20.png',
        logo: false,
        meta: '4.6×30 · PDW'
      },
      m4a1: {
        id: 'm4a1',
        name: 'M4A1',
        href: 'm4a1.html',
        image: 'M4A1.png',
        logo: false,
        meta: '5.56×45 · Carbine'
      },
      an94: {
        id: 'an94',
        name: 'AN-94',
        href: 'an94.html',
        image: 'AN94.png',
        logo: false,
        meta: '5.45×39 · Hyperburst'
      },
      ruger: {
        id: 'ruger',
        name: 'Ruger Precision',
        href: 'ruger-precision.html',
        image: 'Ruger%20Precison%20.png',
        logo: false,
        meta: '6.5 CM / .308 · Bolt-action'
      }
    };

    var missions = [
      {
        id: 'cqb',
        name: 'CQB',
        blurb: 'Tight spaces, fast transitions, controllable full-auto.',
        title: 'Close-quarters battle',
        desc: 'Prioritize compact length, controllable cyclic fire, and a deep magazine ecosystem. Reach past a few hundred meters is secondary.',
        picks: [
          { id: 'm4a1', badge: 'Primary', why: 'Lightest full-size carbine in the set, STANAG logistics, proven CQB ergonomics.' },
          { id: 'mp7', badge: 'Alternate', why: 'Smaller footprint and soft-armor PDW performance when a rifle is too long.' },
          { id: 'an94', badge: 'Alternate', why: 'Hyperburst puts two rounds on target before full recoil builds — high hit probability up close.' }
        ],
        compare: ['m4a1', 'mp7']
      },
      {
        id: 'vehicle',
        name: 'Vehicle crew',
        blurb: 'Egress, cabins, and one-hand transitions.',
        title: 'Vehicle crew & security',
        desc: 'Space and carry weight dominate. You want something that leaves the cab cleanly and still defeats soft armor at short range.',
        picks: [
          { id: 'mp7', badge: 'Primary', why: 'PDW envelope with retractable stock — built for crews and confined mounts.' },
          { id: 'm4a1', badge: 'Alternate', why: 'When you need rifle ballistics after dismount, still compact enough with a collapsed stock.' },
          { id: 'beaver', badge: 'Watch', why: 'Target collapsible footprint plus 7.62×39 logistics for theaters already on AK ammo.' }
        ],
        compare: ['mp7', 'm4a1']
      },
      {
        id: 'patrol',
        name: 'General patrol',
        blurb: 'All-day carry, mixed contact distances.',
        title: 'General-purpose patrol',
        desc: 'Balance weight, ammo commonality, and enough reach for typical infantry contact. This is the “default rifle” problem.',
        picks: [
          { id: 'm4a1', badge: 'Primary', why: 'Best weight-to-capability trade and deepest NATO mag/ammo base for general issue.' },
          { id: 'mk47', badge: 'Alternate', why: 'AR controls with 7.62×39 punch when intermediate barrier performance matters more than 5.56.' },
          { id: 'beaver', badge: 'Watch', why: 'Program target: AK logistics with modern weight discipline and full ambi controls.' }
        ],
        compare: ['m4a1', 'mk47']
      },
      {
        id: 'dmr',
        name: 'Marksman',
        blurb: 'Precision hits past the rifle line.',
        title: 'Designated marksman / long range',
        desc: 'Prioritize ballistic coefficient, free-floated barrels, and first-round hits. Volume of fire is not the job.',
        picks: [
          { id: 'ruger', badge: 'Primary', why: 'Bolt-action precision chassis — best wind hold and group potential in the catalog.' },
          { id: 'sigspear', badge: 'Alternate', why: 'Semi-auto 6.8×51 for extended reach when you still need a fighting rifle cadence.' },
          { id: 'an94', badge: 'Situational', why: 'Hyperburst aids rapid pair hits at rifle distances, not a true DMR substitute.' }
        ],
        compare: ['ruger', 'sigspear']
      },
      {
        id: 'logistics',
        name: 'Logistics-constrained',
        blurb: 'Theater already runs 7.62×39 and AK mags.',
        title: 'Logistics-constrained theater',
        desc: 'Keep the supply chain you already have. Choose platforms that drink AK magazines and 7.62×39 without forcing a parallel ammo pipeline.',
        picks: [
          { id: 'beaver', badge: 'Primary', why: 'Purpose-built around AK mags and 7.62×39 with modern ergonomics — provisional, but the logistics fit is the point.' },
          { id: 'mk47', badge: 'Alternate', why: 'Production-ready AR ergonomics on the same AK magazine and cartridge logistics.' },
          { id: 'm4a1', badge: 'Fallback', why: 'Only if NATO 5.56 is already in the pipe — otherwise you split the supply chain.' }
        ],
        compare: ['beaver', 'mk47']
      },
      {
        id: 'reach',
        name: 'Extended reach',
        blurb: 'Barrier defeat and longer effective fire.',
        title: 'Extended reach / barrier defeat',
        desc: 'You need energy and retained velocity past typical 5.56 engagement bands. Accept heavier rifles and fewer rounds carried.',
        picks: [
          { id: 'sigspear', badge: 'Primary', why: '.277 Fury / 6.8×51 was built for this — high pressure, long reach, SR-25 feed.' },
          { id: 'ruger', badge: 'Alternate', why: 'When the shot is deliberate and distance is the only problem, bolt-action 6.5 CM wins.' },
          { id: 'mk47', badge: 'Alternate', why: '7.62×39 is not 6.8, but it out-barriers 5.56 inside typical carbine ranges.' }
        ],
        compare: ['sigspear', 'ruger']
      }
    ];

    var profilesEl = document.getElementById('mission-profiles');
    var resultEl = document.getElementById('mission-result');
    var emptyEl = document.getElementById('mission-empty');
    var state = { id: null };

    function mediaClass(p) {
      return p.logo ? ' mission-pick__media--logo' : '';
    }

    function renderProfiles() {
      profilesEl.innerHTML = missions.map(function (m) {
        var sel = state.id === m.id ? ' is-selected' : '';
        return (
          '<button type="button" class="mission-profile' + sel + '" role="option" aria-selected="' + (state.id === m.id) + '" data-id="' + m.id + '">' +
            '<span class="mission-profile__name">' + m.name + '</span>' +
            '<span class="mission-profile__blurb">' + m.blurb + '</span>' +
          '</button>'
        );
      }).join('');
    }

    function renderResult() {
      var mission = null;
      for (var i = 0; i < missions.length; i++) {
        if (missions[i].id === state.id) { mission = missions[i]; break; }
      }

      var ready = !!mission;
      resultEl.hidden = !ready;
      emptyEl.hidden = ready;
      if (!ready) {
        resultEl.innerHTML = '';
        return;
      }

      var picksHtml = mission.picks.map(function (pick, idx) {
        var p = catalog[pick.id];
        var primaryClass = idx === 0 ? ' mission-pick--primary' : '';
        return (
          '<article class="mission-pick' + primaryClass + '">' +
            '<a class="mission-pick__media' + mediaClass(p) + '" href="' + p.href + '" tabindex="-1" aria-hidden="true">' +
              '<img src="' + p.image + '" alt="" loading="lazy">' +
            '</a>' +
            '<div class="mission-pick__body">' +
              '<span class="mission-pick__badge">' + pick.badge + '</span>' +
              '<h3 class="mission-pick__name">' + p.name + '</h3>' +
              '<span class="mission-pick__meta">' + p.meta + '</span>' +
              '<p class="mission-pick__why">' + pick.why + '</p>' +
              '<div class="mission-pick__actions">' +
                '<a class="btn btn--primary" href="' + p.href + '">View system</a>' +
              '</div>' +
            '</div>' +
          '</article>'
        );
      }).join('');

      var compareHref = 'compare.html?a=' + mission.compare[0] + '&b=' + mission.compare[1];

      resultEl.innerHTML =
        '<div class="mission-brief">' +
          '<span class="mission-brief__label">Mission profile</span>' +
          '<h2 class="mission-brief__title">' + mission.title + '</h2>' +
          '<p class="mission-brief__desc">' + mission.desc + '</p>' +
        '</div>' +
        '<div class="mission-picks">' + picksHtml + '</div>' +
        '<div class="mission-result__foot">' +
          '<p class="mission-result__hint">Want the numbers side by side? Open the primary matchup in Compare.</p>' +
          '<a class="btn btn--outline" href="' + compareHref + '">Compare top picks</a>' +
        '</div>';

      var url = new URL(window.location.href);
      url.searchParams.set('m', mission.id);
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }

    profilesEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.mission-profile');
      if (!btn) return;
      state.id = btn.getAttribute('data-id');
      renderProfiles();
      renderResult();
    });

    var params = new URLSearchParams(window.location.search);
    var fromUrl = params.get('m');
    if (fromUrl) {
      for (var j = 0; j < missions.length; j++) {
        if (missions[j].id === fromUrl) { state.id = fromUrl; break; }
      }
    }

    renderProfiles();
    renderResult();
  })();

  /* ===== Forge terminal typewriter ===== */
  (function initForgeTerminal() {
    var panel = document.getElementById('forge-terminal');
    var body = document.getElementById('forge-terminal-body');
    if (!panel || !body) return;

    var lines = [
      { html: '<span class="dim">$</span> forge status --floor' },
      { html: '<span class="ok">●</span> CNC-01  RUNNING  <span class="dim">BVR-RCVR-0042</span>' },
      { html: '<span class="ok">●</span> CNC-02  RUNNING  <span class="dim">SPR-BRL-0117</span>' },
      { html: '<span class="warn">●</span> MILL-01 MAINT    <span class="dim">due 07/04</span>' },
      { html: '<span class="dim">$</span> forge programs --active' },
      { html: 'BEAVER   <span class="warn">DEVELOPMENT</span>  <span class="dim">lead: yoni</span>' },
      { html: 'T-90M    <span class="ok">DEPLOYED</span>      <span class="dim">field: UKR</span>' }
    ];

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var started = false;

    function finish() {
      body.innerHTML = lines.map(function (l) { return '<div>' + l.html + '</div>'; }).join('') +
        '<span class="forge-strip__cursor" aria-hidden="true"></span>';
      panel.classList.remove('is-typing');
    }

    function typeLines() {
      if (reduceMotion) {
        finish();
        return;
      }
      panel.classList.add('is-typing');
      var lineIndex = 0;
      var charIndex = 0;
      var plain = lines.map(function (l) {
        return l.html.replace(/<[^>]+>/g, '');
      });
      body.innerHTML = '<span class="forge-strip__cursor" aria-hidden="true"></span>';

      function renderPartial() {
        var html = '';
        for (var i = 0; i < lineIndex; i++) {
          html += '<div>' + lines[i].html + '</div>';
        }
        if (lineIndex < lines.length) {
          var visible = plain[lineIndex].slice(0, charIndex);
          // Show raw typed chars for current line (simple), then swap to full HTML when done
          html += '<div>' + escapeHtml(visible) + '<span class="forge-strip__cursor" aria-hidden="true"></span></div>';
        } else {
          html += '<span class="forge-strip__cursor" aria-hidden="true"></span>';
        }
        body.innerHTML = html;
      }

      function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      function tick() {
        if (lineIndex >= lines.length) {
          finish();
          return;
        }
        charIndex += 1;
        if (charIndex > plain[lineIndex].length) {
          // commit full styled line
          var committed = '';
          for (var i = 0; i <= lineIndex; i++) {
            committed += '<div>' + lines[i].html + '</div>';
          }
          body.innerHTML = committed + '<span class="forge-strip__cursor" aria-hidden="true"></span>';
          lineIndex += 1;
          charIndex = 0;
          setTimeout(tick, 180);
          return;
        }
        renderPartial();
        setTimeout(tick, 16 + Math.random() * 22);
      }

      tick();
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || started) return;
        started = true;
        typeLines();
        observer.disconnect();
      });
    }, { threshold: 0.4 });

    observer.observe(panel);
  })();

  /* Page transitions */
  var pageTransition = document.getElementById('page-transition');

  function clearPageTransition() {
    if (!pageTransition) return;
    pageTransition.classList.remove('page-transition--active');
    pageTransition.classList.add('page-transition--out');
  }

  /* Browser back/forward restores a frozen page with the overlay still covering it */
  window.addEventListener('pageshow', function () {
    clearPageTransition();
  });

  if (pageTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(clearPageTransition);

    function isInternalPageLink(anchor) {
      var href = anchor.getAttribute('href');
      if (!href || href === '#' || href.indexOf('#') === 0) return false;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return false;
      if (href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return false;
      if (href.indexOf('http') === 0 && href.indexOf(window.location.origin) !== 0) return false;
      try {
        var url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return false;
        return url.pathname.indexOf('.html') !== -1 || url.pathname === '/' || url.pathname.endsWith('/');
      } catch (err) {
        return false;
      }
    }

    document.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link || !isInternalPageLink(link)) return;
      e.preventDefault();
      pageTransition.classList.remove('page-transition--out');
      pageTransition.classList.add('page-transition--active');
      setTimeout(function () {
        window.location.href = link.href;
      }, 380);
    });
  } else {
    clearPageTransition();
  }
})();
