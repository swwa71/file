/* طبقة العرض فقط: لا تقرأ بيانات الأدوات ولا تغيّر منطقها.
   تراقب فقط الأصناف والعناوين التي يغيّرها app.js أصلًا. */
(() => {
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* 1) عدسة زجاجية تنزلق خلف الأداة النشطة */
  const grid = $('tool-grid');
  if (grid) {
    const lens = document.createElement('span');
    lens.className = 'tool-lens';
    lens.setAttribute('aria-hidden', 'true');
    grid.prepend(lens);
    const place = animate => {
      const card = grid.querySelector('.tool-card.active');
      if (!card) return;
      if (!animate || reduced.matches) lens.classList.add('no-anim');
      lens.style.width = card.offsetWidth + 'px';
      lens.style.height = card.offsetHeight + 'px';
      lens.style.transform = `translate(${card.offsetLeft}px, ${card.offsetTop}px)`;
      if (!animate || reduced.matches) { void lens.offsetWidth; lens.classList.remove('no-anim'); }
      if (!lens.classList.contains('ready')) lens.classList.add('ready');
      if (!grid.classList.contains('has-lens')) grid.classList.add('has-lens');
    };
    place(false);
    /* يتفاعل فقط عندما تتغير الأداة النشطة (أصناف البطاقات)، لا مع تعديلاتنا على العدسة */
    new MutationObserver(records => {
      if (records.some(r => r.target.classList && r.target.classList.contains('tool-card'))) place(true);
    }).observe(grid, {attributes: true, attributeFilter: ['class'], subtree: true});
    if ('ResizeObserver' in window) new ResizeObserver(() => place(false)).observe(grid);
    addEventListener('load', () => place(false));
    addEventListener('resize', () => place(false));
  }

  /* 2) انتقال ناعم لمحتوى مساحة العمل عند تبديل الأداة */
  const title = $('current-tool-title');
  const targets = ['current-tool-title', 'current-tool-description', 'options', 'dropzone'].map($);
  if (title) {
    new MutationObserver(() => {
      if (reduced.matches) return;
      targets.forEach((target, i) => {
        if (!target || !target.animate) return;
        target.getAnimations().forEach(a => a.cancel());
        target.animate(
          [{opacity: 0, transform: 'translateY(10px)', filter: 'blur(6px)'}, {opacity: 1, transform: 'translateY(0)', filter: 'blur(0)'}],
          {duration: 520, delay: i * 45, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards'}
        );
      });
    }).observe(title, {childList: true, characterData: true, subtree: true});
  }

  /* 3) ضوء يتتبّع المؤشر على حافة الزجاج */
  document.querySelectorAll('.hero, .tool-card, .workspace, .info-card').forEach(el => el.classList.add('glass-surface'));
  let current = null, px = 0, py = 0, frame = 0, off = 0;
  const paint = () => {
    frame = 0;
    if (!current) return;
    const r = current.getBoundingClientRect();
    current.style.setProperty('--mx', (px - r.left) + 'px');
    current.style.setProperty('--my', (py - r.top) + 'px');
  };
  const track = e => {
    if (reduced.matches) return;
    clearTimeout(off);
    const next = e.target.closest ? e.target.closest('.glass-surface') : null;
    if (next !== current) {
      if (current) current.classList.remove('lit');
      current = next;
      if (current) current.classList.add('lit');
    }
    px = e.clientX; py = e.clientY;
    if (current && !frame) frame = requestAnimationFrame(paint);
  };
  const release = delay => { off = setTimeout(() => { if (current) current.classList.remove('lit'); current = null; }, delay); };
  document.addEventListener('pointermove', track, {passive: true});
  document.addEventListener('pointerdown', track, {passive: true});
  document.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') release(500); }, {passive: true});
  document.addEventListener('pointercancel', () => release(0), {passive: true});
  document.documentElement.addEventListener('pointerleave', () => release(0));

  /* 4) الشريط العلوي يزداد كثافة عند التمرير */
  const bar = document.querySelector('.topbar');
  if (bar) {
    const onScroll = () => bar.classList.toggle('scrolled', scrollY > 8);
    addEventListener('scroll', onScroll, {passive: true});
    onScroll();
  }
})();
