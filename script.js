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
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  var heroMedia = document.querySelector('.hero__media');
  if (heroMedia) {
    window.addEventListener('scroll', function () {
      var scrolled = window.scrollY;
      if (scrolled < window.innerHeight) {
        heroMedia.style.transform = 'translateY(' + (scrolled * 0.22) + 'px)';
      }
    }, { passive: true });
  }

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
  var hero = document.getElementById('hero');
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
