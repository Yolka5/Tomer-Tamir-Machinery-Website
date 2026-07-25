/* ===== AWARD-6 — award polish layer =====
   Revert map (everything introduced by the "add all 6" prompt):
     - This file (hero-award.js) — delete entirely
     - index.html: remove hero-award.js script, sound toggle, callout markup,
       and the award-product-first class on <html>
     - styles.css: delete the block between AWARD-6 BEGIN / AWARD-6 END
     - hero3d.js: remove every block tagged AWARD-6:#N
     - script.js: remove the posT field in stage.push (tagged AWARD-6:#3)

   Covers:
     #3 scroll-story callout label (DOM, driven by hero3d story phases)
     #5 shop sound bed + slide click (muted by default)
     #6 product-first load (chrome lands after the product is already alive)
*/
(function () {
  'use strict';

  var viewport = document.getElementById('hero-viewport');
  var intro = document.getElementById('hero-pin-intro');
  if (!viewport) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SLIDE_NAMES = ['T-90M', 'SIG SPEAR', 'CMMG MK47', 'MP7'];

  /* ---------- AWARD-6:#6 product-first load ----------
     Product is already on screen (canvas or DOM card). Chrome waits so the
     first impression is the system, not the marketing copy. */
  document.documentElement.classList.add('award-product-first');
  if (intro) intro.classList.add('award-intro-wait');

  function releaseIntro() {
    document.documentElement.classList.add('award-chrome-in');
    if (intro) intro.classList.remove('award-intro-wait');
  }

  if (reduceMotion) {
    releaseIntro();
  } else {
    window.setTimeout(releaseIntro, 1100);
  }

  /* ---------- AWARD-6:#3 story callout (HUD) ---------- */
  var callout = document.getElementById('hero-award-callout');
  var calloutName = document.getElementById('hero-award-callout-name');
  var calloutMeta = document.getElementById('hero-award-callout-meta');
  var calloutId = document.getElementById('hero-award-callout-id');
  var lastSlide = -1;
  var lastMeta = '';
  var lastOn = false;

  function padSys(n) {
    return 'SYS-' + String(n + 1).padStart(2, '0');
  }

  function setNameChars(text) {
    if (!calloutName) return;
    var chars = String(text || '').split('');
    calloutName.innerHTML = chars.map(function (ch, i) {
      if (ch === ' ') return '<span class="hud-ch" style="--ci:' + i + '">&nbsp;</span>';
      return '<span class="hud-ch" style="--ci:' + i + '">' + ch + '</span>';
    }).join('');
  }

  function syncCallout(story) {
    if (!callout || !story) return;
    var t = story.callout || 0;
    var on = t > 0.08;
    callout.style.opacity = Math.min(1, t * 1.15).toFixed(3);
    /* Wipe open like a targeting reticle, not a floating card fade. */
    var wipe = (1 - t) * 100;
    var leftSide = story.posT >= 1.35;
    callout.classList.toggle('is-left', leftSide);
    if (leftSide) {
      callout.style.left = 'clamp(1.25rem, 4vw, 3.5rem)';
      callout.style.right = 'auto';
      callout.style.clipPath = 'inset(0 0 0 ' + wipe.toFixed(1) + '%)';
    } else {
      callout.style.left = 'auto';
      callout.style.right = 'clamp(1.25rem, 4vw, 3.5rem)';
      callout.style.clipPath = 'inset(0 ' + wipe.toFixed(1) + '% 0 0)';
    }
    callout.style.transform =
      'translate3d(0,' + ((1 - t) * 10).toFixed(1) + 'px,0)';
    callout.style.visibility = t < 0.02 ? 'hidden' : 'visible';
    callout.setAttribute('aria-hidden', t < 0.3 ? 'true' : 'false');

    if (on !== lastOn) {
      callout.classList.toggle('is-on', on);
      lastOn = on;
      /* Retrigger name char cascade when the plate turns on. */
      if (on && calloutName) {
        var current = calloutName.getAttribute('data-text') || '';
        setNameChars(current);
      }
    }

    if (typeof story.slide === 'number' && story.slide !== lastSlide) {
      lastSlide = story.slide;
      var name = SLIDE_NAMES[story.slide] || 'SYSTEM';
      if (calloutId) calloutId.textContent = padSys(story.slide);
      if (calloutName) {
        calloutName.setAttribute('data-text', name);
        setNameChars(name);
      }
    }

    var meta = story.posT >= 1.5 ? 'ENGINEERED FIRST' : 'MACHINED IN-HOUSE';
    if (calloutMeta && meta !== lastMeta) {
      lastMeta = meta;
      calloutMeta.textContent = meta;
      calloutMeta.classList.remove('is-swap');
      void calloutMeta.offsetWidth;
      calloutMeta.classList.add('is-swap');
    }
  }

  /* ---------- AWARD-6:#5 shop sound (Web Audio, no assets) ---------- */
  var soundBtn = document.getElementById('hero-sound-toggle');
  var audioCtx = null;
  var master = null;
  var ambienceNodes = null;
  var unmuted = false;
  var STORAGE_KEY = 'ttm-hero-sound';

  try {
    unmuted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (e) { unmuted = false; }

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    master = audioCtx.createGain();
    master.gain.value = 0;
    master.connect(audioCtx.destination);
    return audioCtx;
  }

  function buildAmbience() {
    if (!audioCtx || ambienceNodes) return;
    /* Soft filtered noise = distant shop floor. Two slow oscillators add a
       barely-there machine hum so it doesn't read as generic white noise. */
    var bufferSize = audioCtx.sampleRate * 2;
    var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.35;

    var noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    var filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.55;

    var noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.045;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();

    var hum1 = audioCtx.createOscillator();
    hum1.type = 'sine';
    hum1.frequency.value = 58;
    var hum2 = audioCtx.createOscillator();
    hum2.type = 'triangle';
    hum2.frequency.value = 116.5;
    var humGain = audioCtx.createGain();
    humGain.gain.value = 0.012;
    hum1.connect(humGain);
    hum2.connect(humGain);
    humGain.connect(master);
    hum1.start();
    hum2.start();

    ambienceNodes = { noise: noise, hum1: hum1, hum2: hum2 };
  }

  function setUnmuted(next) {
    unmuted = !!next;
    if (soundBtn) {
      soundBtn.classList.toggle('is-on', unmuted);
      soundBtn.setAttribute('aria-pressed', unmuted ? 'true' : 'false');
      soundBtn.title = unmuted ? 'Mute workshop ambience' : 'Enable workshop ambience';
    }
    try { localStorage.setItem(STORAGE_KEY, unmuted ? '1' : '0'); } catch (e) {}

    if (!unmuted) {
      if (master && audioCtx) {
        master.gain.cancelScheduledValues(audioCtx.currentTime);
        master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.35);
      }
      return;
    }

    if (!ensureAudio()) return;
    buildAmbience();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    master.gain.cancelScheduledValues(audioCtx.currentTime);
    master.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.6);
  }

  /* Short metallic click on slide change — only while unmuted. */
  function playSlideClick() {
    if (!unmuted || !ensureAudio()) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var t0 = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.08);
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    var clickFilter = audioCtx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.value = 600;
    osc.connect(clickFilter);
    clickFilter.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', function () {
      setUnmuted(!unmuted);
    });
    /* Reflect stored preference in the button, but don't autoplay — browsers
       block that; first click (or a prior unlock) is what starts audio. */
    soundBtn.classList.toggle('is-on', unmuted);
    soundBtn.setAttribute('aria-pressed', unmuted ? 'true' : 'false');
  }

  /* Resume ambience after a gesture if the user left it on. */
  function unlockIfNeeded() {
    if (!unmuted) return;
    setUnmuted(true);
  }
  window.addEventListener('pointerdown', unlockIfNeeded, { once: true, passive: true });

  var slides = document.querySelectorAll('.hero__slide');
  var soundSlide = -1;
  var slideMo = new MutationObserver(function () {
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].classList.contains('hero__slide--active') && i !== soundSlide) {
        if (soundSlide >= 0) playSlideClick();
        soundSlide = i;
        break;
      }
    }
  });
  slides.forEach(function (img, i) {
    if (img.classList.contains('hero__slide--active')) soundSlide = i;
    slideMo.observe(img, { attributes: true, attributeFilter: ['class'] });
  });

  /* Bridge: hero3d pushes story phases each frame when GL is active. */
  window.__ttmHeroAward = {
    syncStory: syncCallout,
    playSlideClick: playSlideClick
  };
})();
