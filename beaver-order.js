(function () {
  'use strict';

  var shop = window.TTMShop;
  if (!shop) return;

  var video = document.querySelector('.order-greet__video');
  if (video && video.paused) video.play().catch(function () {});

  var barrelInputs = document.querySelectorAll('input[name="barrel"]');
  var barrelSeg = document.querySelector('.order-seg');
  var integralWrap = document.querySelector('[data-integral]');
  var integralBtn = document.getElementById('opt-integral');
  var boxBtn = document.getElementById('opt-box');
  var sheet = document.getElementById('order-sheet');
  var continueLink = document.getElementById('order-continue');
  var slideTimer;

  var state = shop.load();

  function setPressed(btn, on) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function persist() {
    state = shop.save(state);
    shop.renderSheet(sheet, state, true);
    if (continueLink) continueLink.setAttribute('href', shop.checkoutUrl(state));
  }

  function slideBarrel(next) {
    if (!barrelSeg) return;
    var prev = barrelSeg.getAttribute('data-barrel');
    barrelSeg.setAttribute('data-barrel', next);
    if (!prev || prev === next) return;
    window.clearTimeout(slideTimer);
    barrelSeg.classList.add('is-sliding');
    slideTimer = window.setTimeout(function () {
      barrelSeg.classList.remove('is-sliding');
    }, 520);
  }

  function syncBarrel() {
    var picked = document.querySelector('input[name="barrel"]:checked');
    state.barrel = picked ? picked.value : '13.7';
    slideBarrel(state.barrel);
    var isTen = state.barrel === '10';
    if (integralWrap) integralWrap.classList.toggle('is-open', isTen);
    if (!isTen) {
      state.integral = false;
      setPressed(integralBtn, false);
    }
    persist();
  }

  barrelInputs.forEach(function (input) {
    input.checked = input.value === state.barrel;
    input.addEventListener('change', syncBarrel);
  });

  setPressed(integralBtn, state.integral);
  setPressed(boxBtn, state.box);
  if (barrelSeg) barrelSeg.setAttribute('data-barrel', state.barrel);
  if (integralWrap) integralWrap.classList.toggle('is-open', state.barrel === '10');
  persist();

  if (integralBtn) {
    integralBtn.addEventListener('click', function () {
      if (state.barrel !== '10') return;
      state.integral = !state.integral;
      setPressed(integralBtn, state.integral);
      persist();
    });
  }

  if (boxBtn) {
    boxBtn.addEventListener('click', function () {
      state.box = !state.box;
      setPressed(boxBtn, state.box);
      persist();
    });
  }

  if (continueLink) {
    continueLink.addEventListener('click', function () {
      persist();
    });
  }
})();
