(() => {
  const sections = document.querySelectorAll('.intro, .street, .process, .closing, .explore-links, footer');
  if (!sections.length) return;

  const sprites = [
    ['00100', '01110', '11111', '01110', '00100'],
    ['0001000', '0011100', '0111110', '1111111', '0111110', '0011100', '0001000'],
    ['1000101', '0101010', '0011100', '1111111', '0011100', '0101010', '1010001']
  ];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointerFine = matchMedia('(hover: hover) and (pointer: fine)');
  const fields = [];

  function createField(section) {
    const canvas = document.createElement('canvas');
    canvas.className = 'pixel-snow-field';
    canvas.setAttribute('aria-hidden', 'true');
    section.classList.add('pixel-snow-section');
    section.prepend(canvas);

    const context = canvas.getContext('2d');
    if (!context) return;

    const field = {
      section,
      canvas,
      context,
      width: 1,
      height: 1,
      flakes: [],
      frame: 0,
      lastPaint: 0,
      visible: false,
      pointer: { x: -1000, y: -1000 }
    };
    fields.push(field);

    function draw(animate = false) {
      context.clearRect(0, 0, field.width, field.height);
      const minimal = document.documentElement.dataset.theme === 'minimal';
      const colors = minimal ? ['#7f9c83', '#a8b998', '#c5d3b7'] : ['#c0afff', '#87e8ee', '#e2e6ff'];

      for (const flake of field.flakes) {
        if (animate) {
          flake.phase += 0.025;
          flake.x += (flake.drift + Math.sin(flake.phase) * 0.12) * flake.depth;
          flake.y += flake.speed;

          const dx = flake.x - field.pointer.x;
          const dy = flake.y - field.pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 110 && distance > 0) {
            const push = (1 - distance / 110) * 1.6;
            flake.x += (dx / distance) * push;
            flake.y += (dy / distance) * push;
          }

          if (flake.y > field.height + 16) {
            flake.y = -16;
            flake.x = Math.random() * field.width;
          }
          if (flake.x > field.width + 16) flake.x = -16;
          if (flake.x < -16) flake.x = field.width + 16;
        }

        const sprite = sprites[flake.sprite];
        context.globalAlpha = flake.opacity;
        context.fillStyle = colors[flake.color];
        for (let row = 0; row < sprite.length; row++) {
          for (let column = 0; column < sprite[row].length; column++) {
            if (sprite[row][column] === '1') {
              context.fillRect(
                Math.round(flake.x + column * flake.cell),
                Math.round(flake.y + row * flake.cell),
                flake.cell,
                flake.cell
              );
            }
          }
        }
      }
      context.globalAlpha = 1;
    }

    function stop() {
      if (field.frame) cancelAnimationFrame(field.frame);
      field.frame = 0;
      draw();
    }

    function animate(time) {
      field.frame = 0;
      if (document.hidden || !field.visible || document.body.classList.contains('motion-paused') || reducedMotion.matches) {
        draw();
        return;
      }
      if (time - field.lastPaint >= 32) {
        draw(true);
        field.lastPaint = time;
      }
      field.frame = requestAnimationFrame(animate);
    }

    function schedule() {
      if (document.hidden || !field.visible || document.body.classList.contains('motion-paused') || reducedMotion.matches) {
        stop();
      } else if (!field.frame) {
        field.frame = requestAnimationFrame(animate);
      }
    }

    function resize() {
      const bounds = section.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      field.width = bounds.width;
      field.height = bounds.height;
      canvas.width = Math.max(1, Math.round(field.width * dpr));
      canvas.height = Math.max(1, Math.round(field.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = matchMedia('(max-width: 760px)').matches ? 20 : 44;
      field.flakes = Array.from({ length: count }, () => {
        const depth = 0.45 + Math.random() * 0.8;
        return {
          x: Math.random() * field.width,
          y: Math.random() * field.height,
          sprite: Math.floor(Math.random() * sprites.length),
          cell: 1 + Math.random() * 1.1,
          speed: 0.25 + depth * 0.45,
          drift: (Math.random() - 0.5) * 0.25,
          depth,
          phase: Math.random() * Math.PI * 2,
          opacity: 0.2 + Math.random() * 0.35,
          color: Math.floor(Math.random() * 3)
        };
      });
      draw();
      schedule();
    }

    field.draw = draw;
    field.schedule = schedule;

    if (pointerFine.matches) {
      section.addEventListener('pointermove', event => {
        const bounds = section.getBoundingClientRect();
        field.pointer.x = event.clientX - bounds.left;
        field.pointer.y = event.clientY - bounds.top;
      }, { passive: true });
      section.addEventListener('pointerleave', () => {
        field.pointer.x = -1000;
        field.pointer.y = -1000;
      });
    }

    new IntersectionObserver(entries => {
      field.visible = entries[0].isIntersecting;
      schedule();
    }).observe(section);

    new ResizeObserver(resize).observe(section);
    resize();
  }

  sections.forEach(createField);

  const scheduleAll = () => fields.forEach(field => field.schedule());

  new MutationObserver(scheduleAll).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', scheduleAll);
  document.addEventListener('poi-theme-change', () => fields.forEach(field => field.draw()));
  reducedMotion.addEventListener('change', scheduleAll);
})();
