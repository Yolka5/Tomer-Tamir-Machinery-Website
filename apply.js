(function () {
  'use strict';

  var FORM_EMAIL = 'tomertamirmachinery@gmail.com';
  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/' + FORM_EMAIL;

  var form = document.getElementById('application-form');
  var positionSelect = document.getElementById('position');
  var otherPositionGroup = document.getElementById('other-position-group');
  var formSuccess = document.getElementById('form-success');
  var formError = document.getElementById('form-error');
  var yearEl = document.getElementById('year');

  if (formSuccess) {
    formSuccess.hidden = true;
  }

  function getCheckedValues(name) {
    return Array.from(form.querySelectorAll('[name="' + name + '"]:checked'))
      .map(function (el) { return el.value; })
      .join(', ');
  }

  function showError(message) {
    if (!formError) return;
    formError.textContent = message;
    formError.hidden = false;
    formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    if (formError) formError.hidden = true;
  }

  if (positionSelect && otherPositionGroup) {
    positionSelect.addEventListener('change', function () {
      var showOther = this.value === 'other';
      otherPositionGroup.style.display = showOther ? 'block' : 'none';
      var otherInput = document.getElementById('other-position');
      if (otherInput) {
        if (showOther) otherInput.setAttribute('required', 'required');
        else otherInput.removeAttribute('required');
      }
    });
  }

  var params = new URLSearchParams(window.location.search);
  if (positionSelect && params.get('position')) {
    var requested = params.get('position');
    var option = positionSelect.querySelector('option[value="' + requested + '"]');
    if (option) {
      positionSelect.value = requested;
      positionSelect.dispatchEvent(new Event('change'));
    }
  }

  var programParam = params.get('program');
  if (programParam === 'beaver') {
    var beaverBox = form && form.querySelector('input[name="projects-interest"][value="beaver"]');
    if (beaverBox) beaverBox.checked = true;
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideError();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var resumeInput = document.getElementById('resume');
      if (resumeInput && resumeInput.files[0] && resumeInput.files[0].size > 5 * 1024 * 1024) {
        showError('Resume must be 5MB or smaller.');
        return;
      }

      form.classList.add('form-submitting');

      var positionLabel = positionSelect.options[positionSelect.selectedIndex].text;
      var payload = new FormData();

      payload.append('_subject', 'TTM Job Application — ' + positionLabel);
      payload.append('_template', 'table');
      payload.append('_captcha', 'false');
      payload.append('First Name', form.querySelector('#first-name').value);
      payload.append('Last Name', form.querySelector('#last-name').value);
      payload.append('Email', form.querySelector('#email').value);
      payload.append('Phone', form.querySelector('#phone').value);
      payload.append('Location', form.querySelector('#location').value || '—');
      payload.append('Position', positionLabel);
      payload.append('Position ID', positionSelect.value);
      if (form.querySelector('#other-position').value) {
        payload.append('Other Position', form.querySelector('#other-position').value);
      }
      payload.append('Availability', form.querySelector('#availability').value);
      payload.append('Years of Experience', form.querySelector('#experience').value);
      payload.append('CAD Software', getCheckedValues('cad-software') || '—');
      payload.append('CNC Experience', form.querySelector('#cnc-experience').value || '—');
      payload.append('Programming', getCheckedValues('programming') || '—');
      payload.append('Other Skills', form.querySelector('#relevant-skills').value || '—');
      payload.append('Current Company', form.querySelector('#current-company').value || '—');
      payload.append('Current Role', form.querySelector('#current-role').value || '—');
      payload.append('Work Experience', form.querySelector('#work-experience').value);
      payload.append('Education Level', form.querySelector('#education-level').value || '—');
      payload.append('Field of Study', form.querySelector('#degree-field').value || '—');
      payload.append('University', form.querySelector('#university').value || '—');
      payload.append('Why TTM', form.querySelector('#why-ttm').value);
      payload.append('Projects of Interest', getCheckedValues('projects-interest') || '—');
      payload.append('Portfolio URL', form.querySelector('#portfolio').value || '—');
      payload.append('LinkedIn', form.querySelector('#linkedin').value || '—');
      payload.append('Additional Info', form.querySelector('#additional-info').value || '—');

      if (resumeInput && resumeInput.files[0]) {
        payload.append('attachment', resumeInput.files[0]);
      }

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: payload
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Submission failed');
          return res.json();
        })
        .then(function () {
          form.classList.remove('form-submitting');
          form.reset();
          if (otherPositionGroup) otherPositionGroup.style.display = 'none';
          formSuccess.hidden = false;
          document.body.style.overflow = 'hidden';
          formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
        })
        .catch(function () {
          form.classList.remove('form-submitting');
          showError('Something went wrong sending your application. Please try again or email tomertamirmachinery@gmail.com directly.');
        });
    });
  }

  if (formSuccess) {
    function closeSuccess() {
      formSuccess.hidden = true;
      document.body.style.overflow = '';
    }

    formSuccess.addEventListener('click', function (e) {
      if (e.target === formSuccess) closeSuccess();
    });

    var closeBtn = document.getElementById('form-success-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSuccess);
  }

  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
