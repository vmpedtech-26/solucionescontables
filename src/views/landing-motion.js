/* -------------------------------------------------------------
   Movimiento de la landing (complementa el diseño existente).
   Se llama desde initLanding(); es idempotente y sus intervalos se
   cortan solos cuando la landing sale del DOM.
   ------------------------------------------------------------- */

const FONDOS = ['/corporate_bg.jpg', '/corporate_bg_2.jpg', '/corporate_bg_3.jpg'];

const NOVEDADES = [
  ['Factura electrónica', 'Factura B emitida · CAE aprobado por ARCA'],
  ['Bandeja de clientes', '3 comprobantes nuevos para revisar'],
  ['Monotributo', 'Alerta: un cliente llegó al 85% del tope'],
  ['Portal de Clientes', 'Tus clientes suben sus tickets desde el celular'],
  ['Padrón ARCA', 'Datos del CUIT completados automáticamente']
];

const FUNCIONES = [
  'Factura A, B y C con CAE', 'Libro IVA Digital RG 4597', 'Consulta al padrón de ARCA',
  'Topes de Monotributo', 'Bandeja de comprobantes', 'Portal para tus clientes',
  'Retenciones y percepciones', 'Convenio Multilateral', 'Importación de Mis Comprobantes',
  'Ajuste por inflación RT 54', 'Comprobantes con QR'
];

export function initLandingMotion() {
  const wrapper = document.querySelector('.lp-wrapper');
  if (!wrapper || wrapper.dataset.motion === '1') return;
  wrapper.dataset.motion = '1';

  const vivo = () => document.body.contains(wrapper);
  const cada = (fn, ms) => {
    const id = setInterval(() => { if (!vivo()) { clearInterval(id); return; } fn(); }, ms);
    return id;
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  wrapper.classList.add('lp-motion');

  // Barra de progreso y header
  const barra = document.createElement('div');
  barra.className = 'lp-progress';
  wrapper.appendChild(barra);
  const header = wrapper.querySelector('.lp-header');
  let ticking = false;
  const onScroll = () => {
    if (!vivo()) { window.removeEventListener('scroll', onScroll); return; }
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      barra.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      header?.classList.toggle('is-scrolled', window.scrollY > 10);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Fondo: carrusel de fotos con fundido (se cargan despues de la primera)
  const show = wrapper.querySelector('.lp-bg-slideshow');
  const overlay = show?.querySelector('.lp-bg-overlay');
  if (show && overlay) {
    const slides = [...show.querySelectorAll('.lp-bg-slide')];
    const reiniciar = (el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; };
    if (slides[0]) reiniciar(slides[0]);
    setTimeout(() => {
      FONDOS.slice(1).forEach((src) => {
        const img = new Image();
        img.onload = () => {
          const s = document.createElement('div');
          s.className = 'lp-bg-slide';
          s.style.backgroundImage = `url('${src}')`;
          show.insertBefore(s, overlay);
        };
        img.src = src;
      });
    }, 2500);
    let i = 0;
    cada(() => {
      const todos = [...show.querySelectorAll('.lp-bg-slide')];
      if (todos.length < 2) return;
      todos[i % todos.length].classList.remove('active');
      i = (i + 1) % todos.length;
      const sig = todos[i];
      reiniciar(sig);
      sig.classList.add('active');
    }, 9000);
  }

  // Titulo del hero: cada palabra sube (respeta el span en verde)
  const titulo = wrapper.querySelector('.hero-title');
  if (titulo && !titulo.querySelector('.lp-w')) {
    let n = 0;
    const partir = (nodo) => {
      [...nodo.childNodes].forEach((c) => {
        if (c.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach((t) => {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
            const w = document.createElement('span');
            w.className = 'lp-w';
            const inner = document.createElement('span');
            inner.textContent = t;
            inner.style.setProperty('--d', `${120 + n++ * 55}ms`);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          c.replaceWith(frag);
        } else if (c.nodeType === Node.ELEMENT_NODE) partir(c);
      });
    };
    partir(titulo);
    requestAnimationFrame(() => requestAnimationFrame(() => titulo.classList.add('lp-title-in')));
  }

  // Estadisticas que cuentan (el 0% baja desde 100)
  const contar = (el) => {
    const m = el.textContent.trim().match(/^(\d+)(.*)$/);
    if (!m) return;
    const fin = Number(m[1]);
    const suf = m[2];
    const ini = fin === 0 ? 100 : 0;
    const t0 = performance.now();
    const dur = 1600;
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(ini + (fin - ini) * e) + suf;
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };
  const stats = wrapper.querySelectorAll('.stat-val');
  if (stats.length) {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) { contar(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.6 });
    stats.forEach((s) => io.observe(s));
  }

  // Mockup: profundidad con el cursor y novedades que rotan
  const mockup = wrapper.querySelector('.mockup-container');
  const visual = wrapper.querySelector('.hero-visual');
  if (mockup && visual && window.matchMedia('(pointer: fine)').matches) {
    visual.addEventListener('pointermove', (e) => {
      const r = visual.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      mockup.style.setProperty('--ry', `${x * 10}deg`);
      mockup.style.setProperty('--rx', `${-y * 8}deg`);
    });
    visual.addEventListener('pointerleave', () => {
      mockup.style.setProperty('--ry', '0deg');
      mockup.style.setProperty('--rx', '0deg');
    });
  }
  const mfc = wrapper.querySelector('.mfc-text');
  if (mfc) {
    let k = 0;
    cada(() => {
      mfc.classList.add('is-swapping');
      setTimeout(() => {
        const [t, d] = NOVEDADES[k++ % NOVEDADES.length];
        const h = mfc.querySelector('h4');
        const p = mfc.querySelector('p');
        if (h) h.textContent = t;
        if (p) p.textContent = d;
        mfc.classList.remove('is-swapping');
      }, 350);
    }, 4200);
  }
  // Valor de IVA del mockup: destaca cuando cambia
  const iva = wrapper.querySelector('.mockup-row .mockup-widget:nth-child(2) .mockup-w-val');
  if (iva) {
    new MutationObserver(() => {
      iva.classList.remove('lp-pulse-val');
      void iva.offsetWidth;
      iva.classList.add('lp-pulse-val');
    }).observe(iva, { childList: true, characterData: true, subtree: true });
  }

  // Cinta de funciones debajo del hero
  const hero = wrapper.querySelector('.hero-section');
  if (hero && !wrapper.querySelector('.lp-marquee')) {
    const cinta = document.createElement('div');
    cinta.className = 'lp-marquee';
    cinta.setAttribute('aria-hidden', 'true');
    const items = [...FUNCIONES, ...FUNCIONES].map((f) => `<span class="lp-marquee-item">${f}</span>`).join('');
    cinta.innerHTML = `<div class="lp-marquee-track">${items}</div>`;
    hero.after(cinta);
  }

  // Tarjetas: luz que sigue al cursor
  wrapper.querySelectorAll('.feature-card, .price-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}
