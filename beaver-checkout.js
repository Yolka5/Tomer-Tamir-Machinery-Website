(function () {
  'use strict';

  var shop = window.TTMShop;
  if (!shop) return;

  var state = shop.save(shop.load());

  var sheet = document.getElementById('check-sheet');
  var form = document.getElementById('check-form');
  var hold = document.getElementById('check-hold');
  var edit = document.getElementById('check-edit');
  var submitBtn = document.getElementById('check-submit');

  shop.renderSheet(sheet, state, true);
  if (edit) edit.setAttribute('href', 'beaver-order.html#build');

  var numberEl = document.getElementById('check-cc-number');
  var holderEl = document.getElementById('check-cc-holder');
  var monthEl = document.getElementById('check-cc-month');
  var yearEl = document.getElementById('check-cc-year');
  var cvvEl = document.getElementById('check-cc-cvv');
  var nameEl = document.getElementById('check-name');
  var cardEl = document.getElementById('ccp-card');
  var highlightEl = document.getElementById('ccp-highlight');
  var slotsRoot = document.getElementById('ccp-number');
  var holderDisplay = document.getElementById('ccp-holder');
  var monthDisplay = document.getElementById('ccp-month');
  var yearDisplay = document.getElementById('ccp-year');
  var cvvDisplay = document.getElementById('ccp-cvv');
  var numberErr = document.getElementById('check-cc-number-err');
  var maskMiddle = true;
  var holderDirty = false;

  var card = {
    number: '',
    holder: '',
    month: '',
    year: '',
    cvv: ''
  };

  function clampDigits(value, maxLen) {
    return String(value || '').replace(/\D/g, '').slice(0, maxLen);
  }

  function formatNumberSpaces(num) {
    return clampDigits(num, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function luhn(num) {
    if (num.length < 13 || num.length > 19) return false;
    var sum = 0;
    var alt = false;
    for (var i = num.length - 1; i >= 0; i--) {
      var n = num.charCodeAt(i) - 48;
      if (n < 0 || n > 9) return false;
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function fillYears() {
    if (!yearEl) return;
    var start = new Date().getFullYear();
    var html = '<option value="" disabled selected>Year</option>';
    for (var i = 0; i < 10; i++) {
      var y = String(start + i);
      html += '<option value="' + y + '">' + y + '</option>';
    }
    yearEl.innerHTML = html;
  }

  function buildSlots() {
    if (!slotsRoot) return;
    var html = '';
    for (var i = 0; i < 16; i++) {
      html += '<span class="ccp-slot"><span class="ccp-digit">' +
        '<span class="ccp-row ccp-placeholder">#</span>' +
        '<span class="ccp-row ccp-value">#</span></span></span>';
    }
    slotsRoot.innerHTML = html;
  }

  function validity() {
    var numberValid = luhn(card.number);
    var holderValid = card.holder.trim().length >= 2;
    var monthValid = !!card.month && +card.month >= 1 && +card.month <= 12;
    var yearValid = !!card.year && +card.year >= new Date().getFullYear();
    var cvvValid = /^\d{3,4}$/.test(card.cvv);
    return {
      number: numberValid,
      holder: holderValid,
      month: monthValid,
      year: yearValid,
      cvv: cvvValid,
      allValid: numberValid && holderValid && monthValid && yearValid && cvvValid
    };
  }

  function setFocus(field) {
    if (!cardEl || !highlightEl) return;
    cardEl.classList.toggle('is-flip', field === 'cvv');
    highlightEl.className = 'ccp-highlight' + (field ? ' is-' + field : ' is-off');
  }

  function paint() {
    var v = validity();
    var digits = card.number.slice(0, 16).split('');
    if (slotsRoot) {
      var slots = slotsRoot.querySelectorAll('.ccp-slot');
      for (var i = 0; i < slots.length; i++) {
        var digitEl = slots[i].querySelector('.ccp-digit');
        var valueEl = slots[i].querySelector('.ccp-value');
        var filed = i < digits.length;
        digitEl.classList.toggle('is-filed', filed);
        valueEl.textContent = filed
          ? (maskMiddle && i >= 4 && i <= 11 ? '*' : digits[i])
          : '#';
      }
    }
    if (holderDisplay) holderDisplay.textContent = card.holder || 'NAME ON CARD';
    if (monthDisplay) monthDisplay.textContent = card.month || 'MM';
    if (yearDisplay) yearDisplay.textContent = card.year ? card.year.slice(-2) : 'YY';
    if (cvvDisplay) cvvDisplay.textContent = card.cvv ? '*'.repeat(card.cvv.length) : '';

    if (numberEl) numberEl.setAttribute('aria-invalid', v.number ? 'false' : 'true');
    if (holderEl) holderEl.setAttribute('aria-invalid', v.holder ? 'false' : 'true');
    if (monthEl) monthEl.setAttribute('aria-invalid', v.month ? 'false' : 'true');
    if (yearEl) yearEl.setAttribute('aria-invalid', v.year ? 'false' : 'true');
    if (cvvEl) cvvEl.setAttribute('aria-invalid', v.cvv ? 'false' : 'true');

    if (numberErr) {
      numberErr.classList.toggle('is-on', card.number.length >= 13 && !v.number);
    }

    if (submitBtn) {
      submitBtn.disabled = !v.allValid;
      submitBtn.setAttribute('aria-disabled', v.allValid ? 'false' : 'true');
      submitBtn.textContent = v.allValid ? 'Place an order' : 'Complete all fields';
    }
  }

  fillYears();
  buildSlots();
  paint();

  if (numberEl) {
    numberEl.addEventListener('input', function () {
      card.number = clampDigits(numberEl.value, 19);
      numberEl.value = formatNumberSpaces(card.number);
      paint();
    });
    numberEl.addEventListener('focus', function () { setFocus('number'); });
    numberEl.addEventListener('blur', function () { setFocus(null); });
  }

  if (holderEl) {
    holderEl.addEventListener('input', function () {
      holderDirty = true;
      card.holder = holderEl.value.toUpperCase();
      holderEl.value = card.holder;
      paint();
    });
    holderEl.addEventListener('focus', function () { setFocus('holder'); });
    holderEl.addEventListener('blur', function () { setFocus(null); });
  }

  if (monthEl) {
    monthEl.addEventListener('change', function () {
      card.month = monthEl.value;
      paint();
    });
    monthEl.addEventListener('focus', function () { setFocus('expire'); });
    monthEl.addEventListener('blur', function () { setFocus(null); });
  }

  if (yearEl) {
    yearEl.addEventListener('change', function () {
      card.year = yearEl.value;
      paint();
    });
    yearEl.addEventListener('focus', function () { setFocus('expire'); });
    yearEl.addEventListener('blur', function () { setFocus(null); });
  }

  if (cvvEl) {
    cvvEl.addEventListener('input', function () {
      card.cvv = clampDigits(cvvEl.value, 4);
      cvvEl.value = card.cvv;
      paint();
    });
    cvvEl.addEventListener('focus', function () { setFocus('cvv'); });
    cvvEl.addEventListener('blur', function () { setFocus(null); });
  }

  if (nameEl) {
    nameEl.addEventListener('input', function () {
      if (holderDirty || !holderEl) return;
      card.holder = nameEl.value.toUpperCase();
      holderEl.value = card.holder;
      paint();
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setFocus(null);
      if (hold) {
        hold.classList.add('is-on');
        hold.textContent = 'Orders are not open yet. This form does not submit.';
      }
      return false;
    });
  }
})();
