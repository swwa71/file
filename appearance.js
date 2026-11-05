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
          [{opacity: .55, transform: 'translateY(5px)', filter: 'blur(2px)'}, {opacity: 1, transform: 'translateY(0)', filter: 'blur(0)'}],
          {duration: 350, delay: i * 25, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards'}
        );
      });
      const workspace = $('workspace');
      if (workspace && workspace.animate) {
        workspace.getAnimations().filter(a => a.id === 'tool-switch').forEach(a => a.cancel());
        const animation = workspace.animate(
          [{transform: 'translateY(4px) scale(.997)'}, {transform: 'translateY(0) scale(1)'}],
          {duration: 380, easing: 'cubic-bezier(.22,1,.36,1)'}
        );
        animation.id = 'tool-switch';
      }
    }).observe(title, {childList: true, characterData: true, subtree: true});
  }

  /* حركة ضوء خفيفة حول المؤشر، لأجهزة الماوس فقط */
  if (!reduced.matches && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const aura = document.createElement('div');
    aura.className = 'pointer-aura';
    aura.setAttribute('aria-hidden', 'true');
    document.body.appendChild(aura);
    let pointX = -200, pointY = -200, auraFrame = 0;
    const moveAura = () => {
      auraFrame = 0;
      aura.style.transform = `translate3d(${pointX - 90}px,${pointY - 90}px,0)`;
    };
    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      pointX = e.clientX; pointY = e.clientY;
      aura.style.opacity = '1';
      if (!auraFrame) auraFrame = requestAnimationFrame(moveAura);
    }, {passive: true});
    document.documentElement.addEventListener('pointerleave', () => { aura.style.opacity = '0'; });
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
  /* 5) تحية حسب وقت اليوم */
  const hello = $('greeting');
  if (hello) {
    const h = new Date().getHours();
    const g = h < 5 ? 'سهرة موفقة 🌙' : h < 12 ? 'صباح الخير ☀️' : h < 17 ? 'طاب يومك 🌤️' : h < 21 ? 'مساء الخير 🌆' : 'ليلة هادئة 🌙';
    hello.textContent = g;
  }

  /* 6) عمق الخلفية: تتحرك مع المؤشر والتمرير، وتتضبب تدريجيًا لإبراز الأدوات */
  const stage = document.querySelector('.bg-stage');
  if (stage && !reduced.matches) {
    let tick = 0;
    const setScroll = () => {
      tick = 0;
      stage.style.setProperty('--sy', String(scrollY));
      stage.style.setProperty('--focus', String(Math.min(1, scrollY / 520)));
    };
    addEventListener('scroll', () => { if (!tick) tick = requestAnimationFrame(setScroll); }, {passive: true});
    setScroll();
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.addEventListener('pointermove', e => {
        stage.style.setProperty('--px', ((e.clientX / innerWidth) - .5).toFixed(3));
        stage.style.setProperty('--py', ((e.clientY / innerHeight) - .5).toFixed(3));
      }, {passive: true});
    }
  }

  /* 7) ميلان خفيف ثلاثي الأبعاد لبطاقات الأدوات عند تمرير المؤشر */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced.matches) {
    document.querySelectorAll('.tool-card').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        card.style.setProperty('--ry', (x * 2.5).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-y * 2.5).toFixed(2) + 'deg');
      }, {passive: true});
      card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    });
  }

  /* 8) ظهور ناعم لبطاقات المعلومات عند الوصول إليها */
  if ('IntersectionObserver' in window && !reduced.matches) {
    const items = [...document.querySelectorAll('.info-card, .section-head')];
    items.forEach(el => el.classList.add('reveal-wait'));
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target, i = items.indexOf(el);
        setTimeout(() => { el.classList.add('reveal-in'); el.classList.remove('reveal-wait'); }, (i % 3) * 90);
        io.unobserve(el);
      });
    }, {threshold: .15});
    items.forEach(el => io.observe(el));
  }

  /* 9) قصاصات احتفال عندما تظهر نتيجة ناجحة (تراقب ظهور صندوق النتيجة فقط) */
  const box = $('result');
  if (box && !reduced.matches) {
    let wasHidden = box.classList.contains('hidden');
    new MutationObserver(() => {
      const hidden = box.classList.contains('hidden');
      if (wasHidden && !hidden) confetti(box);
      wasHidden = hidden;
    }).observe(box, {attributes: true, attributeFilter: ['class']});
  }
  function confetti(from) {
    const cv = document.createElement('canvas');
    cv.className = 'confetti-canvas';
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const r = from.getBoundingClientRect();
    const ox = r.left + r.width / 2, oy = Math.min(Math.max(r.top + 20, 80), innerHeight - 80);
    const colors = ['#ffe2bb', '#f6cf9c', '#eeb177', '#ffffff', '#a6ebc7', '#cfe3d4'];
    const bits = Array.from({length: 90}, () => {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
      return {x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4,
        rot: Math.random() * 6, vr: (Math.random() - .5) * .4, c: colors[(Math.random() * colors.length) | 0]};
    });
    const t0 = performance.now();
    (function frame(now) {
      const t = (now - t0) / 1900;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      bits.forEach(b => {
        b.vy += .28; b.vx *= .985; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t * t);
        ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      });
      if (t < 1) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }
})();
