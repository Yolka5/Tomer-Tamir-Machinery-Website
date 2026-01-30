(function () {
  'use strict';

  const header = document.getElementById('header');
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.querySelector('.nav__menu');
  const navLinks = document.querySelectorAll('.nav__link');
  const yearEl = document.getElementById('year');

  // ----- Navbar scroll -----
  function onScroll() {
    if (window.scrollY > 60) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ----- Mobile menu -----
  function toggleMenu() {
    navMenu.classList.toggle('open');
    navToggle.classList.toggle('active');
    document.body.style.overflow = navMenu.classList.contains('open') ? 'hidden' : '';
  }

  navToggle.addEventListener('click', toggleMenu);

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      if (navMenu.classList.contains('open')) {
        toggleMenu();
      }
    });
  });

  // ----- Scroll-triggered animations -----
  const animateEls = document.querySelectorAll('.animate-in');
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -80px 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, observerOptions);

  animateEls.forEach(function (el) {
    observer.observe(el);
  });

  // ----- Stat counters -----
  const statNums = document.querySelectorAll('.about__stat-num');

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    const duration = 1500;
    const start = performance.now();

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * easeOut);
      el.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    }

    requestAnimationFrame(step);
  }

  const counterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        const numEl = entry.target;
        animateCounter(numEl);
        counterObserver.unobserve(numEl);
      }
    });
  }, { threshold: 0.5 });

  statNums.forEach(function (el) {
    counterObserver.observe(el);
  });

  // ----- Footer year -----
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // ----- Smooth scroll for anchor links -----
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

  // ----- Project modals -----
  const projectCards = document.querySelectorAll('[data-project-modal]');
  const modals = document.querySelectorAll('.modal');

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      modal.classList.add('is-open');
    });
    var closeBtn = modal.querySelector('.modal__close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('is-open');
    setTimeout(function () {
      modalEl.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }, 350);
  }

  projectCards.forEach(function (card) {
    var modalId = card.getAttribute('data-project-modal');
    if (!modalId) return;
    modalId = 'modal-' + modalId;

    card.addEventListener('click', function () {
      openModal(modalId);
    });

    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(modalId);
      }
    });
  });

  modals.forEach(function (modal) {
    var overlay = modal.querySelector('.modal__overlay');
    var closeBtn = modal.querySelector('.modal__close');

    if (overlay) {
      overlay.addEventListener('click', function () {
        closeModal(modal);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        closeModal(modal);
      });
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openModalEl = document.querySelector('.modal.is-open');
    if (openModalEl) closeModal(openModalEl);
  });

  // ----- Open modal from buttons (e.g. In the field CTA) -----
  document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
    var modalId = btn.getAttribute('data-open-modal');
    if (!modalId) return;
    modalId = 'modal-' + modalId;
    btn.addEventListener('click', function () {
      openModal(modalId);
    });
  });

  // ----- Back to top -----
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
    window.addEventListener('scroll', function () {
      updateBackToTop();
    }, { passive: true });
    updateBackToTop();
    backToTop.addEventListener('click', function () {
      document.getElementById('hero').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ----- FAQ accordion -----
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

  // ----- Careers Tabs -----
  const tabButtons = document.querySelectorAll('.tabs__button');
  const tabPanels = document.querySelectorAll('.tabs__panel');

  tabButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const targetPanelId = this.getAttribute('aria-controls');
      
      // Remove active class from all buttons and panels
      tabButtons.forEach(function (btn) {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      });
      
      tabPanels.forEach(function (panel) {
        panel.classList.remove('active');
        panel.setAttribute('hidden', '');
      });
      
      // Add active class to clicked button and corresponding panel
      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');
      
      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) {
        targetPanel.classList.add('active');
        targetPanel.removeAttribute('hidden');
      }
    });
  });
})();
