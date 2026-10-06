/* -------------------------------------------------------------
   Derechos del titular de datos (Ley 25.326): exportar y eliminar la propia
   cuenta. Solo en modo real: el sandbox no guarda datos personales en servidor.
   ------------------------------------------------------------- */
import { supabase, isSupabaseConfigured } from '../db/supabase.js';
import { LEGAL } from '../legal-config.js';
import { sanitizeInput as esc } from '../utils.js';

export function renderDatosCard({ esEstudio = true } = {}) {
  if (!isSupabaseConfigured) return '';
  const aviso = esEstudio
    ? 'Se eliminan tu estudio, todas las empresas cargadas y sus registros contables (comprobantes, IVA, retenciones, sueldos). Los clientes que hayas invitado perderán el acceso. No se puede deshacer.'
    : 'Se elimina tu cuenta y tu acceso al portal. Los comprobantes que ya enviaste a tu estudio permanecen en los registros del estudio contable.';
  return `
  <div class="card" id="datos-card">
    <div class="card-header">
      <h3><i data-lucide="shield-check" style="color: var(--color-accent);"></i> Mis datos y privacidad</h3>
    </div>
    <div class="card-body">
      <p class="text-secondary" style="font-size: 12px; line-height: 1.5; margin-bottom: 14px;">
        Podés descargar una copia de todos tus datos o eliminar tu cuenta. Consultas: ${esc(LEGAL.email)}.
      </p>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-outline" id="btn-export-datos"><i data-lucide="download"></i> Descargar mis datos (JSON)</button>
        <button class="btn btn-outline" id="btn-delete-account" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);"><i data-lucide="trash-2"></i> Eliminar mi cuenta</button>
      </div>
      <p style="font-size: 11px; color: var(--text-muted); margin-top: 10px; line-height: 1.4;">${esc(aviso)}</p>
    </div>
  </div>`;
}

export function initDatosCard(mainApp) {
  if (!isSupabaseConfigured || !supabase) return;

  document.getElementById('btn-export-datos')?.addEventListener('click', async () => {
    const { data, error } = await supabase.rpc('export_my_data');
    if (error) {
      mainApp.showToast('No se pudo generar la exportación. Intentá de nuevo.', 'error');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    mainApp.showToast('Descarga lista.', 'success');
  });

  document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
    const typed = window.prompt('Esta acción elimina tu cuenta y sus datos de forma permanente.\nPara confirmar, escribí ELIMINAR:');
    if (typed === null) return;
    if (typed.trim() !== 'ELIMINAR') {
      mainApp.showToast('Confirmación incorrecta: no se eliminó nada.', 'info');
      return;
    }
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      mainApp.showToast('No se pudo eliminar la cuenta. Escribinos a ' + LEGAL.email, 'error');
      return;
    }
    try { await supabase.auth.signOut(); } catch (e) { /* la sesión ya no existe */ }
    localStorage.removeItem('vmp_premium_unlocked');
    window.location.hash = '#/';
    window.location.reload();
  });
}
