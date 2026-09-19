(function (w) {
  'use strict';

  var KEY = 'ttmBeaverBuild';
  var PRICE = { rifle: 5000, box: 100, integral: 950 };

  var BARRELS = {
    '10': { label: '10 in', note: 'CQB', full: '10 in barrel' },
    '13.7': { label: '13.7 in', note: 'Standard', full: '13.7 in barrel' },
    '16.1': { label: '16.1 in', note: 'Rifle', full: '16.1 in barrel' }
  };

  var VIEWS = {
    '1': {
      src: 'TTM%20Beaver/New%20Photos/TTM%20Beaver1.png',
      alt: 'TTM Beaver profile',
      caption: 'Profile'
    },
    '2': {
      src: 'TTM%20Beaver/New%20Photos/TTM%20Beaver2.png',
      alt: 'TTM Beaver opposite side',
      caption: 'Opposite side'
    },
    '3': {
      src: 'TTM%20Beaver/New%20Photos/TTM%20Beaver%20Exploded.png',
      alt: 'TTM Beaver exploded view',
      caption: 'Exploded view'
    },
    '4': {
      src: 'TTM%20Beaver/New%20Photos/TTM%20Beaver%20Gas%20System.png',
      alt: 'TTM Beaver gas system',
      caption: 'Gas system'
    }
  };

  function usd(n) {
    return '$' + Number(n).toLocaleString('en-US');
  }

  function normalize(raw) {
    raw = raw || {};
    var barrel = BARRELS[raw.barrel] ? String(raw.barrel) : '13.7';
    return {
      barrel: barrel,
      integral: barrel === '10' && !!raw.integral,
      box: !!raw.box,
      view: VIEWS[raw.view] ? String(raw.view) : '1'
    };
  }

  function parseQuery() {
    var q = new URLSearchParams(w.location.search);
    if (!q.has('barrel') && !q.has('integral') && !q.has('view') && !q.has('box')) {
      return null;
    }
    return {
      barrel: q.get('barrel'),
      integral: q.get('integral') === '1',
      box: q.get('box') === '1',
      view: q.get('view')
    };
  }

  function load() {
    var fromQuery = parseQuery();
    if (fromQuery) return normalize(fromQuery);
    try {
      return normalize(JSON.parse(sessionStorage.getItem(KEY) || '{}'));
    } catch (err) {
      return normalize({});
    }
  }

  function save(state) {
    state = normalize(state);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) { /* ignore quota / private mode */ }
    return state;
  }

  function checkoutUrl(state) {
    state = normalize(state);
    var q = new URLSearchParams();
    q.set('barrel', state.barrel);
    if (state.integral) q.set('integral', '1');
    if (state.box) q.set('box', '1');
    if (state.view !== '1') q.set('view', state.view);
    return 'beaver-checkout.html?' + q.toString();
  }

  function total(state) {
    state = normalize(state);
    return PRICE.rifle + (state.box ? PRICE.box : 0) + (state.integral ? PRICE.integral : 0);
  }

  function lines(state) {
    state = normalize(state);
    var rows = [
      { k: 'Platform', v: 'TTM Beaver' },
      { k: 'Barrel', v: BARRELS[state.barrel].full }
    ];
    if (state.integral) {
      rows.push({ k: 'Integral suppressor', v: usd(PRICE.integral) });
    }
    rows.push({ k: 'Rifle', v: usd(PRICE.rifle) });
    if (state.box) {
      rows.push({ k: 'TTM Mystery Box', v: usd(PRICE.box) });
    }
    return rows;
  }

  function renderSheet(el, state, withTotal) {
    if (!el) return;
    state = normalize(state);
    var html = lines(state).map(function (row) {
      return '<dt>' + row.k + '</dt><dd>' + row.v + '</dd>';
    }).join('');
    if (withTotal) {
      html += '<dt>Total</dt><dd>' + usd(total(state)) + '</dd>';
    }
    el.innerHTML = html;
  }

  w.TTMShop = {
    BARRELS: BARRELS,
    VIEWS: VIEWS,
    PRICE: PRICE,
    usd: usd,
    total: total,
    normalize: normalize,
    load: load,
    save: save,
    checkoutUrl: checkoutUrl,
    lines: lines,
    renderSheet: renderSheet
  };
})(window);
