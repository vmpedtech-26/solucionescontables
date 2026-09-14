/* -------------------------------------------------------------
   VMP Studio Contable — Retenciones y Percepciones
   Conciliación impositiva, cuenta puente y generador CSV ARCA
   ------------------------------------------------------------- */
import { getActiveCompanyAsync, getTransactionsAsync } from '../db/mockdb.js';
import { supabase, isSupabaseConfigured } from '../db/supabase.js';
import { renderPremiumTeaser } from '../utils.js';

function fmt(n) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

function getRetencionesSandbox(companyId) {
  const stored = localStorage.getItem(`vmp_retenciones_${companyId}`);
  if (stored) return JSON.parse(stored);
  // Demo data
  return [
    { id: 'r1', fecha: '2026-05-05', agente: 'Coto S.A.', cuit: '30-50790918-7', tipo: 'PERCEPCIÓN IVA', monto: 1850.20, fuente: 'factura', conciliado: true, certDisponible: true },
    { id: 'r2', fecha: '2026-05-12', agente: 'Banco Nación Argentina', cuit: '30-55745039-6', tipo: 'RETENCIÓN SIRCREB', monto: 3200.00, fuente: 'banco', conciliado: false, certDisponible: false },
    { id: 'r3', fecha: '2026-05-18', agente: 'La Rural S.A.', cuit: '30-67890123-5', tipo: 'PERCEPCIÓN IIBB', monto: 940.50, fuente: 'factura', conciliado: true, certDisponible: true },
    { id: 'r4', fecha: '2026-05-20', agente: 'Carrefour Argentina', cuit: '30-60410619-5', tipo: 'PERCEPCIÓN IVA', monto: 2100.75, fuente: 'factura', conciliado: false, certDisponible: false },
    { id: 'r5', fecha: '2026-05-22', agente: 'ARBA (Prov. Bs As)', cuit: '33-70523373-9', tipo: 'PERCEPCIÓN IIBB', monto: 780.00, fuente: 'banco', conciliado: false, certDisponible: false },
  ];
}

// Jurisdicciones de Convenio Multilateral hardcodeadas para el sandbox (antes
// vivían en el array DEFAULT_COMPANIES de mockdb.js; en Supabase son la
// tabla real jurisdicciones_iibb).
const JURISDICCIONES_SANDBOX = {
  'co-1': [
    { provincia: "Neuquén", pctIngresos: 45, pctGastos: 50, alicuotaIIBB: 4.0 },
    { provincia: "Río Negro", pctIngresos: 35, pctGastos: 30, alicuotaIIBB: 3.5 },
    { provincia: "La Pampa", pctIngresos: 20, pctGastos: 20, alicuotaIIBB: 3.0 }
  ]
};

export async function getRetencionesAsync(companyId) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('retenciones')
      .select('*')
      .eq('empresa_id', companyId)
      .order('fecha', { ascending: false });

    if (!error) {
      return data.map(r => ({
        id: r.id, fecha: r.fecha, agente: r.agente, cuit: r.cuit, tipo: r.tipo,
        monto: Number(r.monto), fuente: r.fuente, conciliado: r.conciliado, certDisponible: r.cert_disponible
      }));
    }
    console.error("Error trayendo retenciones de Supabase:", error);
  }
  return getRetencionesSandbox(companyId);
}

async function addRetencionAsync(companyId, ret) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('retenciones').insert({
      id: ret.id,
      empresa_id: companyId,
      fecha: ret.fecha,
      agente: ret.agente,
      cuit: ret.cuit,
      tipo: ret.tipo,
      monto: ret.monto,
      fuente: ret.fuente,
      conciliado: ret.conciliado,
      cert_disponible: ret.certDisponible
    }).select().single();
    if (error) throw error;
    return data;
  }
  const rets = getRetencionesSandbox(companyId);
  rets.push(ret);
  localStorage.setItem(`vmp_retenciones_${companyId}`, JSON.stringify(rets));
  return ret;
}

async function conciliarRetencionAsync(companyId, retencionId) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('retenciones')
      .update({ conciliado: true, cert_disponible: true })
      .eq('id', retencionId);
    if (error) throw error;
    return;
  }
  const rets = getRetencionesSandbox(companyId);
  const updated = rets.map(r => r.id === retencionId ? { ...r, conciliado: true, certDisponible: true } : r);
  localStorage.setItem(`vmp_retenciones_${companyId}`, JSON.stringify(updated));
}

async function getJurisdiccionesAsync(companyId) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('jurisdicciones_iibb')
      .select('*')
      .eq('empresa_id', companyId);
    if (!error) {
      return data.map(j => ({
        provincia: j.provincia,
        pctIngresos: Number(j.pct_ingresos),
        pctGastos: Number(j.pct_gastos),
        alicuotaIIBB: Number(j.alicuota_iibb)
      }));
    }
    console.error("Error trayendo jurisdicciones de Supabase:", error);
    return [];
  }
  return JURISDICCIONES_SANDBOX[companyId] || [];
}

export async function renderRetenciones() {
  const company = await getActiveCompanyAsync();
  if (!company) {
    return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Retenciones y Percepciones</h1>
        <p class="view-subtitle">Conciliación impositiva mensual y carga en IVA Simple.</p>
      </div>
    </div>
    <div class="card">
      <div class="card-body" style="text-align: center; padding: 48px;">
        <i data-lucide="building" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 12px;"></i>
        <h4>Todavía no cargaste ninguna empresa cliente</h4>
        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 6px; margin-bottom: 16px;">Registrá una empresa para empezar a conciliar sus retenciones.</p>
        <a href="#/studio/empresas" class="btn btn-primary">Ir a Empresas Clientes</a>
      </div>
    </div>
    `;
  }

  const allRets = await getRetencionesAsync(company.id);
  const jurisdicciones = await getJurisdiccionesAsync(company.id);

  // Check for pre-filtering (from Dashboard alert card)
  const isSircrebFiltered = window.location.hash.includes('filter=sircreb');
  const rets = isSircrebFiltered
    ? allRets.filter(r => !r.conciliado && r.fuente === 'banco')
    : allRets;

  const totalRet = rets.reduce((s, r) => s + r.monto, 0);
  const totalConc = rets.filter(r => r.conciliado).reduce((s, r) => s + r.monto, 0);
  const totalPuente = rets.filter(r => !r.conciliado).reduce((s, r) => s + r.monto, 0);
  const totalSinCert = rets.filter(r => !r.certDisponible).reduce((s, r) => s + r.monto, 0);

  const fuenteColor = { factura: 'var(--color-accent)', banco: '#06b6d4', manual: '#f59e0b' };
  const fuenteLabel = { factura: 'Libro Compras', banco: 'Extracto Bancario', manual: 'Manual' };

  // Convenio Multilateral (IIBB): base imponible del período = ventas netas
  // gravadas del período activo, distribuida por Coeficiente Unificado.
  let cmTotalVentas = 0;
  let cmTotalIIBB = 0;
  let cmTotalSircreb = 0;
  let cmTotalSaldo = 0;
  if (jurisdicciones && jurisdicciones.length > 1) {
    const activePeriod = localStorage.getItem('vmp_active_period') || '2026-05';
    const txs = await getTransactionsAsync(company.id);
    cmTotalVentas = txs.ventas.filter(v => v.fecha.startsWith(activePeriod)).reduce((s, v) => s + v.neto, 0);
    cmTotalIIBB = jurisdicciones.reduce((s, j) => {
      const coef = (j.pctIngresos + j.pctGastos) / 200;
      return s + (cmTotalVentas * coef * (j.alicuotaIIBB / 100));
    }, 0);

    // El banco retiene SIRCREB en una única cuenta, pero lo distribuye ARCA
    // entre las mismas jurisdicciones y con el mismo Coeficiente Unificado del
    // padrón bancario — por eso se acredita a cuenta del IIBB de cada
    // jurisdicción, no como una retención genérica más de la lista de abajo.
    cmTotalSircreb = allRets
      .filter(r => r.tipo === 'RETENCIÓN SIRCREB' && r.conciliado)
      .reduce((s, r) => s + r.monto, 0);
    cmTotalSaldo = cmTotalIIBB - cmTotalSircreb;
  }

  return renderPremiumTeaser(`
  <div class="view-header">
    <div>
      <h1 class="view-title">Retenciones y Percepciones</h1>
      <p class="view-subtitle">Conciliación impositiva mensual y carga en IVA Simple.</p>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-outline" id="btn-export-csv-sire">
        <i data-lucide="download"></i> Exportar CSV SIRE
      </button>
      <button class="btn btn-primary" id="btn-add-ret" style="background:var(--color-accent);border-color:var(--color-accent);">
        <i data-lucide="plus"></i> Agregar Manual
      </button>
    </div>
  </div>

  <!-- Resumen de 3 Fuentes -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px;">
    ${[
      { label:'Total Período', val: totalRet, icon:'sigma', color:'var(--color-accent)' },
      { label:'Conciliadas', val: totalConc, icon:'check-circle-2', color:'var(--color-accent)' },
      { label:'Cuenta Puente', val: totalPuente, icon:'clock', color:'#f59e0b' },
      { label:'Sin Certificado', val: totalSinCert, icon:'alert-triangle', color:'#f87171' },
    ].map(s => `
      <div class="card" style="padding:16px 20px;border-color:rgba(255,255,255,0.05);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <i data-lucide="${s.icon}" style="width:16px;height:16px;color:${s.color};"></i>
          <span style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;">${s.label}</span>
        </div>
        <div class="font-mono" style="font-size:20px;font-weight:800;color:${s.color};">$ ${fmt(s.val)}</div>
      </div>
    `).join('')}
  </div>

  <!-- Explicación Cuenta Puente -->
  ${totalPuente > 0 ? `
  <div style="background:rgba(245,158,11,0.03);border:1px solid rgba(245,158,11,0.2);border-radius:var(--radius-md);padding:16px 20px;margin-bottom:24px;display:flex;gap:14px;align-items:flex-start;">
    <i data-lucide="info" style="width:20px;height:20px;color:#f59e0b;flex-shrink:0;margin-top:2px;"></i>
    <div>
      <h4 style="font-size:13px;font-weight:700;color:#fbbf24;margin-bottom:4px;">Cuenta Puente "Retenciones a Conciliar" — $ ${fmt(totalPuente)}</h4>
      <p class="text-secondary" style="font-size:12px;line-height:1.5;">
        Existen agentes de recaudación que aún no subieron sus comprobantes a ARCA. Estos importes están suspendidos en la cuenta puente
        para no distorsionar los saldos contables de tesorería hasta que se acrediten o se reciba el certificado físico.
      </p>
    </div>
  </div>
  ` : ''}

  <div style="display:grid;grid-template-columns:1.4fr 0.6fr;gap:24px;align-items:start;">

    <!-- Tabla principal de conciliación -->
    <div class="card">
      <div class="card-header">
        <h3><i data-lucide="git-merge" style="color:var(--color-accent);"></i> Conciliación de 3 Fuentes</h3>
        <div style="display:flex;gap:8px;align-items:center;">
          ${isSircrebFiltered ? `
            <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:rgba(245,158,11,0.08);color:#fbbf24;border:1px solid rgba(245,158,11,0.2);display:inline-flex;align-items:center;gap:4px;">
              Filtro: SIRCREB a conciliar
              <a href="#/studio/retenciones" style="color:#f87171;text-decoration:none;font-weight:800;margin-left:4px;cursor:pointer;">[Quitar]</a>
            </span>
          ` : `
            <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:rgba(22,163,74,0.08);color:var(--color-accent-light);border:1px solid rgba(22,163,74,0.2);">Libro Compras</span>
            <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:rgba(6,182,212,0.08);color:#22d3ee;border:1px solid rgba(6,182,212,0.2);">Extracto Bancario</span>
          `}
        </div>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Agente de Recaudación</th>
                <th>Tipo</th>
                <th style="text-align:right;">Monto</th>
                <th style="text-align:center;">Origen</th>
                <th style="text-align:center;">Estado</th>
                <th style="text-align:center;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${rets.map(r => `
              <tr>
                <td style="font-size:12px;">${r.fecha.split('-').reverse().join('/')}</td>
                <td>
                  <div style="font-size:12.5px;font-weight:700;color:var(--color-primary);">${r.agente}</div>
                  <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted);margin-top:2px;">CUIT: ${r.cuit}</div>
                </td>
                <td style="font-size:11.5px;font-weight:600;color:var(--text-secondary);">${r.tipo}</td>
                <td class="font-mono font-bold" style="text-align:right;font-size:13px;color:${r.conciliado ? 'var(--color-accent)' : '#f59e0b'};">$ ${fmt(r.monto)}</td>
                <td style="text-align:center;">
                  <span style="font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);color:${fuenteColor[r.fuente] || '#fff'};">
                    ${fuenteLabel[r.fuente] || r.fuente}
                  </span>
                </td>
                <td style="text-align:center;">
                  ${r.conciliado ? `
                    <span style="font-size:10px;font-weight:700;color:var(--color-accent);display:flex;align-items:center;justify-content:center;gap:4px;">
                      <i data-lucide="check-circle" style="width:12px;height:12px;"></i> Conciliado
                    </span>
                  ` : `
                    <span style="font-size:10px;font-weight:700;color:#f59e0b;display:flex;align-items:center;justify-content:center;gap:4px;">
                      <i data-lucide="clock" style="width:12px;height:12px;"></i> Pendiente
                    </span>
                  `}
                </td>
                <td style="text-align:center;">
                  ${r.conciliado ? `
                    <button class="btn btn-outline btn-xs" disabled style="opacity:.45;cursor:not-allowed;padding:2px 8px;font-size:10px;">
                      ✓ Listo
                    </button>
                  ` : `
                    <button class="btn btn-primary btn-xs btn-conciliar" data-id="${r.id}" style="padding:2px 8px;font-size:10px;background:var(--color-accent);border-color:var(--color-accent);">
                      Conciliar
                    </button>
                  `}
                </td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Panel lateral: instrucciones CSV -->
    <div style="display:flex;flex-direction:column;gap:20px;">
      <div class="card" style="border-color:rgba(22,163,74,0.15);background:rgba(22,163,74,0.01);">
        <div class="card-header" style="background:rgba(22,163,74,0.02);">
          <h3 style="font-size:13px;color:var(--color-accent-light);"><i data-lucide="file-code-2"></i> Formato CSV para ARCA</h3>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:12px;">
          ${[
            { label: 'Orden de Pago', chars: 'Exactamente 16', color: 'var(--color-accent)' },
            { label: 'Factura de Compra', chars: 'Entre 5 y 8', color: 'var(--color-accent)' },
            { label: 'Otro Comprobante', chars: 'Exactamente 16', color: '#f59e0b' }
          ].map(i => `
            <div style="border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:10px 12px;">
              <div style="font-size:11.5px;font-weight:700;color:var(--color-primary);margin-bottom:3px;">${i.label}</div>
              <div style="font-size:11px;color:${i.color};font-weight:700;">${i.chars} caracteres</div>
            </div>
          `).join('')}
          <div style="background:rgba(239,68,68,0.03);border:1px solid rgba(239,68,68,0.15);border-radius:var(--radius-sm);padding:10px 12px;">
            <p style="font-size:11px;color:#f87171;line-height:1.5;">
              <strong>⚠ NO volver a abrir con Excel</strong> tras exportar como CSV UTF-8. El SO puede reformatear fechas y CUITs.
            </p>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-export-csv-sire-lateral" style="width:100%;font-size:12px;">
            <i data-lucide="download"></i> Descargar CSV
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3><i data-lucide="database" style="color:#06b6d4;"></i> Mis Retenciones ARCA</h3>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="font-size:12px;line-height:1.5;margin-bottom:12px;">
            Las retenciones electrónicas importadas por ARCA quedan <strong>bloqueadas</strong> para edición manual. Solo las cargadas por CSV o manualmente son editables.
          </p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:8px;background:rgba(255,255,255,0.02);border-radius:var(--radius-sm);">
              <span class="text-secondary">Importadas por ARCA</span>
              <span style="font-weight:700;color:var(--color-accent);">${rets.filter(r=>r.conciliado).length} registros</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:8px;background:rgba(255,255,255,0.02);border-radius:var(--radius-sm);">
              <span class="text-secondary">Cargadas manualmente/CSV</span>
              <span style="font-weight:700;color:#f59e0b;">${rets.filter(r=>!r.conciliado).length} registros</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  ${jurisdicciones && jurisdicciones.length > 1 ? `
  <div class="card" style="margin-top:24px;">
    <div class="card-header">
      <h3><i data-lucide="map" style="color:#8b5cf6;"></i> Convenio Multilateral — Distribución de Ingresos Brutos</h3>
    </div>
    <div class="card-body">
      <p class="text-secondary" style="font-size:12px; line-height:1.6; margin-bottom:14px;">
        El cliente factura y gasta en más de una jurisdicción, por lo que <strong>no</strong> liquida IIBB en régimen local: la base imponible del período se distribuye entre provincias según el <strong>Coeficiente Unificado</strong> de cada una (RG CM 03/04 — promedio entre el % de ingresos y el % de gastos atribuibles a esa jurisdicción durante el ejercicio anterior), y luego cada provincia aplica su propia alícuota sobre la porción que le corresponde. Las percepciones bancarias <strong>SIRCREB</strong> se retienen en una única cuenta, pero ARCA las distribuye entre esas mismas jurisdicciones con ese mismo coeficiente — por eso se acreditan a cuenta del IIBB determinado en cada una, no como una percepción genérica más.
      </p>
      <div style="font-size:11.5px; color:var(--text-secondary); margin-bottom:10px; display:flex; gap:20px; flex-wrap:wrap;">
        <span>Ingresos brutos gravados del período activo: <strong class="font-mono" style="color:var(--text-primary);">$ ${fmt(cmTotalVentas)}</strong></span>
        <span>SIRCREB conciliado a distribuir: <strong class="font-mono" style="color:var(--text-primary);">$ ${fmt(cmTotalSircreb)}</strong></span>
      </div>
      <table class="table table-sm" style="font-size:12px; width:100%;">
        <thead>
          <tr><th>Jurisdicción</th><th>Coef. Unificado</th><th>Base Imponible</th><th>Alícuota</th><th>IIBB Determinado</th><th>SIRCREB a Cuenta</th><th>Saldo</th></tr>
        </thead>
        <tbody>
          ${jurisdicciones.map(j => {
            const coef = (j.pctIngresos + j.pctGastos) / 200;
            const base = cmTotalVentas * coef;
            const impuesto = base * (j.alicuotaIIBB / 100);
            const sircrebJurisdiccion = cmTotalSircreb * coef;
            const saldoJurisdiccion = impuesto - sircrebJurisdiccion;
            return `<tr>
              <td style="font-weight:700;">${j.provincia}</td>
              <td class="font-mono">${(coef * 100).toFixed(2)}%</td>
              <td class="font-mono">$ ${fmt(base)}</td>
              <td class="font-mono">${j.alicuotaIIBB.toFixed(2)}%</td>
              <td class="font-mono">$ ${fmt(impuesto)}</td>
              <td class="font-mono" style="color:#06b6d4;">– $ ${fmt(sircrebJurisdiccion)}</td>
              <td class="font-mono" style="font-weight:800; color:${saldoJurisdiccion >= 0 ? 'var(--color-accent)' : '#06b6d4'};">
                ${saldoJurisdiccion >= 0 ? '$ ' + fmt(saldoJurisdiccion) : '$ ' + fmt(Math.abs(saldoJurisdiccion)) + ' (a favor)'}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid var(--border-color);">
            <td colspan="4" style="font-weight:800; text-align:right; padding-top:8px;">Totales del Convenio Multilateral del período</td>
            <td class="font-mono" style="font-weight:800; padding-top:8px;">$ ${fmt(cmTotalIIBB)}</td>
            <td class="font-mono" style="font-weight:800; padding-top:8px; color:#06b6d4;">– $ ${fmt(cmTotalSircreb)}</td>
            <td class="font-mono" style="font-weight:800; padding-top:8px; color:${cmTotalSaldo >= 0 ? 'var(--color-accent)' : '#06b6d4'};">
              ${cmTotalSaldo >= 0 ? '$ ' + fmt(cmTotalSaldo) : '$ ' + fmt(Math.abs(cmTotalSaldo)) + ' (a favor)'}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
  ` : ''}
  `, "Conciliación de Retenciones & Percepciones", "Evitá pérdidas de saldo fiscal. Cruzá de forma automatizada las retenciones registradas en el Libro Diario, el SIRE (ARCA) y los extractos bancarios (SIRCREB/percepciones).");
}

export async function initRetenciones(mainApp) {
  if (window.lucide) window.lucide.createIcons();

  const company = await getActiveCompanyAsync();
  if (!company) return; // Estado vacío ya renderizado por renderRetenciones(), nada que inicializar.

  // Conciliar una retención
  document.querySelectorAll('.btn-conciliar').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await conciliarRetencionAsync(company.id, btn.dataset.id);
        mainApp.showToast('Retención conciliada y certificado registrado.', 'success');
        mainApp.router();
      } catch (err) {
        mainApp.showToast(`Error al conciliar: ${err.message || err}`, 'error');
      }
    });
  });

  // Exportar CSV SIRE (ambos botones) con modal de advertencia preventiva de Excel
  const exportarCSV = () => {
    // 1. Crear el overlay del modal
    const modal = document.createElement('div');
    modal.className = 'vmp-modal-overlay';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(15, 23, 42, 0.7)';
    modal.style.backdropFilter = 'blur(12px)';
    modal.style.webkitBackdropFilter = 'blur(12px)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.25s ease';

    modal.innerHTML = `
      <div style="background:#ffffff; border:1px solid rgba(15,23,42,0.1); border-radius:16px; padding:32px; max-width:440px; width:90%; box-shadow:0 25px 50px -12px rgba(15,23,42,0.25); text-align:center; transform:scale(0.9); transition:transform 0.25s ease;" class="csv-warning-card">
        <div style="background:rgba(239,68,68,0.08); color:#ef4444; width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-inline:auto; margin-bottom:20px;">
          <i data-lucide="alert-octagon" style="width:28px; height:28px;"></i>
        </div>
        <h3 style="font-family:var(--font-heading); font-size:19px; font-weight:800; color:var(--text-primary); margin-top:0; margin-bottom:10px;">¡Advertencia Importante!</h3>
        <p style="font-size:13.5px; color:var(--text-secondary); line-height:1.6; margin-bottom:24px; text-align:left;">
          El archivo CSV para <strong>ARCA (SIRE)</strong> se generará en formato UTF-8 delimitado por punto y coma.<br><br>
          <strong style="color:#ef4444;">⚠ REGLA CRÍTICA:</strong> NO vuelvas a abrir el archivo exportado con <strong>Microsoft Excel</strong> en tu PC, ya que este programa reformatea y corrompe de manera silenciosa las fechas (convirtiéndolas a barras invertidas) y los CUITs (los convierte a notación científica).
        </p>
        <div style="display:flex; gap:12px;">
          <button id="btn-cancel-csv-dl" style="flex:1; padding:10px 16px; border:1px solid var(--border-color); border-radius:8px; background:#fff; color:var(--text-secondary); font-weight:600; cursor:pointer; font-size:13px; transition:background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#fff'">Cancelar</button>
          <button id="btn-confirm-csv-dl" style="flex:1; padding:10px 16px; border:none; border-radius:8px; background:linear-gradient(135deg, var(--color-accent), #4f46e5); color:#fff; font-weight:600; cursor:pointer; font-size:13px; box-shadow:0 4px 12px rgba(22,163,74,0.25);" onmouseover="this.style.opacity='0.95'" onmouseout="this.style.opacity='1'">Descargar CSV</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons({ root: modal });

    // Animación de entrada
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.querySelector('.csv-warning-card').style.transform = 'scale(1)';
    }, 20);

    const closeModal = () => {
      modal.style.opacity = '0';
      modal.querySelector('.csv-warning-card').style.transform = 'scale(0.9)';
      setTimeout(() => {
        if (modal.parentNode) document.body.removeChild(modal);
      }, 250);
    };

    modal.querySelector('#btn-cancel-csv-dl').addEventListener('click', closeModal);
    
    modal.querySelector('#btn-confirm-csv-dl').addEventListener('click', async () => {
      closeModal();

      const rets = await getRetencionesAsync(company.id);
      const bom = '\uFEFF';
      let csv = 'Fecha;CUIT Agente;Tipo;Numero Comprobante;Monto;Estado\n';

      rets.forEach(r => {
        const cuit = r.cuit.replace(/-/g, '');
        const tipo = r.tipo.includes('FACTURA') ? 'F' : 'O';
        const numDoc = tipo === 'F'
          ? r.id.replace('r', '').padStart(7, '0')
          : r.id.replace('r', '').padStart(16, '0');
        const fechaArr = r.fecha.split('-');
        const fechaFmt = `${fechaArr[2]}/${fechaArr[1]}/${fechaArr[0]}`;
        csv += `${fechaFmt};${cuit};${r.tipo};${numDoc};${r.monto.toFixed(2).replace('.',',')};${r.conciliado ? 'CONCILIADA' : 'PENDIENTE'}\n`;
      });

      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sire-retenciones-${company.cuit.replace(/-/g,'')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      mainApp.showToast('¡CSV del SIRE descargado con éxito!', 'success');
    });
  };

  document.getElementById('btn-export-csv-sire')?.addEventListener('click', exportarCSV);
  document.getElementById('btn-export-csv-sire-lateral')?.addEventListener('click', exportarCSV);

  // Agregar manual (tercera fuente de conciliación: retención/percepción que
  // el cliente informa a mano porque no llegó por factura ni por extracto bancario)
  document.getElementById('btn-add-ret')?.addEventListener('click', () => {
    const modal = document.createElement('div');
    modal.className = 'vmp-modal-overlay';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(15, 23, 42, 0.7)';
    modal.style.backdropFilter = 'blur(12px)';
    modal.style.webkitBackdropFilter = 'blur(12px)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.25s ease';

    modal.innerHTML = `
      <div style="background:#ffffff; border:1px solid rgba(15,23,42,0.1); border-radius:16px; padding:28px; max-width:420px; width:90%; box-shadow:0 25px 50px -12px rgba(15,23,42,0.25); transform:scale(0.9); transition:transform 0.25s ease;" class="add-ret-card">
        <h3 style="font-family:var(--font-heading); font-size:17px; font-weight:800; color:var(--text-primary); margin:0 0 4px 0;">Cargar Retención/Percepción Manual</h3>
        <p style="font-size:12px; color:var(--text-secondary); margin:0 0 18px 0;">Para comprobantes que el cliente informa a mano y que no llegaron por el Libro de Compras ni por el extracto bancario.</p>
        <form id="form-add-ret" style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="font-size:11px; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:4px;">Fecha</label>
              <input type="date" id="ret-fecha" class="form-input" style="width:100%; padding:8px 10px; font-size:12.5px;" value="${new Date().toISOString().slice(0,10)}" required>
            </div>
            <div>
              <label style="font-size:11px; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:4px;">Tipo</label>
              <select id="ret-tipo" class="form-input" style="width:100%; padding:8px 10px; font-size:12.5px;">
                <option value="PERCEPCIÓN IVA">Percepción IVA</option>
                <option value="RETENCIÓN IVA">Retención IVA</option>
                <option value="PERCEPCIÓN IIBB">Percepción IIBB</option>
                <option value="RETENCIÓN IIBB">Retención IIBB</option>
                <option value="RETENCIÓN GANANCIAS">Retención Ganancias</option>
                <option value="RETENCIÓN SIRCREB">Retención SIRCREB</option>
              </select>
            </div>
          </div>
          <div>
            <label style="font-size:11px; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:4px;">Agente de Retención/Percepción</label>
            <input type="text" id="ret-agente" class="form-input" style="width:100%; padding:8px 10px; font-size:12.5px;" placeholder="Razón social del agente" required>
          </div>
          <div style="display:grid; grid-template-columns:1.3fr 1fr; gap:10px;">
            <div>
              <label style="font-size:11px; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:4px;">CUIT del Agente</label>
              <input type="text" id="ret-cuit" class="form-input" style="width:100%; padding:8px 10px; font-size:12.5px;" placeholder="30-12345678-9" required>
            </div>
            <div>
              <label style="font-size:11px; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:4px;">Monto ($)</label>
              <input type="number" step="0.01" id="ret-monto" class="form-input font-mono" style="width:100%; padding:8px 10px; font-size:12.5px;" placeholder="0.00" required>
            </div>
          </div>
          <div style="display:flex; gap:12px; margin-top:6px;">
            <button type="button" id="btn-cancel-add-ret" style="flex:1; padding:10px 16px; border:1px solid var(--border-color); border-radius:8px; background:#fff; color:var(--text-secondary); font-weight:600; cursor:pointer; font-size:13px;">Cancelar</button>
            <button type="submit" style="flex:1; padding:10px 16px; border:none; border-radius:8px; background:var(--color-accent); color:#fff; font-weight:700; cursor:pointer; font-size:13px;">Guardar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons({ root: modal });

    setTimeout(() => {
      modal.style.opacity = '1';
      modal.querySelector('.add-ret-card').style.transform = 'scale(1)';
    }, 20);

    const closeModal = () => {
      modal.style.opacity = '0';
      modal.querySelector('.add-ret-card').style.transform = 'scale(0.9)';
      setTimeout(() => {
        if (modal.parentNode) document.body.removeChild(modal);
      }, 250);
    };

    modal.querySelector('#btn-cancel-add-ret').addEventListener('click', closeModal);

    modal.querySelector('#form-add-ret').addEventListener('submit', async (e) => {
      e.preventDefault();
      const monto = parseFloat(modal.querySelector('#ret-monto').value) || 0;
      if (monto <= 0) {
        mainApp.showToast('Ingresá un monto mayor a $ 0.', 'error');
        return;
      }
      const newRet = {
        id: 'r-manual-' + Date.now(),
        fecha: modal.querySelector('#ret-fecha').value,
        agente: modal.querySelector('#ret-agente').value.trim(),
        cuit: modal.querySelector('#ret-cuit').value.trim(),
        tipo: modal.querySelector('#ret-tipo').value,
        monto: monto,
        fuente: 'manual',
        conciliado: false,
        certDisponible: false
      };
      try {
        await addRetencionAsync(company.id, newRet);
        closeModal();
        mainApp.showToast('Retención/percepción manual cargada. Quedó pendiente de conciliar.', 'success');
        setTimeout(() => mainApp.router(), 260);
      } catch (err) {
        mainApp.showToast(`Error al guardar: ${err.message || err}`, 'error');
      }
    });
  });
}
