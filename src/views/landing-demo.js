/* -------------------------------------------------------------
   Pedido de demo por WhatsApp: el formulario arma el mensaje y abre
   el chat. Los botones de cada plan preseleccionan el plan.
   ------------------------------------------------------------- */
import { LEGAL } from '../legal-config.js';

const numeroWA = () => (LEGAL.telefono || '+54 299 673-1487').replace(/\D/g, '').replace(/^54(?!9)/, '549');

export function initDemoForm() {
  const form = document.getElementById('demo-form');
  if (!form || form.dataset.ready === '1') return;
  form.dataset.ready = '1';

  document.querySelectorAll('[data-plan]').forEach((a) => {
    a.addEventListener('click', () => {
      const sel = document.getElementById('demo-plan');
      if (sel) sel.value = a.dataset.plan;
      setTimeout(() => document.getElementById('demo-nombre')?.focus({ preventScroll: true }), 700);
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (id) => (document.getElementById(id)?.value || '').trim();
    const lineas = [
      'Hola! Quiero solicitar una demo de Soluciones Contables.',
      `Nombre: ${v('demo-nombre')}`,
      `Estudio: ${v('demo-estudio')}`,
      `Clientes que administro: ${v('demo-clientes')}`,
      v('demo-plan') ? `Plan de interés: ${v('demo-plan')}` : '',
      v('demo-mensaje') ? `Me interesa ver: ${v('demo-mensaje')}` : ''
    ].filter(Boolean);
    const url = `https://wa.me/${numeroWA()}?text=${encodeURIComponent(lineas.join('\n'))}`;
    const w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
  });
}
