import { animateServiceArt, stopServiceArt } from '../encaixes/encaixes.mjs?v=1.0';

/**
 * DCM CRIATOR — Script Principal (One Page)
 * Comportamentos de Navegação, Menu Mobile e Interações Acessíveis
 */

document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menuToggle');
  const mobileOverlay = document.getElementById('mobileOverlay');
  const mobileClose = document.getElementById('mobileClose');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');
  const navLinks = document.querySelectorAll('.nav-link');
  const fabWhatsapp = document.getElementById('fabWhatsapp');
  const contactSection = document.getElementById('contato');

  // 1. Controle do Menu Mobile
  function openMobileMenu() {
    if (!mobileOverlay) return;
    mobileOverlay.classList.add('is-active');
    document.body.style.overflow = 'hidden';
    menuToggle?.setAttribute('aria-expanded', 'true');
    mobileClose?.focus();
  }

  function closeMobileMenu() {
    if (!mobileOverlay) return;
    mobileOverlay.classList.remove('is-active');
    document.body.style.overflow = '';
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.focus();
  }

  menuToggle?.addEventListener('click', openMobileMenu);
  mobileClose?.addEventListener('click', closeMobileMenu);

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMobileMenu();
    });
  });

  // Fechar com tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileOverlay?.classList.contains('is-active')) {
      closeMobileMenu();
    }
  });

  // 2. Destacar link ativo conforme a rolagem (IntersectionObserver)
  const sections = document.querySelectorAll('section[id], header[id]');
  const observerOptions = {
    root: null,
    rootMargin: '-20% 0px -70% 0px',
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));

  // 3. WhatsApp flutuante: preserve o espaço dos controles da página.
  const fabControls = [...document.querySelectorAll('main a[href], main button, main summary, .site-footer a[href]')];
  let fabUpdate = 0;

  function updateFabVisibility() {
    if (!fabWhatsapp) return;

    const scrollY = window.scrollY;
    const shouldShow = scrollY > 350;

    let inContact = false;
    if (contactSection) {
      const contactRect = contactSection.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      inContact = contactRect.top < windowHeight && contactRect.bottom > 150;
    }

    // Measure its fixed slot, independent of the show/hide transform. This
    // prevents a visibility change from changing the collision result.
    const style = getComputedStyle(fabWhatsapp);
    const right = document.documentElement.clientWidth - parseFloat(style.right);
    const bottom = window.innerHeight - parseFloat(style.bottom);
    const left = right - fabWhatsapp.offsetWidth;
    const top = bottom - fabWhatsapp.offsetHeight;
    const clearance = 8;
    const obstructed = shouldShow && !inContact && fabControls.some(control => {
      const rect = control.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 &&
        rect.left < right + clearance && rect.right > left - clearance &&
        rect.top < bottom + clearance && rect.bottom > top - clearance &&
        getComputedStyle(control).visibility !== 'hidden';
    });
    fabWhatsapp.classList.toggle('is-obstructed', obstructed);
    fabWhatsapp.classList.toggle('is-visible', shouldShow && !inContact && !obstructed);
  }

  function queueFabVisibility() {
    if (fabUpdate) return;
    fabUpdate = requestAnimationFrame(() => {
      fabUpdate = 0;
      updateFabVisibility();
    });
  }
  window.addEventListener('scroll', queueFabVisibility, { passive: true });
  window.addEventListener('resize', queueFabVisibility, { passive: true });
  document.addEventListener('toggle', queueFabVisibility, true);
  const pageContent = document.querySelector('main');
  if (fabWhatsapp && pageContent) new ResizeObserver(queueFabVisibility).observe(pageContent);
  queueFabVisibility();

  // 4. Detalhamento dos Serviços (Saiba mais / Fechar detalhes)
  const toggleButtons = document.querySelectorAll('.btn-toggle-detail');
  const closeButtons = document.querySelectorAll('.btn-close-detail');

  const artObservers = new WeakMap();
  function stopPanelArt(panel) {
    const frame = panel.querySelector('.dcm-encaixe');
    if (!frame) return;
    artObservers.get(frame)?.disconnect();
    artObservers.delete(frame);
    stopServiceArt(frame);
  }

  function startPanelArt(panel) {
    const frame = panel.querySelector('.dcm-encaixe');
    if (!frame) return;
    stopPanelArt(panel);
    // Wait for the artwork to enter the viewport during the existing scroll.
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      observer.disconnect();
      artObservers.delete(frame);
      if (!panel.hidden) animateServiceArt(frame);
    }, { threshold: [0, 0.5] });
    artObservers.set(frame, observer);
    observer.observe(frame);
  }

  function toggleServiceDetail(btn) {
    const targetId = btn.getAttribute('aria-controls') || btn.getAttribute('data-target');
    const panel = document.getElementById(targetId);
    if (!panel) return;

    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    const willOpen = !isExpanded;

    if (willOpen) {
      panel.removeAttribute('hidden');
      panel.classList.add('is-open');
      startPanelArt(panel);
      btn.setAttribute('aria-expanded', 'true');
      btn.classList.add('is-active');
      const label = btn.querySelector('.btn-toggle-label');
      const arrow = btn.querySelector('.btn-toggle-arrow');
      if (label) label.textContent = 'Fechar detalhes';
      if (arrow) arrow.textContent = '↑';

      // Rolar suavemente até o detalhamento aberto se estiver fora da tela
      setTimeout(() => {
        const rect = panel.getBoundingClientRect();
        if (rect.top < 100 || rect.bottom > window.innerHeight) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    } else {
      stopPanelArt(panel);
      panel.setAttribute('hidden', '');
      panel.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.remove('is-active');
      const label = btn.querySelector('.btn-toggle-label');
      const arrow = btn.querySelector('.btn-toggle-arrow');
      if (label) label.textContent = 'Saiba mais';
      if (arrow) arrow.textContent = '↓';
    }
    queueFabVisibility();
  }

  toggleButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleServiceDetail(btn);
    });
  });

  closeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-target');
      const triggerBtn = document.querySelector(`.btn-toggle-detail[aria-controls="${targetId}"]`);
      if (triggerBtn) {
        toggleServiceDetail(triggerBtn);
        triggerBtn.focus();
      }
    });
  });
});

