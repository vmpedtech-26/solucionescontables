/* -------------------------------------------------------------
   Movimiento del sistema: cada vista entra de forma escalonada, los
   indicadores cuentan y las filas de tablas se asientan. Solo anima el
   contenido de la vista (no la barra lateral) para que navegar sea agil.
   ------------------------------------------------------------- */
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function contarMonto(el) {
  const txt = el.textContent.trim();
  const m = txt.match(/^([^\d-]*)(-?[\d.]+)(,\d+)?(.*)$/);
  if (!m) return;
  const entero = Number(m[2].replace(/\./g, ''));
  if (!Number.isFinite(entero) || entero === 0) return;
  const [, pre, , dec = '', suf] = m;
  const t0 = performance.now();
  const dur = Math.min(1400, 600 + String(Math.abs(entero)).length * 90);
  const paso = (t) => {
    if (!document.body.contains(el)) return;
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = `${pre}${Math.round(entero * e).toLocaleString('es-AR')}${p < 1 ? '' : dec}${suf}`;
    if (p < 1) requestAnimationFrame(paso);
    else el.textContent = txt;
  };
  requestAnimationFrame(paso);
}

export function animarVista() {
  if (reduce()) return;
  const cont = document.querySelector('.db-view-container');
  if (!cont) return;

  // Bloques principales de la vista, escalonados
  [...cont.children].slice(0, 10).forEach((el, i) => {
    el.style.setProperty('--d', `${i * 55}ms`);
    el.classList.add('app-enter');
  });
  // Tarjetas de indicadores dentro de grillas
  cont.querySelectorAll('.kpi-grid > *, .trial-actions-grid > *, .grid-resp-3 > *, .grid-resp-4 > *').forEach((el, i) => {
    el.style.setProperty('--d', `${120 + Math.min(i, 8) * 60}ms`);
    el.classList.add('app-enter');
  });
  // Primeras filas de cada tabla
  cont.querySelectorAll('table tbody').forEach((tb) => {
    [...tb.rows].slice(0, 14).forEach((tr, i) => {
      tr.style.setProperty('--d', `${180 + i * 28}ms`);
      tr.classList.add('app-row-enter');
    });
  });
  // Montos de los indicadores
  cont.querySelectorAll('.kpi-val').forEach(contarMonto);

  // Limpia las clases al terminar, para que no interfieran con hovers ni re-renders parciales
  setTimeout(() => {
    cont.querySelectorAll('.app-enter, .app-row-enter').forEach((el) => el.classList.remove('app-enter', 'app-row-enter'));
  }, 1600);
}
