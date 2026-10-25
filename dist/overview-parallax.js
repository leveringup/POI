(() => {
  const overview = document.getElementById('overview');
  const hero = overview?.querySelector('.overview-hero');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!overview || !hero) return;

  let active = false;
  let frame = 0;

  function resetParallax() {
    hero.style.removeProperty('--overview-parallax-image-y');
    hero.style.removeProperty('--overview-parallax-copy-y');
  }

  function updateParallax() {
    frame = 0;
    if (!active) return;

    const distance = Math.min(Math.max(-hero.getBoundingClientRect().top, 0), hero.offsetHeight);
    hero.style.setProperty('--overview-parallax-image-y', `${distance * 0.12}px`);
    hero.style.setProperty('--overview-parallax-copy-y', `${distance * 0.035}px`);
  }

  function scheduleUpdate() {
    if (!frame) frame = window.requestAnimationFrame(updateParallax);
  }

  function setActive(nextActive) {
    if (active === nextActive) return;
    active = nextActive;

    if (active) {
      window.addEventListener('scroll', scheduleUpdate, { passive: true });
      window.addEventListener('resize', scheduleUpdate);
      scheduleUpdate();
      return;
    }

    window.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', scheduleUpdate);
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    resetParallax();
  }

  function updateActivity() {
    setActive(!motionPreference.matches
      && !document.body.classList.contains('effects-paused')
      && overview.classList.contains('active'));
  }

  const pageObserver = new MutationObserver(updateActivity);
  pageObserver.observe(overview, { attributes: true, attributeFilter: ['class'] });
  pageObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  motionPreference.addEventListener('change', updateActivity);
  document.addEventListener('poi-motion-change', updateActivity);
  updateActivity();
})();
