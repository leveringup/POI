(() => {
  const root = document.documentElement;
  const themePicker = document.getElementById('themePicker');
  const motionToggle = document.getElementById('motionToggle');
  const filterToggle = document.getElementById('filterToggle');
  const progress = document.querySelector('.reading-progress i');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tiltSelector = '.poi-story-visual, #evidence .evidence-card, #summary .chart-card, #overview .overview-background-grid article, #overview .overview-shortcut';

  function updateCharts(theme) {
    if (!window.Chart) return;

    const palette = theme === 'minimal'
      ? { text: '#30483a', grid: '#d5ded5', doughnutBorder: '#ffffff' }
      : { text: '#d5deed', grid: '#34425b', doughnutBorder: '#111a2a' };
    Chart.defaults.color = palette.text;
    Chart.defaults.borderColor = palette.grid;

    Object.values(Chart.instances || {}).forEach(chart => {
      chart.options.color = palette.text;
      Object.values(chart.options.scales || {}).forEach(axis => {
        axis.ticks = { ...axis.ticks, color: palette.text };
        if (axis.grid) axis.grid.color = palette.grid;
      });
      const legend = chart.options.plugins?.legend?.labels;
      if (legend) legend.color = palette.text;
      if (chart.canvas.id === 'sourceChart') {
        chart.data.datasets.forEach(dataset => { dataset.borderColor = palette.doughnutBorder; });
      }
      chart.update('none');
    });
  }

  function applyTheme(value, remember = false) {
    const theme = value === 'minimal' ? 'minimal' : 'night';
    root.dataset.theme = theme;
    if (themePicker) themePicker.value = theme;
    if (remember) {
      try {
        localStorage.setItem('poi-theme', theme);
      } catch (error) {
        console.warn('บันทึกธีมที่เลือกไว้ไม่ได้ เบราว์เซอร์อาจปิดกั้น local storage', error);
      }
    }
    updateCharts(theme);
    document.dispatchEvent(new CustomEvent('poi-theme-change', { detail: { theme } }));
  }

  function setMotionPaused(paused) {
    document.body.classList.toggle('effects-paused', paused);
    motionToggle.setAttribute('aria-pressed', String(paused));
    motionToggle.setAttribute('aria-label', paused ? 'เล่นลูกเล่นเคลื่อนไหว' : 'พักลูกเล่นเคลื่อนไหว');
    motionToggle.querySelector('.motion-toggle-label').textContent = paused ? 'เล่นลูกเล่น' : 'พักลูกเล่น';
    motionToggle.querySelector('[aria-hidden="true"]').textContent = paused ? '▶' : 'Ⅱ';
    document.querySelectorAll('.is-tilting').forEach(resetTilt);
    document.querySelectorAll('#overview .overview-hero').forEach(resetHeroTilt);
    document.dispatchEvent(new CustomEvent('poi-motion-change', { detail: { paused } }));
  }

  function activeMapPage() {
    return document.querySelector('.map-page.active');
  }

  function updateFilterControl() {
    const mapPage = activeMapPage();
    filterToggle.hidden = !mapPage;
    if (!mapPage) return;
    const expanded = !mapPage.classList.contains('filters-hidden');
    filterToggle.setAttribute('aria-expanded', String(expanded));
    filterToggle.textContent = expanded ? 'ซ่อนตัวกรอง' : 'แสดงตัวกรอง';
  }

  function resetTilt(card) {
    card.classList.remove('is-tilting');
    card.style.removeProperty('--poi-tilt-x');
    card.style.removeProperty('--poi-tilt-y');
  }

  function resetHeroTilt(hero) {
    const media = hero.querySelector('.overview-hero-media');
    if (!media) return;
    media.style.removeProperty('--overview-parallax-image-x');
    media.style.removeProperty('--overview-mouse-y');
    media.style.removeProperty('--overview-mouse-rotate-x');
    media.style.removeProperty('--overview-mouse-rotate-y');
  }

  function updateProgress() {
    if (!progress) return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const amount = maxScroll > 0 ? Math.min(100, (window.scrollY / maxScroll) * 100) : 0;
    progress.style.width = `${amount}%`;
  }

  themePicker?.addEventListener('change', () => applyTheme(themePicker.value, true));
  motionToggle?.addEventListener('click', () => {
    setMotionPaused(!document.body.classList.contains('effects-paused'));
  });
  filterToggle?.addEventListener('click', () => {
    const mapPage = activeMapPage();
    if (!mapPage) return;
    mapPage.classList.toggle('filters-hidden');
    updateFilterControl();
    window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  });

  document.querySelectorAll('[data-gallery-mode]').forEach(button => {
    button.addEventListener('click', () => {
      const compact = button.dataset.galleryMode === 'compact';
      document.querySelectorAll('[data-gallery-mode]').forEach(modeButton => {
        const selected = modeButton === button;
        modeButton.classList.toggle('active', selected);
        modeButton.setAttribute('aria-pressed', String(selected));
      });
      document.getElementById('evidenceList').classList.toggle('compact', compact);
    });
  });

  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || reducedMotion.matches || document.body.classList.contains('effects-paused')) return;
    const hero = event.target.closest('#overview .overview-hero');
    if (hero) {
      const bounds = hero.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      const media = hero.querySelector('.overview-hero-media');
      media.style.setProperty('--overview-parallax-image-x', `${x * -7}px`);
      media.style.setProperty('--overview-mouse-y', `${y * -7}px`);
      media.style.setProperty('--overview-mouse-rotate-x', `${y * 0.35}deg`);
      media.style.setProperty('--overview-mouse-rotate-y', `${x * -0.35}deg`);
    }
    const card = event.target.closest(tiltSelector);
    if (!card || card.getClientRects().length === 0) return;

    const bounds = card.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    card.style.setProperty('--poi-tilt-x', `${x * 4}deg`);
    card.style.setProperty('--poi-tilt-y', `${y * -4}deg`);
    card.classList.add('is-tilting');
  });

  document.addEventListener('pointerout', event => {
    const hero = event.target.closest('#overview .overview-hero');
    if (hero && (!event.relatedTarget || !hero.contains(event.relatedTarget))) resetHeroTilt(hero);
    const card = event.target.closest(tiltSelector);
    if (!card || (event.relatedTarget && card.contains(event.relatedTarget))) return;
    resetTilt(card);
  });

  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  const pageObserver = new MutationObserver(updateFilterControl);
  document.querySelectorAll('.page').forEach(page => {
    pageObserver.observe(page, { attributes: true, attributeFilter: ['class'] });
  });
  window.addEventListener('storage', event => {
    if (event.key === 'poi-theme') applyTheme(event.newValue);
  });
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    document.querySelectorAll('.is-tilting').forEach(resetTilt);
    document.querySelectorAll('#overview .overview-hero').forEach(resetHeroTilt);
  });

  applyTheme(root.dataset.theme);
  updateFilterControl();
  updateProgress();
})();
