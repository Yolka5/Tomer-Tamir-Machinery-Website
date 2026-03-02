(function() {
  'use strict';

  const form = document.getElementById('application-form');
  const positionSelect = document.getElementById('position');
  const otherPositionGroup = document.getElementById('other-position-group');
  const formSuccess = document.getElementById('form-success');
  const yearEl = document.getElementById('year');

  // Show/hide "Other position" field
  if (positionSelect && otherPositionGroup) {
    positionSelect.addEventListener('change', function() {
      if (this.value === 'other') {
        otherPositionGroup.style.display = 'block';
        document.getElementById('other-position').setAttribute('required', 'required');
      } else {
        otherPositionGroup.style.display = 'none';
        document.getElementById('other-position').removeAttribute('required');
      }
    });
  }

  // Form submission handling
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Validate form
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // Show loading state
      form.classList.add('form-submitting');
      
      // Collect form data
      const formData = new FormData(form);
      const data = {};
      
      // Convert FormData to object
      for (let [key, value] of formData.entries()) {
        if (data[key]) {
          // Handle multiple values (checkboxes)
          if (Array.isArray(data[key])) {
            data[key].push(value);
          } else {
            data[key] = [data[key], value];
          }
        } else {
          data[key] = value;
        }
      }

      // Format email body
      let emailBody = 'TTM Job Application\n\n';
      emailBody += '=== PERSONAL INFORMATION ===\n';
      emailBody += `Name: ${data['first-name']} ${data['last-name']}\n`;
      emailBody += `Email: ${data.email}\n`;
      emailBody += `Phone: ${data.phone}\n`;
      if (data.location) emailBody += `Location: ${data.location}\n`;
      
      emailBody += '\n=== POSITION INFORMATION ===\n';
      emailBody += `Position: ${data.position}\n`;
      if (data['other-position']) emailBody += `Other Position: ${data['other-position']}\n`;
      emailBody += `Availability: ${data.availability}\n`;
      
      emailBody += '\n=== EXPERIENCE & SKILLS ===\n';
      emailBody += `Years of Experience: ${data.experience}\n`;
      if (data['cad-software']) {
        const cadSoftware = Array.isArray(data['cad-software']) ? data['cad-software'].join(', ') : data['cad-software'];
        emailBody += `CAD Software: ${cadSoftware}\n`;
      }
      if (data['cnc-experience']) emailBody += `CNC Experience: ${data['cnc-experience']}\n`;
      if (data.programming) {
        const programming = Array.isArray(data.programming) ? data.programming.join(', ') : data.programming;
        emailBody += `Programming Languages: ${programming}\n`;
      }
      if (data['relevant-skills']) emailBody += `Other Skills: ${data['relevant-skills']}\n`;
      
      emailBody += '\n=== WORK HISTORY ===\n';
      if (data['current-company']) emailBody += `Current Company: ${data['current-company']}\n`;
      if (data['current-role']) emailBody += `Current Role: ${data['current-role']}\n`;
      if (data['work-experience']) emailBody += `Experience Summary:\n${data['work-experience']}\n`;
      
      emailBody += '\n=== EDUCATION ===\n';
      if (data['education-level']) emailBody += `Education Level: ${data['education-level']}\n`;
      if (data['degree-field']) emailBody += `Field of Study: ${data['degree-field']}\n`;
      if (data.university) emailBody += `University: ${data.university}\n`;
      
      emailBody += '\n=== WHY TTM ===\n';
      if (data['why-ttm']) emailBody += `Why TTM:\n${data['why-ttm']}\n`;
      if (data['projects-interest']) {
        const projects = Array.isArray(data['projects-interest']) ? data['projects-interest'].join(', ') : data['projects-interest'];
        emailBody += `Projects of Interest: ${projects}\n`;
      }
      
      emailBody += '\n=== ADDITIONAL INFORMATION ===\n';
      if (data.portfolio) emailBody += `Portfolio: ${data.portfolio}\n`;
      if (data.linkedin) emailBody += `LinkedIn: ${data.linkedin}\n`;
      if (data.resume && data.resume.name) emailBody += `Resume File: ${data.resume.name}\n`;
      if (data['additional-info']) emailBody += `Additional Info:\n${data['additional-info']}\n`;

      // Create mailto link
      const subject = encodeURIComponent(`Job Application: ${data.position || 'Position Application'}`);
      const body = encodeURIComponent(emailBody);
      const email = 'tomertamirmachinery@gmail.com';
      
      // For file attachments, we'll need to use a different approach
      // Since mailto doesn't support attachments, we'll note it in the email
      if (data.resume && data.resume.name) {
        const resumeNote = '\n\nNOTE: Resume file was selected but cannot be attached via email. Please request the candidate to send it separately or use a form service that supports file uploads.';
        const mailtoLink = `mailto:${email}?subject=${subject}&body=${body}${encodeURIComponent(resumeNote)}`;
        window.location.href = mailtoLink;
      } else {
        const mailtoLink = `mailto:${email}?subject=${subject}&body=${body}`;
        window.location.href = mailtoLink;
      }

      // Show success message after a delay
      setTimeout(function() {
        form.classList.remove('form-submitting');
        formSuccess.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
        
        // Scroll to success message
        formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    });
  }

  // Close success message
  formSuccess.addEventListener('click', function(e) {
    if (e.target === formSuccess) {
      formSuccess.setAttribute('hidden', '');
      document.body.style.overflow = '';
      form.reset();
    }
  });

  // Footer year
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Initialize scroll animations
  const animateEls = document.querySelectorAll('.animate-in');
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -80px 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, observerOptions);

  animateEls.forEach(function(el) {
    observer.observe(el);
  });

})();
