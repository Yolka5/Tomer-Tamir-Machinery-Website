(function () {
  'use strict';

  const header = document.getElementById('header');
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.querySelector('.nav__menu');
  const navActions = document.querySelector('.nav__actions');
  const navLinks = document.querySelectorAll('.nav__link');
  const yearEl = document.getElementById('year');

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

  document.querySelectorAll('.systems__grid .system-card.animate-in').forEach(function (el, i) {
    el.style.setProperty('--delay', (i * 0.12) + 's');
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

  if (yearEl) yearEl.textContent = new Date().getFullYear();

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

  document.querySelectorAll('.system-card').forEach(function (card) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = 'translateY(-8px) scale(1.01) perspective(800px) rotateX(' + (-y * 4) + 'deg) rotateY(' + (x * 4) + 'deg)';
    });
    card.addEventListener('mouseleave', function () {
      card.style.transform = '';
    });
  });

  var contactForm = document.querySelector('.contact__form');
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

  /* Page transitions */
  var pageTransition = document.getElementById('page-transition');
  if (pageTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(function () {
      pageTransition.classList.add('page-transition--out');
    });

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
  } else if (pageTransition) {
    pageTransition.classList.add('page-transition--out');
  }
})();
