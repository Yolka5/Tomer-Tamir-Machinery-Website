/* ===== Hero WebGL stage =====
   Replaces the hero card's faked CSS depth with a real perspective scene.

   The DOM version stacked siblings and simulated parallax by multiplying the
   mouse offset per layer ("bigger multiplier = further back"). Here the sheets
   sit at genuine Z depths in front of / behind the photo and a projection
   matrix does the work, so parallax, foreshortening and the size difference
   between layers all fall out of the geometry instead of being hand-tuned.

   script.js still owns the scroll timeline; it pushes its already-cushioned
   state in here each tick. This module runs its own uncapped rAF while the
   hero is on screen so the stage keeps breathing even when scroll is idle.

   Degrades to the original DOM card if WebGL2 is missing, the context is
   lost, on narrow viewports, or under prefers-reduced-motion. */
(function () {
  'use strict';

  var section = document.getElementById('hero');
  var viewport = document.getElementById('hero-viewport');
  var domCard = document.getElementById('hero-card');
  var slidesWrap = document.querySelector('.hero__slides');
  if (!section || !viewport || !domCard || !slidesWrap) return;

  var imgs = [].slice.call(slidesWrap.querySelectorAll('.hero__slide'));
  if (!imgs.length) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqDesktop = window.matchMedia('(min-width: 861px)');

  /* ---------- mat4 (column-major, WebGL order) ---------- */
  function mIdent(o) {
    o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
    return o;
  }
  function mMul(o, a, b) {
    for (var c = 0; c < 4; c++) {
      var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      for (var r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b0 + a[4 + r] * b1 + a[8 + r] * b2 + a[12 + r] * b3;
      }
    }
    return o;
  }
  function mTrans(o, x, y, z) { mIdent(o); o[12] = x; o[13] = y; o[14] = z; return o; }
  function mScale(o, x, y, z) { mIdent(o); o[0] = x; o[5] = y; o[10] = z; return o; }
  function mRotX(o, a) { mIdent(o); var c = Math.cos(a), s = Math.sin(a); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; }
  function mRotY(o, a) { mIdent(o); var c = Math.cos(a), s = Math.sin(a); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; }
  function mRotZ(o, a) { mIdent(o); var c = Math.cos(a), s = Math.sin(a); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; }
  function mPersp(o, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
    o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
    return o;
  }

  /* ---------- context ---------- */
  var canvas = document.createElement('canvas');
  canvas.className = 'hero-gl';
  canvas.setAttribute('aria-hidden', 'true');

  var gl = null;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
  } catch (e) { gl = null; }
  if (!gl) return;

  /* ---------- shaders ---------- */
  var VERT = [
    '#version 300 es',
    'in vec2 aPos;',
    'uniform mat4 uMVP;',
    'out vec2 vUv;',
    'void main(){',
    '  vUv = aPos + 0.5;',
    '  gl_Position = uMVP * vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* Signed distance to a rounded rectangle, in units normalised by the
     plane's height (so x spans +/-aspect/2 and y spans +/-0.5). Working in
     normalised space keeps the corner radius and border width independent of
     how far the plane has been scaled down. */
  var SDF = [
    'float sdRound(vec2 p, vec2 b, float r){',
    '  vec2 q = abs(p) - b + r;',
    '  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;',
    '}'
  ].join('\n');

  var FRAG_PHOTO = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'out vec4 frag;',
    'uniform sampler2D uTexA;',
    'uniform sampler2D uTexB;',
    'uniform vec4 uStA;',
    'uniform vec4 uStB;',
    'uniform float uMix, uAspect, uRadius, uBorderW, uOverlay, uBorder, uOpacity, uSpotAmt;',
    /* AWARD-6:#1 bleed lets the product soft-overflow the rounded frame.
       AWARD-6:#2 uMatSpec / uLight drive a machined-metal edge response. */
    'uniform float uBleed, uMatSpec;',
    'uniform vec2 uSpot, uLight;',
    SDF,
    'void main(){',
    '  vec3 a = texture(uTexA, vUv * uStA.xy + uStA.zw).rgb;',
    '  vec3 b = texture(uTexB, vUv * uStB.xy + uStB.zw).rgb;',
    '  vec3 col = mix(a, b, uMix);',
    /* Cursor spotlight, the GL twin of .hero__spotlight. */
    '  float sd2 = distance(vec2(vUv.x * uAspect, vUv.y), vec2(uSpot.x * uAspect, uSpot.y));',
    '  col += uSpotAmt * exp(-sd2 * sd2 * 5.0) * 0.17;',
    /* AWARD-6:#2 — kept very quiet after feedback; glass sheen stays, photo
       specular is barely there so it doesn't read as a plastic material pass. */
    '  vec2 n = normalize(vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5) + 1e-4);',
    '  float ndl = clamp(dot(n, normalize(uLight)), 0.0, 1.0);',
    '  float spec = pow(ndl, 40.0) * uMatSpec * 0.22;',
    '  col += vec3(spec);',
    /* Bottom-up white wash that melts the full-bleed photo into the page.
       Same stops as .hero__overlay: #fff at the bottom, 0.9 at 28%, 0.25 at
       the top. Fades out as the card lifts off the page. */
    '  float wash = vUv.y < 0.28',
    '    ? mix(1.0, 0.9, vUv.y / 0.28)',
    '    : mix(0.9, 0.25, (vUv.y - 0.28) / 0.72);',
    '  col = mix(col, vec3(1.0), wash * uOverlay);',
    '  vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);',
    '  float d = sdRound(p, vec2(0.5 * uAspect, 0.5), uRadius);',
    '  float aa = max(fwidth(d), 1e-5);',
    /* AWARD-6:#1 — soft bleed past the frame instead of a hard clip. */
    '  float mask = 1.0 - smoothstep(-aa - uBleed, aa + uBleed * 0.35, d);',
    '  float rim = mask * smoothstep(-uBorderW - aa, -uBorderW + aa, d) * uBorder;',
    '  col = mix(col, vec3(0.05, 0.05, 0.06), rim * 0.5);',
    '  float al = mask * uOpacity;',
    '  frag = vec4(col * al, al);',
    '}'
  ].join('\n');

  /* One program covers the three non-photo plates:
     0 = contact shadow, 1 = ghost sheet, 2 = front glass. */
  var FRAG_PLATE = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'out vec4 frag;',
    'uniform float uAspect, uRadius, uBorderW, uOpacity, uSheen, uInset, uBlur;',
    'uniform int uStyle;',
    SDF,
    'void main(){',
    '  vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);',
    /* Cast shadow: the same rounded rect as the card, inset and feathered —
       the GL equivalent of .hero-card__border's box-shadow. Its plane is
       oversized so the feather has somewhere to fall off. */
    '  if (uStyle == 0) {',
    '    float sd = sdRound(p, vec2(0.5 * uAspect, 0.5) * uInset, uRadius * uInset);',
    '    float a = (1.0 - smoothstep(-uBlur, uBlur, sd)) * uOpacity;',
    '    frag = vec4(vec3(0.04, 0.04, 0.05) * a, a);',
    '    return;',
    '  }',
    '  float d = sdRound(p, vec2(0.5 * uAspect, 0.5), uRadius);',
    '  float aa = max(fwidth(d), 1e-5);',
    '  float mask = 1.0 - smoothstep(-aa, aa, d);',
    '  float edge = smoothstep(-uBorderW - aa, -uBorderW + aa, d);',
    '  vec3 col; float a;',
    '  if (uStyle == 1) {',
    /* Ghost sheets: hairline frames only — no milky fill. */
    '    col = vec3(0.06, 0.06, 0.07);',
    '    a = edge * 0.55;',
    '    a *= mask * uOpacity;',
    '    frag = vec4(col * a, a);',
    '    return;',
    '  } else {',
    /* AWARD-6:#2 redesign — technical viewport, not frosted glass slab.
       Near-clear fill + crisp rim + corner ticks. */
    '    col = vec3(1.0);',
    '    a = 0.03;',
    '    float t = vUv.x * 0.8 + (1.0 - vUv.y) * 0.5;',
    '    float s = t - uSheen;',
    '    a += exp(-s * s * 40.0) * 0.12;',
    '    float bw = uBorderW * 1.15;',
    '    float rim = smoothstep(-bw - aa, -bw + aa, d);',
    '    col = mix(col, vec3(0.08, 0.08, 0.09), rim);',
    '    a = mix(a, 0.72, rim);',
    /* Corner brackets inside the plate. */
    '    vec2 q = abs(p);',
    '    vec2 halfB = vec2(0.5 * uAspect, 0.5) - uRadius * 0.15;',
    '    float cornerLen = 0.085;',
    '    float inX = step(halfB.x - cornerLen, q.x) * step(q.x, halfB.x);',
    '    float inY = step(halfB.y - cornerLen, q.y) * step(q.y, halfB.y);',
    '    float nearX = 1.0 - smoothstep(0.0, aa * 2.0, abs(q.x - halfB.x));',
    '    float nearY = 1.0 - smoothstep(0.0, aa * 2.0, abs(q.y - halfB.y));',
    '    float tick = clamp(inX * nearY + inY * nearX, 0.0, 1.0) * mask;',
    '    col = mix(col, vec3(0.06), tick);',
    '    a = max(a, tick * 0.9);',
    '  }',
    '  a *= mask * uOpacity;',
    '  frag = vec4(col * a, a);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (window.console) console.warn('[hero3d]', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function program(fragSrc, uniformNames) {
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      if (window.console) console.warn('[hero3d]', gl.getProgramInfoLog(p));
      return null;
    }
    var u = {};
    for (var i = 0; i < uniformNames.length; i++) {
      u[uniformNames[i]] = gl.getUniformLocation(p, uniformNames[i]);
    }
    return { p: p, u: u };
  }

  /* ---------- GPU resources ----------
     All of this is thrown away by a context loss, so it lives in one function
     that can be re-run on restore. */
  var photoProg = null, plateProg = null, vao = null, slots = null;
  var anisoExt = null, maxAniso = 0;

  function blankTexture() {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function upload(slot) {
    if (slot.loaded) return;
    var img = slot.img;
    if (!img.complete || !img.naturalWidth) return;
    gl.bindTexture(gl.TEXTURE_2D, slot.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (anisoExt) gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, maxAniso));
    slot.w = img.naturalWidth;
    slot.h = img.naturalHeight;
    slot.loaded = true;
  }

  function buildResources() {
    photoProg = program(FRAG_PHOTO, [
      'uMVP', 'uTexA', 'uTexB', 'uStA', 'uStB', 'uMix', 'uAspect',
      'uRadius', 'uBorderW', 'uOverlay', 'uBorder', 'uOpacity', 'uSpot', 'uSpotAmt',
      /* AWARD-6:#1+#2 */
      'uBleed', 'uMatSpec', 'uLight'
    ]);
    plateProg = program(FRAG_PLATE, [
      'uMVP', 'uAspect', 'uRadius', 'uBorderW', 'uOpacity', 'uSheen', 'uStyle', 'uInset', 'uBlur'
    ]);
    if (!photoProg || !plateProg) return false;

    /* One unit quad, reused by every layer. */
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
      -0.5, 0.5, 0.5, -0.5, 0.5, 0.5
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    anisoExt = gl.getExtension('EXT_texture_filter_anisotropic');
    maxAniso = anisoExt ? gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;

    slots = imgs.map(function (img) {
      return { img: img, tex: blankTexture(), w: 1, h: 1, loaded: false };
    });
    slots.forEach(function (slot) {
      if (slot.img.complete && slot.img.naturalWidth) upload(slot);
      else slot.img.addEventListener('load', function () { upload(slot); }, { once: true });
    });
    return true;
  }

  if (!buildResources()) return;

  /* object-fit: cover + object-position: center 40%, as a UV scale/offset.
     For the vertical crop, 40%-from-top leaves 60% of the excess below the
     window; v runs bottom-to-top after the flip, so that lands at 0.6*(1-r). */
  var stTmp = new Float32Array(4);
  function coverST(slot, planeAspect) {
    stTmp[0] = 1; stTmp[1] = 1; stTmp[2] = 0; stTmp[3] = 0;
    if (!slot.loaded) return stTmp;
    var ta = slot.w / slot.h;
    if (ta > planeAspect) {
      stTmp[0] = planeAspect / ta;
      stTmp[2] = (1 - stTmp[0]) * 0.5;
    } else {
      stTmp[1] = ta / planeAspect;
      stTmp[3] = 0.6 * (1 - stTmp[1]);
    }
    return stTmp;
  }

  /* ---------- layer table ----------
     x/y are in CSS pixels at full card size and scale with the card; z is the
     real depth the perspective divide acts on and is opened up by shrinkT, so
     the deck fans apart in space as it lifts off the page. */
  /* Painter's order — no depth buffer, so the array order is the draw order.
     The shadow sits between the ghost sheets and the photo so the card casts
     onto the sheets behind it, the way the DOM box-shadow did.
     AWARD-6:#1 — extra soft page contact shadow under the stack.
     AWARD-6:#3 — id tags drive the scroll-story opacity stagger. */
  var SHADOW_GROW = 1.5;
  var LAYERS = [
    { id: 'pageShadow', style: 0, x: 10, y: 48, z: -55, rz: 0, op: 0.28, grow: 1.55 },
    { id: 'ghost2', style: 1, x: -92, y: 64, z: -360, rz: 1.2, op: 0.9, grow: 1 },
    { id: 'ghost1', style: 1, x: -44, y: 32, z: -190, rz: -0.8, op: 0.95, grow: 1 },
    { id: 'cardShadow', style: 0, x: 0, y: 28, z: -28, rz: 0, op: 0.42, grow: SHADOW_GROW },
    { id: 'photo', style: -1, x: 0, y: 0, z: 0, rz: 0, op: 1, grow: 1 },
    /* Glass hugs the photo — slight forward Z + small offset, not a floating slab. */
    { id: 'glass', style: 2, x: -18, y: 14, z: 95, rz: -0.3, op: 1, grow: 1.01 }
  ];

  var FOV = 30 * Math.PI / 180;

  /* ---------- state ---------- */
  var st = { shrinkT: 0, scale: 1, moveX: 0, liftY: 0, rotX: 0, rotY: 0, radius: 0, posT: 0 };
  var mouseX = 0, mouseY = 0, spotX = 0.5, spotY = 0.5, spotAmt = 0, hovered = false;
  var curIdx = 0, prevIdx = 0, mix = 1;
  var intro = 0;
  /* AWARD-6:#4 — stamp overshoot settles after the shrink kick. */
  var stamp = 0, stampVel = 0, prevShrink = 0;
  var ready = false, running = false, onScreen = false, lost = false;
  var vw = 0, vh = 0;
  var start = performance.now(), lastT = 0;
  var SLIDE_FADE = 1.4; /* matches the .hero__slide opacity transition */

  /* script.js owns the scroll timeline and pushes its cushioned state here. */
  var api = {
    ready: false,
    push: function (next) {
      st.shrinkT = next.shrinkT;
      st.scale = next.scale;
      st.moveX = next.moveX;
      st.liftY = next.liftY;
      st.rotX = next.rotX;
      st.rotY = next.rotY;
      st.radius = next.radius;
      /* AWARD-6:#3 */
      if (typeof next.posT === 'number') st.posT = next.posT;
    }
  };
  window.__ttmHero3D = api;

  var mProj = new Float32Array(16), mView = new Float32Array(16);
  var mRig = new Float32Array(16), mTmp = new Float32Array(16), mTmp2 = new Float32Array(16);
  var mModel = new Float32Array(16), mMVP = new Float32Array(16), mVP = new Float32Array(16);

  function resize() {
    var w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    vw = w; vh = h;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  /* AWARD-6:#3 — staged reveal as the card lifts off the page. */
  function storyPhases(shrink) {
    return {
      pageShadow: clamp01((shrink - 0.02) / 0.18),
      ghost2: easeOutCubic(clamp01((shrink - 0.08) / 0.28)),
      ghost1: easeOutCubic(clamp01((shrink - 0.18) / 0.30)),
      cardShadow: clamp01((shrink - 0.12) / 0.22),
      /* AWARD-6:#4 glass snaps late and hard after the wash clears. */
      glass: easeOutCubic(clamp01((shrink - 0.42) / 0.22)),
      callout: easeOutCubic(clamp01((shrink - 0.62) / 0.28))
    };
  }

  function draw(now, dt) {
    if (lost || !photoProg) return;
    var t = (now - start) / 1000;
    resize();
    if (!vw || !vh) return;

    var s = st.scale;
    var shrink = st.shrinkT;
    var aspect = vw / vh;
    var story = storyPhases(shrink);

    /* AWARD-6:#4 — kick the stamp spring when shrink first surges. */
    var dShrink = shrink - prevShrink;
    if (dShrink > 0.004 && shrink > 0.05 && shrink < 0.85) {
      stampVel += dShrink * 14;
    }
    prevShrink = shrink;
    stampVel += (0 - stamp) * 18 * dt;
    stampVel *= Math.exp(-dt * 9);
    stamp += stampVel * dt;
    if (Math.abs(stamp) < 0.0005 && Math.abs(stampVel) < 0.001) { stamp = 0; stampVel = 0; }

    /* Camera distance chosen so the plane at z=0 with scale 1 exactly fills
       the viewport — keeps GL geometry in the same pixel space the scroll
       timeline already speaks in. */
    var dist = vh / (2 * Math.tan(FOV / 2));
    mPersp(mProj, FOV, aspect, dist * 0.05, dist * 4);
    mTrans(mView, 0, 0, -dist);
    mMul(mVP, mProj, mView);

    /* Idle life: a slow breath on rotation and depth so the stage never sits
       perfectly still, scaled by shrinkT so the full-bleed photo stays calm.
       AWARD-6:#6 — tiny breath even at rest so the product feels alive on load. */
    var breathAmp = 0.12 + shrink * 0.88;
    var breathX = Math.sin(t * 0.31) * 0.4 * breathAmp;
    var breathY = Math.sin(t * 0.23 + 1.3) * 0.55 * breathAmp;
    var bob = Math.sin(t * 0.19) * 16 * shrink;

    var rotX = (st.rotX + breathX) * Math.PI / 180;
    var rotY = (st.rotY + breathY) * Math.PI / 180;

    /* One-shot settle on first paint, standing in for the CSS heroZoom. */
    intro = Math.min(1, intro + dt / 1.2);
    var introScale = 1 + 0.06 * Math.pow(1 - intro, 3);

    mTrans(mRig, st.moveX, -st.liftY, bob);
    mMul(mRig, mRig, mRotX(mTmp, rotX));
    mMul(mRig, mRig, mRotY(mTmp, rotY));

    var planeW = vw * s * introScale;
    var planeH = vh * s * introScale;
    var radius = st.radius / (vh * s);
    var borderW = 3 / (vh * s);
    /* AWARD-6:#2 — sheen tracks cursor so glass feels hand-lit. */
    var sheen = 0.65 + Math.sin(t * 0.22) * 0.35 + mouseX * 0.38 - mouseY * 0.18;
    var lightX = mouseX * 0.65 + Math.sin(t * 0.27) * 0.2;
    var lightY = -mouseY * 0.55 + 0.35;

    /* AWARD-6:#4 — wash clears faster once glass is arriving (coolant dissolve). */
    var overlay = (1 - shrink) * (1 - story.glass * 0.55);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(vao);

    for (var i = 0; i < LAYERS.length; i++) {
      var L = LAYERS[i];
      var phase = 1;
      if (L.id === 'pageShadow') phase = story.pageShadow;
      else if (L.id === 'ghost2') phase = story.ghost2;
      else if (L.id === 'ghost1') phase = story.ghost1;
      else if (L.id === 'cardShadow') phase = story.cardShadow;
      else if (L.id === 'glass') phase = story.glass;

      var op = L.style === -1 ? 1 : L.op * phase;
      if (op < 0.004) continue;

      /* AWARD-6:#1 — photo slightly overscales the frame so it breaks out. */
      var grow = L.grow;
      if (L.id === 'photo') grow = 1 + 0.075 * shrink;
      /* AWARD-6:#4 — ghosts stamp outward then settle. */
      if (L.id === 'ghost1' || L.id === 'ghost2') {
        grow *= 1 + stamp * (L.id === 'ghost2' ? 0.08 : 0.05);
      }
      if (L.id === 'glass') {
        grow *= 1 + Math.max(0, stamp) * 0.03 + (1 - phase) * 0.04;
      }

      var zMul = shrink;
      if (L.id === 'ghost2') zMul = shrink * (0.7 + 0.3 * phase);
      if (L.id === 'ghost1') zMul = shrink * (0.75 + 0.25 * phase);

      mTrans(mModel, L.x * s * phase, -L.y * s * phase, L.z * zMul);
      if (L.rz) mMul(mModel, mModel, mRotZ(mTmp, L.rz * Math.PI / 180 * phase));
      mMul(mModel, mModel, mScale(mTmp2, planeW * grow, planeH * grow, 1));
      mMul(mModel, mRig, mModel);
      mMul(mMVP, mVP, mModel);

      if (L.style === -1) {
        gl.useProgram(photoProg.p);
        var u = photoProg.u;
        gl.uniformMatrix4fv(u.uMVP, false, mMVP);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, slots[prevIdx].tex);
        gl.uniform1i(u.uTexA, 0);
        gl.uniform4fv(u.uStA, coverST(slots[prevIdx], aspect));
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, slots[curIdx].tex);
        gl.uniform1i(u.uTexB, 1);
        gl.uniform4fv(u.uStB, coverST(slots[curIdx], aspect));
        gl.uniform1f(u.uMix, 1 - Math.pow(1 - mix, 3));
        gl.uniform1f(u.uAspect, aspect);
        gl.uniform1f(u.uRadius, radius);
        gl.uniform1f(u.uBorderW, borderW * 0.5);
        gl.uniform1f(u.uOverlay, overlay);
        gl.uniform1f(u.uBorder, shrink);
        gl.uniform1f(u.uOpacity, 1);
        gl.uniform2f(u.uSpot, spotX, spotY);
        gl.uniform1f(u.uSpotAmt, spotAmt);
        /* AWARD-6:#1+#2 */
        gl.uniform1f(u.uBleed, (0.01 + 0.028 * shrink) / Math.max(s, 0.2));
        gl.uniform1f(u.uMatSpec, 0.08 + 0.22 * shrink);
        gl.uniform2f(u.uLight, lightX, lightY);
      } else {
        gl.useProgram(plateProg.p);
        var v = plateProg.u;
        gl.uniformMatrix4fv(v.uMVP, false, mMVP);
        gl.uniform1f(v.uAspect, aspect);
        gl.uniform1f(v.uRadius, radius);
        gl.uniform1f(v.uBorderW, borderW);
        gl.uniform1f(v.uOpacity, op);
        gl.uniform1f(v.uSheen, sheen);
        gl.uniform1i(v.uStyle, L.style);
        gl.uniform1f(v.uInset, 1 / L.grow);
        gl.uniform1f(v.uBlur, (L.id === 'pageShadow' ? 0.2 : 0.13) / L.grow);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.bindVertexArray(null);

    /* AWARD-6:#3 — drive the DOM callout from the same story clock. */
    if (window.__ttmHeroAward && window.__ttmHeroAward.syncStory) {
      window.__ttmHeroAward.syncStory({
        callout: story.callout,
        slide: curIdx,
        posT: st.posT,
        shrinkT: shrink
      });
    }
  }

  /* Everything below advances on elapsed time, not per-frame constants — this
     runs at whatever the display refreshes at (240Hz here), and the crossfade
     has to stay locked to the DOM slideshow's 1.4s CSS transition. */
  function loop(now) {
    if (!running) return;
    var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 1 / 60;
    lastT = now;
    if (mix < 1) mix = Math.min(1, mix + dt / SLIDE_FADE);
    spotAmt += ((hovered ? 1 : 0) - spotAmt) * (1 - Math.exp(-dt * 4.5));
    draw(now, dt);
    requestAnimationFrame(loop);
  }

  viewport.addEventListener('mouseenter', function () { hovered = true; });
  viewport.addEventListener('mouseleave', function () { hovered = false; });
  window.addEventListener('mousemove', function (e) {
    var r = viewport.getBoundingClientRect();
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    spotX = (e.clientX - r.left) / Math.max(1, r.width);
    spotY = 1 - (e.clientY - r.top) / Math.max(1, r.height);
  }, { passive: true });

  /* Mirror the DOM slideshow rather than duplicating its timing. */
  var mo = new MutationObserver(function () {
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].classList.contains('hero__slide--active') && i !== curIdx) {
        prevIdx = curIdx;
        curIdx = i;
        mix = 0;
        break;
      }
    }
  });
  imgs.forEach(function (img) { mo.observe(img, { attributes: true, attributeFilter: ['class'] }); });

  function setRunning(next) {
    if (next === running) return;
    running = next;
    if (running) {
      lastT = 0;
      requestAnimationFrame(loop);
    }
  }

  function setReady(next) {
    if (next === ready) return;
    ready = next;
    api.ready = next;
    viewport.classList.toggle('hero-pin__viewport--gl', next);
  }

  function evaluate() {
    var eligible = mqDesktop.matches && !reduceMotion.matches && !lost;
    setReady(eligible);
    setRunning(eligible && onScreen && !document.hidden);
  }

  /* preventDefault is what makes the context eligible for restoration; without
     it a single transient loss (GPU reset, driver update, the compositor
     reclaiming contexts) would drop us to the DOM card for the whole session. */
  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    lost = true;
    evaluate();
  });

  canvas.addEventListener('webglcontextrestored', function () {
    lost = !buildResources();
    evaluate();
  });

  new IntersectionObserver(function (entries) {
    onScreen = entries[0].isIntersecting;
    evaluate();
  }, { rootMargin: '10% 0px' }).observe(section);

  window.addEventListener('resize', evaluate, { passive: true });
  document.addEventListener('visibilitychange', evaluate);
  if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', evaluate);
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', evaluate);

  viewport.insertBefore(canvas, viewport.firstChild);
  resize();
  evaluate();
})();
