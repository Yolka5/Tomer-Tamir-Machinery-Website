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

  // ----- Career Path Planner -----
  (function initCareerPlanner() {
    const planner = document.querySelector('.career-planner');
    if (!planner) return;

    const steps = Array.from(planner.querySelectorAll('.planner-step'));
    const options = planner.querySelectorAll('.planner-option');
    const progressBar = document.getElementById('career-planner-progress');
    const restartBtn = document.getElementById('career-planner-restart');
    const rolesEl = document.getElementById('planner-roles');
    const interviewEl = document.getElementById('planner-interview-focus');
    const timelineEl = document.getElementById('planner-timeline');

    if (!steps.length) return;

    let currentStepIndex = 0;
    const selections = {
      tracks: new Set(),
      seniority: null,
      style: null,
      goal: null
    };

    const roleMap = {
      mechanical: ['Mechanical Engineer', 'CAD Designer'],
      production: ['Manufacturing Engineer', 'CNC Machinist', 'Assembly Technician'],
      software: ['Software Engineer', 'Embedded Systems Engineer'],
      electronics: ['Electronics Engineer', 'Embedded Systems Engineer'],
      systems: ['Systems / Integration Engineer']
    };

    function setActiveStep(index) {
      steps.forEach(function (step, i) {
        step.classList.toggle('is-active', i === index);
      });
      currentStepIndex = index;
      const progress = ((index) / (steps.length - 1)) * 100;
      if (progressBar) {
        progressBar.style.width = progress + '%';
      }
    }

    function resetPlanner() {
      selections.tracks.clear();
      selections.seniority = null;
      selections.style = null;
      selections.goal = null;
      setActiveStep(0);
      if (rolesEl) {
        rolesEl.innerHTML = '<li>Mechanical Engineer · Manufacturing Engineer · Software / Embedded Engineer · Electronics Engineer · Assembly / CNC roles</li>';
      }
      if (interviewEl) {
        interviewEl.innerHTML = '' +
          '<li>Bring 1–2 projects you can walk through end‑to‑end—decisions, failures, and what you’d change.</li>' +
          '<li>Be ready to talk about how you work with constraints: time, budget, materials, or mission.</li>';
      }
      if (timelineEl) {
        timelineEl.innerHTML = '' +
          '<li>0–3 months: onboarding, platform overview, shadowing on SIG SPEAR or T‑90M.</li>' +
          '<li>3–6 months: owning small components, documenting work to TTM standards.</li>' +
          '<li>6–12 months: leading sub‑assemblies or features with real field impact.</li>';
      }
    }

    function updateSummary() {
      // Roles
      const trackArray = Array.from(selections.tracks);
      const suggestedRoles = [];
      trackArray.forEach(function (t) {
        const roles = roleMap[t];
        if (roles) {
          roles.forEach(function (r) {
            if (!suggestedRoles.includes(r)) suggestedRoles.push(r);
          });
        }
      });

      if (rolesEl && suggestedRoles.length) {
        rolesEl.innerHTML = suggestedRoles.map(function (r) {
          return '<li>' + r + '</li>';
        }).join('');
      }

      // Interview focus
      if (interviewEl) {
        const focusItems = [];

        if (selections.style === 'theory') {
          focusItems.push('Walk through a design you engineered from requirements to validation. Bring sketches, CAD, or calculations.');
        } else if (selections.style === 'prototype') {
          focusItems.push('Show a prototype or build you iterated on. Be specific about failures and fixes.');
        } else if (selections.style === 'systems') {
          focusItems.push('Pick a system (SIG SPEAR, T‑90M, or similar) and explain how subsystems interact and where you would improve it.');
        }

        if (selections.tracks.has('production')) {
          focusItems.push('Be ready to talk about safety, repeatability, and how you debug issues on the workshop floor.');
        }
        if (selections.tracks.has('software')) {
          focusItems.push('Highlight an embedded or controls project—real‑time constraints, debugging on hardware, and test strategy.');
        }

        if (selections.seniority === 'entry') {
          focusItems.push('Emphasize potential: side projects, curiosity, and how quickly you ramp up on new tools.');
        } else if (selections.seniority === 'senior') {
          focusItems.push('Come with a story where you led a team or design decision under pressure.');
        }

        if (!focusItems.length) {
          focusItems.push('Bring 1–2 projects you can walk through end‑to‑end—decisions, failures, and what you’d change.');
        }

        interviewEl.innerHTML = focusItems.map(function (item) {
          return '<li>' + item + '</li>';
        }).join('');
      }

      // Timeline
      if (timelineEl) {
        const items = [];
        if (selections.goal === 'craft') {
          items.push('0–3 months: lock in fundamentals on one machine, codebase, or subsystem. Shadow senior engineers.');
          items.push('3–6 months: own a repeatable task: a CNC program family, a fixture, or a firmware module.');
          items.push('6–12 months: become the person others come to for that craft, and start documenting best practices.');
        } else if (selections.goal === 'impact') {
          items.push('0–3 months: join an existing SIG SPEAR or T‑90M workstream; fix bugs and close small tickets.');
          items.push('3–6 months: take ownership of a component that ships to the field—design, test, and validation.');
          items.push('6–12 months: drive improvements from field feedback back into design or processes.');
        } else if (selections.goal === 'lead') {
          items.push('0–3 months: understand how engineering, manufacturing, and assembly connect at TTM.');
          items.push('3–6 months: coordinate a small cross‑discipline task—mechanical + software + assembly.');
          items.push('6–12 months: lead a sub‑assembly or feature from concept to deployment.');
        } else {
          items.push('0–3 months: onboarding, platform overview, shadowing on SIG SPEAR or T‑90M.');
          items.push('3–6 months: owning small components, documenting work to TTM standards.');
          items.push('6–12 months: leading sub‑assemblies or features with real field impact.');
        }

        timelineEl.innerHTML = items.map(function (item) {
          return '<li>' + item + '</li>';
        }).join('');
      }
    }

    options.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const tracks = (this.dataset.tracks || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
        tracks.forEach(function (t) { selections.tracks.add(t); });

        if (this.dataset.seniority) {
          selections.seniority = this.dataset.seniority;
        }
        if (this.dataset.style) {
          selections.style = this.dataset.style;
        }
        if (this.dataset.goal) {
          selections.goal = this.dataset.goal;
        }

        const nextIndex = currentStepIndex + 1;
        if (nextIndex < steps.length) {
          setActiveStep(nextIndex);
        } else {
          // Completed
          setActiveStep(currentStepIndex);
          updateSummary();
        }
      });
    });

    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        resetPlanner();
      });
    }

    // initial state
    resetPlanner();
  })();

})();
