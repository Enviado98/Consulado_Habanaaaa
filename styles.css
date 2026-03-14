/* ══════════════════════════════════════
   MANO IOANNINA — script.js
   ══════════════════════════════════════ */

'use strict';

/* ─── HEADER: scroll state ─── */
const header = document.getElementById('header');

function updateHeader() {
  if (window.scrollY > 40) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}

window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();


/* ─── MOBILE MENU ─── */
const hamburger = document.getElementById('hamburger');
const navMobile  = document.getElementById('nav-mobile');

hamburger.addEventListener('click', () => {
  const isOpen = navMobile.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
});

// Close mobile menu when a link is clicked
document.querySelectorAll('.mobile-link').forEach(link => {
  link.addEventListener('click', () => {
    navMobile.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-label', 'Abrir menú');
  });
});

// Close mobile menu on outside click
document.addEventListener('click', (e) => {
  if (navMobile.classList.contains('open') &&
      !navMobile.contains(e.target) &&
      !hamburger.contains(e.target)) {
    navMobile.classList.remove('open');
    hamburger.classList.remove('open');
  }
});


/* ─── SCROLL REVEAL ─── */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));


/* ─── SERVICE TABS ─── */
const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.service-panel');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;

    // Update buttons
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update panels
    tabPanels.forEach(panel => {
      panel.classList.remove('active');
      if (panel.id === `tab-${target}`) {
        panel.classList.add('active');
      }
    });
  });
});


/* ─── SMOOTH SCROLL ─── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;

    const targetEl = document.querySelector(targetId);
    if (!targetEl) return;

    e.preventDefault();

    const headerHeight = header.offsetHeight;
    const targetTop = targetEl.getBoundingClientRect().top + window.scrollY - headerHeight;

    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  });
});


/* ─── ACTIVE NAV LINK on scroll ─── */
const sections  = document.querySelectorAll('section[id], div[id]');
const navLinks  = document.querySelectorAll('.nav-desktop a[href^="#"]');

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('active-link', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  },
  { threshold: 0.35 }
);

sections.forEach(s => sectionObserver.observe(s));


/* ─── CONTACT FORM VALIDATION ─── */
const form        = document.getElementById('contact-form');
const formSuccess = document.getElementById('form-success');

function showError(fieldId, message) {
  const errEl = document.getElementById(`error-${fieldId}`);
  const input = document.getElementById(fieldId);
  if (errEl) errEl.textContent = message;
  if (input) input.style.borderColor = '#c0392b';
}

function clearError(fieldId) {
  const errEl = document.getElementById(`error-${fieldId}`);
  const input = document.getElementById(fieldId);
  if (errEl) errEl.textContent = '';
  if (input) input.style.borderColor = '';
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Live validation
document.getElementById('nombre')?.addEventListener('input', function () {
  if (this.value.trim().length > 0) clearError('nombre');
});
document.getElementById('email')?.addEventListener('input', function () {
  if (validateEmail(this.value.trim())) clearError('email');
});

form?.addEventListener('submit', function (e) {
  e.preventDefault();

  const nombre  = document.getElementById('nombre').value.trim();
  const email   = document.getElementById('email').value.trim();

  let valid = true;

  if (!nombre) {
    showError('nombre', 'Por favor, ingresa tu nombre.');
    valid = false;
  } else {
    clearError('nombre');
  }

  if (!email || !validateEmail(email)) {
    showError('email', 'Por favor, ingresa un email válido.');
    valid = false;
  } else {
    clearError('email');
  }

  if (!valid) return;

  // Simulate form submission
  const submitBtn = form.querySelector('.btn-submit');
  submitBtn.textContent = 'Enviando…';
  submitBtn.disabled = true;

  setTimeout(() => {
    form.reset();
    formSuccess.classList.add('visible');
    submitBtn.textContent = 'Enviar mensaje';
    submitBtn.disabled = false;

    setTimeout(() => {
      formSuccess.classList.remove('visible');
    }, 5000);
  }, 1200);
});


/* ─── HERO PARALLAX (subtle) ─── */
const heroBg = document.querySelector('.hero-bg');

if (heroBg) {
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    if (scrolled < window.innerHeight) {
      heroBg.style.transform = `translateY(${scrolled * 0.25}px)`;
    }
  }, { passive: true });
}


/* ─── GALLERY: lightbox ─── */
const galleryItems = document.querySelectorAll('.gallery-item');

// Create lightbox elements
const lightbox = document.createElement('div');
lightbox.id = 'lightbox';
lightbox.style.cssText = `
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(28,23,20,0.95);
  z-index: 999;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
`;

const lightboxImg = document.createElement('img');
lightboxImg.style.cssText = `
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 2px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
`;

const lightboxClose = document.createElement('button');
lightboxClose.innerHTML = '&times;';
lightboxClose.style.cssText = `
  position: absolute;
  top: 1.5rem;
  right: 2rem;
  background: none;
  border: none;
  color: rgba(250,246,240,0.7);
  font-size: 2.5rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: color 0.2s;
`;
lightboxClose.addEventListener('mouseenter', () => lightboxClose.style.color = '#B8935A');
lightboxClose.addEventListener('mouseleave', () => lightboxClose.style.color = 'rgba(250,246,240,0.7)');

lightbox.appendChild(lightboxImg);
lightbox.appendChild(lightboxClose);
document.body.appendChild(lightbox);

function openLightbox(src, alt) {
  lightboxImg.src = src;
  lightboxImg.alt = alt || '';
  lightbox.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.style.display = 'none';
  document.body.style.overflow = '';
}

galleryItems.forEach(item => {
  item.addEventListener('click', () => {
    const img = item.querySelector('img');
    if (img) openLightbox(img.src, img.alt);
  });
});

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
lightboxClose.addEventListener('click', closeLightbox);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});
