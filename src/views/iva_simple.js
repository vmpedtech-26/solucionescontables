/* -------------------------------------------------------------
   VMP Studio Contable — IVA Simple & Consola Monotributo
   Circuito completo de liquidación IVA (RI) y Control de Monotributo
   ------------------------------------------------------------- */
import { getActiveCompanyAsync, getTransactionsAsync, updateEmpresaFieldsAsync } from '../db/mockdb.js';
import { isSupabaseConfigured, supabase } from '../db/supabase.js';
import { getRetencionesAsync } from './retenciones.js';
import { MONOTRIBUTO_CATEGORIAS_2026, ventasMoviles12Meses, letraCategoria, consumoMonotributo, categoriaMonotributoRecomendada, calcularIvaRI, consistenciaCLAE } from '../domain/fiscal.js';
import { fmt, fmtDate, getVencimientos, downloadFile } from '../utils.js';
import { sanitizeInput as esc } from '../utils.js';
import { blockSimulated } from '../utils.js';

function getIvaConsistOk(company) {
  if (isSupabaseConfigured && supabase) return !!company.iva_consist_ok;
  return localStorage.getItem(`vmp_consist_ok_${company.id}`) === 'true';
}
function getIvaLibroImportado(company) {
  if (isSupabaseConfigured && supabase) return !!company.libro_iva_importado;
  return localStorage.getItem(`vmp_libro_importado_${company.id}`) === 'true';
}
// Override manual del saldo de retenciones/percepciones: null significa "no
// hay override, calcular a partir de la lista de retenciones conciliadas".
function getIvaRetPercManual(company) {
  if (isSupabaseConfigured && supabase) {
    return (company.ret_perc_saldo_manual === null || company.ret_perc_saldo_manual === undefined)
      ? null : Number(company.ret_perc_saldo_manual);
  }
  const v = localStorage.getItem(`vmp_ret_perc_saldo_${company.id}`);
  return v !== null ? parseFloat(v || '0') : null;
}
function getIvaSaldoFavor(company) {
  if (isSupabaseConfigured && supabase) return Number(company.saldo_favor_iva) || 0;
  return parseFloat(localStorage.getItem(`vmp_saldo_favor_${company.id}`) || '0');
}

// Economist CLAE simplified sectors
function getActividadesPorEmpresa(company) {
  const act = company.actividad?.toLowerCase() || '';
  if (act.includes('logísti') || act.includes('transport')) {
    return [
      { codigo: '494000', descripcion: 'Transporte automotor de carga', pct: 0.85, alicuota: 21 },
      { codigo: '522900', descripcion: 'Servicios auxiliares de transporte', pct: 0.15, alicuota: 21 },
    ];
  }
  if (act.includes('software') || act.includes('tecnolog') || act.includes('consult')) {
    return [
      { codigo: '620100', descripcion: 'Actividades de programación informática', pct: 0.70, alicuota: 21 },
      { codigo: '631100', descripcion: 'Procesamiento y hosting de datos', pct: 0.30, alicuota: 21 },
    ];
  }
  return [
    // La venta mayorista de productos de la canasta básica (pan, carnes, frutas y
    // verduras, leche fluida, etc.) tributa al 10,5% — no al 21% general — por lo
    // que un distribuidor de alimentos real casi siempre factura a dos alícuotas.
    { codigo: '464100', descripcion: 'Venta al por mayor de alimentos (canasta básica)', pct: 0.70, alicuota: 10.5 },
    { codigo: '479900', descripcion: 'Venta al por menor s/especificación', pct: 0.30, alicuota: 21 },
  ];
}

export async function renderIVASimple() {
  const company = await getActiveCompanyAsync();
  if (!company) {
    return `
    <div class="view-header">
      <div>
        <h1 class="view-title">IVA Simple — F.2051</h1>
        <p class="view-subtitle">Circuito de liquidación mensual de IVA.</p>
      </div>
    </div>
    <div class="card" style="text-align: center; padding: 48px 24px;">
      <p class="text-secondary" style="margin-bottom: 16px;">Todavía no cargaste ninguna empresa cliente.</p>
      <a href="#/studio/empresas" class="btn btn-primary" style="display: inline-flex;">Cargar primera empresa</a>
    </div>
    `;
  }
  const txs = await getTransactionsAsync(company.id);

  const isMonotributo = company.condicion_iva.includes('Monotributo');
  const mesActual = new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' });

  // -------------------------------------------------------------
  // DYNAMIC RENDERING FOR MONOTRIBUTISTAS (Régimen Simplificado)
  // -------------------------------------------------------------
  if (isMonotributo) {
    // 1. Parse active category letter (e.g. "Cat H")
    const activeLetter = letraCategoria(company.condicion_iva);
    const catDetails = MONOTRIBUTO_CATEGORIAS_2026[activeLetter] || MONOTRIBUTO_CATEGORIAS_2026['H'];

    // 2. Sum rolling 12-month sales (cutoff 365 days ago)
    const rollingSales = ventasMoviles12Meses(txs.ventas);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);
    const { topeExclusion, percentCategory, percentExclusion } = consumoMonotributo(rollingSales, activeLetter);

    // 3. Warning engine and insights
    let statusColor = 'var(--color-accent-light)'; // Green
    let statusBg = 'rgba(34, 197, 94, 0.04)';
    let statusBorder = 'rgba(34, 197, 94, 0.2)';
    let statusLabel = 'SALUDABLE';
    let statusInsight = `El nivel de facturación de tu cliente está bajo control. Se encuentra a un **${(100 - percentCategory).toFixed(1)}%** del tope de la Categoría ${activeLetter}. Facturación mensual sugerida: **$ ${(catDetails.maxIngresos / 12).toLocaleString('es-AR')}**.`;

    if (percentCategory >= 85 && percentCategory < 100) {
      statusColor = '#fbbf24'; // Orange
      statusBg = 'rgba(251, 191, 36, 0.04)';
      statusBorder = 'rgba(251, 191, 36, 0.2)';
      statusLabel = 'RIESGO DE RECATEGORIZACIÓN';
      statusInsight = `⚠️ **¡Alerta!** El cliente ha facturado el **${percentCategory.toFixed(1)}%** del tope de su categoría. En el próximo semestre fiscal deberá recategorizarse hacia una categoría superior. Límite de facturación recomendado por mes: **$ ${((catDetails.maxIngresos - rollingSales) / 2).toLocaleString('es-AR')}** para atenuar saltos bruscos.`;
    } else if (percentCategory >= 100 || percentExclusion >= 90) {
      statusColor = '#ef4444'; // Red
      statusBg = 'rgba(239, 68, 68, 0.04)';
      statusBorder = 'rgba(239, 68, 68, 0.2)';
      statusLabel = '🔴 RIESGO CRÍTICO DE EXCLUSIÓN';
      statusInsight = `🚨 **ALERTA MÁXIMA CPN:** El contribuyente ha facturado **$ ${rollingSales.toLocaleString('es-AR')}** en los últimos 12 meses móviles. Esto supera el tope de su Categoría (${activeLetter}) y está al **${percentExclusion.toFixed(1)}%** de la exclusión absoluta del Régimen Simplificado ($ ${topeExclusion.toLocaleString('es-AR')}). Recordá que la exclusión de oficio es **retroactiva al momento en que se produjo la causal**, no desde que ARCA la detecta, y que también hay causales no vinculadas a la facturación (compras/gastos o depósitos bancarios incompatibles con lo declarado, más de 3 unidades de explotación, precio unitario de venta superior al tope). **Riesgo inminente de pase de oficio al Régimen General con severas multas retroactivas. Se recomienda detener la facturación.**`;
    }

    return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Consola de Control de Monotributo</h1>
        <p class="view-subtitle">Monitoreo continuo de exclusión, límites de categorías y recategorización semestral.</p>
      </div>
      <div style="background: rgba(22, 163, 74, 0.08); border: 1px solid rgba(22, 163, 74, 0.2); padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: var(--color-accent-light);">
        Contribuyente: ${esc(company.razon_social)} (${esc(company.condicion_iva)})
      </div>
    </div>

    <!-- Metrics row -->
    <div class="grid-resp-3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
      <div class="card" style="margin-bottom:0;">
        <div class="card-body" style="padding: 16px;">
          <div style="font-size: 10px; font-weight:800; color: var(--text-muted); text-transform: uppercase;">Facturado 12 Meses Móviles</div>
          <div class="font-mono" style="font-size: 26px; font-weight: 850; color: var(--color-primary); margin-top: 6px;">
            $ ${rollingSales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Desde: ${cutoffDate.toLocaleDateString('es-AR')}</div>
        </div>
      </div>
      
      <div class="card" style="margin-bottom:0;">
        <div class="card-body" style="padding: 16px;">
          <div style="font-size: 10px; font-weight:800; color: var(--text-muted); text-transform: uppercase;">Tope Categoría ${activeLetter}</div>
          <div class="font-mono" style="font-size: 26px; font-weight: 850; color: var(--color-accent); margin-top: 6px;">
            $ ${catDetails.maxIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Consumido: <strong>${percentCategory.toFixed(1)}%</strong></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:0;">
        <div class="card-body" style="padding: 16px;">
          <div style="font-size: 10px; font-weight:800; color: var(--text-muted); text-transform: uppercase;">Tope de Exclusión Simplificado</div>
          <div class="font-mono" style="font-size: 26px; font-weight: 850; color: #e11d48; margin-top: 6px;">
            $ ${topeExclusion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Tope de Categoría K (venta de bienes)</div>
        </div>
      </div>
    </div>

    <!-- Health alert and rolling chart progress bar -->
    <div class="card" style="border-color: ${statusBorder}; background: ${statusBg}; margin-bottom: 24px;">
      <div class="card-body">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="font-size: 13.5px; font-weight: 800; color: ${statusColor}; text-transform: uppercase; margin: 0; display:flex; align-items:center; gap:6px;">
            <i data-lucide="shield-alert"></i> Diagnóstico Impositivo CPN: ${statusLabel}
          </h4>
          <span style="font-size: 11px; font-weight:700; color: ${statusColor};">${percentCategory.toFixed(1)}% de Cat ${activeLetter}</span>
        </div>
        <p style="font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); margin-bottom: 16px;">
          ${statusInsight}
        </p>

        <!-- Dynamic progress bar -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="width: 100%; height: 12px; background: rgba(0,0,0,0.05); border: 1px solid var(--border-color); border-radius: var(--radius-full); overflow: hidden; position: relative;">
            <div style="width: ${Math.min(100, percentCategory)}%; height: 100%; background: ${statusColor}; transition: width 0.3s; border-radius: var(--radius-full);"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: var(--text-muted); font-weight: 600;">
            <span>$ 0</span>
            <span>Límite Cat ${activeLetter}: $ ${catDetails.maxIngresos.toLocaleString('es-AR')}</span>
            <span>Exclusión Máxima (Cat K): $ ${topeExclusion.toLocaleString('es-AR')}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Causales de exclusión de oficio no vinculadas a la facturación (Art. 20, Ley 24.977) -->
    <div class="card" style="border-left: 3px solid #ef4444; margin-bottom: 24px;">
      <div class="card-body" style="padding: 16px 20px;">
        <h4 style="font-size: 12.5px; font-weight: 800; color: var(--text-primary); margin: 0 0 8px 0; display:flex; align-items:center; gap:6px;">
          <i data-lucide="alert-triangle" style="width:15px; height:15px; color:#ef4444;"></i> Otras causales de exclusión de oficio (más allá de superar la facturación)
        </h4>
        <p style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.6; margin: 0;">
          Compras, gastos o inversiones incompatibles con los ingresos declarados · Depósitos bancarios incompatibles con lo declarado ·
          Más de 3 actividades simultáneas o 3 unidades de explotación · Precio unitario de venta superior al tope de la última categoría (venta de bienes) ·
          Adquisición de bienes o realización de gastos personales injustificados. La exclusión, cuando se detecta, opera de forma
          <strong>retroactiva</strong> al momento en que efectivamente se produjo la causal — no desde la fecha en que ARCA la detecta.
        </p>
      </div>
    </div>

    <!-- Semestral Recategorization Assistant & History -->
    <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 24px; align-items: start;">
      
      <!-- Recategorization Assistant Form -->
      <div class="card" style="margin-bottom:0;">
        <div class="card-header">
          <h3><i data-lucide="calculator" style="color: var(--color-accent);"></i> Asistente de Recategorización Semestral (Julio 2026)</h3>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="font-size:12.5px; margin-bottom: 16px;">
            Ingresá los parámetros de los últimos 12 meses para calcular de forma matemática exacta la categoría de monotributo recomendada.
          </p>

          <form id="recat-assistant-form" style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-secondary);">Ingresos Acumulados ($)</label>
                <input type="number" id="recat-ingresos" class="form-input" style="width: 100%; padding: 6px 10px; font-size:12px;" value="${rollingSales}">
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-secondary);">Energía Consumida (kWh)</label>
                <input type="number" id="recat-energia" class="form-input" style="width: 100%; padding: 6px 10px; font-size:12px;" value="1200">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-secondary);">Alquileres Devengados ($)</label>
                <input type="number" id="recat-alquileres" class="form-input" style="width: 100%; padding: 6px 10px; font-size:12px;" value="800000">
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-secondary);">Superficie Afectada (m²)</label>
                <input type="number" id="recat-superficie" class="form-input" style="width: 100%; padding: 6px 10px; font-size:12px;" value="24">
              </div>
            </div>

            <button type="button" id="btn-calculate-recat" class="btn btn-primary" style="background: var(--color-accent); border-color: var(--color-accent); font-weight: 700; height: 36px; display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 8px;">
              <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Evaluar Categoría Sugerida
            </button>
          </form>

          <!-- Result Suggestion Report Box -->
          <div id="recat-result-box" style="display: none; background: rgba(22, 163, 74, 0.03); border: 1.5px dashed rgba(22, 163, 74, 0.25); border-radius: var(--radius-sm); padding: 14px; margin-top: 16px;">
            <h4 style="font-size: 13px; font-weight: 800; color: var(--color-accent-light); margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
              <i data-lucide="check-square"></i> Dictamen y Categoría Sugerida
            </h4>
            <div id="recat-result-text" style="font-size: 12px; line-height: 1.4; color: var(--text-secondary);"></div>
          </div>
        </div>
      </div>

      <!-- Categories ceiling quick reference list -->
      <div class="card" style="margin-bottom:0;">
        <div class="card-header">
          <h3><i data-lucide="table" style="color: var(--color-accent);"></i> Tabla de Referencia Monotributo 2026</h3>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive" style="max-height: 290px; overflow-y: auto;">
            <table class="table table-sm" style="font-size: 11px;">
              <thead>
                <tr>
                  <th>Cat</th>
                  <th class="text-right">Límite Anual</th>
                  <th class="text-right">Cuota Serv.</th>
                  <th class="text-right">Cuota Bienes</th>
                </tr>
              </thead>
              <tbody>
                ${Object.keys(MONOTRIBUTO_CATEGORIAS_2026).map(k => {
                  const val = MONOTRIBUTO_CATEGORIAS_2026[k];
                  const isCurrent = k === activeLetter;
                  return `
                    <tr style="${isCurrent ? 'background: rgba(22, 163, 74, 0.08); font-weight: 800;' : ''}">
                      <td>Categoría ${k} ${isCurrent ? '🎯' : ''}</td>
                      <td class="font-mono text-right">$ ${val.maxIngresos.toLocaleString('es-AR')}</td>
                      <td class="font-mono text-right">${val.cuotaServicios > 0 ? '$ ' + val.cuotaServicios.toLocaleString('es-AR') : 'Excluido'}</td>
                      <td class="font-mono text-right">$ ${val.cuotaBienes.toLocaleString('es-AR')}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Descargo de responsabilidad CPN para producción -->
      <div style="margin-top: 24px; background: rgba(245, 158, 11, 0.03); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: var(--radius-sm); padding: 12px; display: flex; gap: 10px; align-items: flex-start;">
        <i data-lucide="alert-triangle" style="color: #fbbf24; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px;"></i>
        <div style="font-size: 11.5px; line-height: 1.4; color: var(--text-secondary);">
          <strong style="color: #fbbf24;">Descargo de Responsabilidad Profesional (CPN):</strong> Los diagnósticos de exclusión rolling y recategorización semestral de Monotributo sugeridos por este panel constituyen una herramienta técnica de simulación y estimación. Las recategorizaciones semestrales definitivas ante ARCA deben ser revisadas, convalidadas y cargadas formalmente en la plataforma fiscal oficial bajo el exclusivo criterio y matrícula del contador público interviniente.
        </div>
      </div>

    </div>
    `;
  }

  // -------------------------------------------------------------
  // STANDARD RENDERING FOR RESPONSABLES INSCRIPTOS (RI)
  // -------------------------------------------------------------
  // Reconciled retenciones (excluye cuenta puente de $ 6.080,75). Si el usuario
  // no fijó un override manual, se calcula a partir de la misma fuente que
  // Retenciones y Percepciones (Supabase real o sandbox), no de una copia propia.
  let retPercSaldo = 0;
  const userSetRet = getIvaRetPercManual(company);
  if (userSetRet !== null) {
    retPercSaldo = userSetRet;
  } else {
    const list = await getRetencionesAsync(company.id);
    retPercSaldo = list.filter(r => r.conciliado).reduce((sum, r) => sum + r.monto, 0);
  }

  const saldoFavor   = getIvaSaldoFavor(company);
  // Sandbox: el demo marca como "CUIT inactiva" a los proveedores terminados en 9
  // y no les computa credito. Con datos reales se computa todo el credito fiscal.
  const excluirCredito = isSupabaseConfigured ? null : (c) => c.cuit.replace(/[^0-9]/g, '').endsWith('9');
  const { debFiscal, credFiscal, saldoNeto } = calcularIvaRI({
    ventas: txs.ventas, compras: txs.compras, retPercSaldo, saldoFavor, excluirCredito
  });

  const venc      = getVencimientos(company.cuit);

  // CLAE mapping values
  const actividades = getActividadesPorEmpresa(company);
  const totalNetVentas = txs.ventas.reduce((s, v) => s + v.neto, 0);

  const { rows: actividadRows, totalActividadDF, diff: consistDiff, ok: consistOkCalc } =
    consistenciaCLAE(totalNetVentas, actividades, debFiscal);

  // Auto-validación si la diferencia es exactamente $ 0,00
  let consistenciaOk = getIvaConsistOk(company);
  if (consistDiff < 0.01 && !consistenciaOk) {
    if (isSupabaseConfigured && supabase) {
      await updateEmpresaFieldsAsync(company.id, { iva_consist_ok: true });
    } else {
      localStorage.setItem(`vmp_consist_ok_${company.id}`, 'true');
    }
    consistenciaOk = true;
  }

  const libroImportado = getIvaLibroImportado(company);

  const pasos = [
    { n:1, label:'Libros importados', icon:'upload',        done: libroImportado },
    { n:2, label:'Consistencia validada', icon:'check-circle', done: consistenciaOk },
    { n:3, label:'Ret./Perc. cargadas', icon:'percent',     done: retPercSaldo > 0 || saldoFavor > 0 },
    { n:4, label:'Presentación F.2051',  icon:'send',        done: false },
  ];

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">IVA Simple — F.2051</h1>
      <p class="view-subtitle">Circuito de liquidación mensual · ${mesActual}</p>
    </div>
    <div style="display:flex;gap:10px;align-items:center;">
      <div style="background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.2);padding:7px 14px;border-radius:var(--radius-sm);font-size:12px;font-weight:600;color:var(--color-accent-light);">
        CUIT: ${esc(company.cuit)}
      </div>
      <button class="btn btn-primary" id="btn-presentar-f2051" data-simulated="1" title="Simulación: no disponible todavía" ${!consistenciaOk ? 'disabled' : ''} style="${!consistenciaOk ? 'opacity:.45;cursor:not-allowed;' : ''}">
        <i data-lucide="send"></i> Presentar F.2051
      </button>
    </div>
  </div>

  <!-- Flow Steps -->
  <div style="display:flex;gap:0;margin-bottom:32px;">
    ${pasos.map((s, i) => `
      <div style="flex:1;display:flex;align-items:center;gap:0;">
        <div style="flex:1;text-align:center;position:relative;z-index:1;">
          <div style="width:40px;height:40px;border-radius:50%;border:2px solid ${s.done ? 'var(--color-accent)' : 'var(--border-color)'};background:${s.done ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.02)'};display:flex;align-items:center;justify-content:center;margin:0 auto 8px;color:${s.done ? 'var(--color-accent)' : 'var(--text-secondary)'};">
            <i data-lucide="${s.icon}" style="width:18px;height:18px;"></i>
          </div>
          <p style="font-size:11px;font-weight:600;color:${s.done ? 'var(--color-accent)' : 'var(--text-secondary)'};">${s.label}</p>
        </div>
        ${i < pasos.length - 1 ? `<div style="height:2px;width:100%;background:${s.done ? 'var(--color-accent)' : 'var(--border-color)'};flex:0.5;margin-bottom:20px;"></div>` : ''}
      </div>
    `).join('')}
  </div>

  <div style="display:grid;grid-template-columns:1.3fr 0.7fr;gap:24px;align-items:start;">

    <!-- Left Main Column -->
    <div style="display:flex;flex-direction:column;gap:24px;">

      <!-- Libros Importer -->
      <div class="card" id="card-import-libros" style="margin-bottom:0;">
        <div class="card-header">
          <h3><i data-lucide="upload-cloud" style="color:var(--color-accent);"></i> Importación de Libros IVA Digital</h3>
          ${libroImportado ? `<span style="font-size:10px;font-weight:700;color:var(--color-accent);display:flex;align-items:center;gap:4px;"><i data-lucide="check-circle-2" style="width:12px;height:12px;"></i> Importado</span>` : ''}
        </div>
        <div class="card-body">
          <p class="text-secondary" style="font-size:13px;margin-bottom:20px;">
            Importá los archivos <code>.txt</code> del Libro de Compras exportados por tu ERP (Sistar, SOS Contador, Holistor).
            Las <strong>ventas con CAE se precargan automáticamente</strong> desde ARCA.
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div class="import-area" id="drop-compras-cbte" style="padding:18px;margin:0;cursor:pointer;border-color:${libroImportado ? 'var(--color-accent)' : 'var(--border-color)'};background:${libroImportado ? 'rgba(34,197,94,0.02)' : 'rgba(255,255,255,0.01)'};">
              <i data-lucide="file-text" style="width:28px;height:28px;color:var(--color-accent);margin-bottom:8px;"></i>
              <h5 style="font-size:12px;font-weight:700;">LIBRO_IVA_COMPRAS_CBTE.txt</h5>
              <p style="font-size:9.5px;color:var(--text-secondary);margin-top:4px;">Comprobantes del Libro de Compras</p>
              <input type="file" id="file-compras-cbte" style="display:none;" accept=".txt,.zip">
            </div>
            <div class="import-area" id="drop-compras-ali" style="padding:18px;margin:0;cursor:pointer;border-color:${libroImportado ? 'var(--color-accent)' : 'var(--border-color)'};background:${libroImportado ? 'rgba(34,197,94,0.02)' : 'rgba(255,255,255,0.01)'};">
              <i data-lucide="percent" style="width:28px;height:28px;color:var(--color-accent);margin-bottom:8px;"></i>
              <h5 style="font-size:12px;font-weight:700;">LIBRO_IVA_COMPRAS_ALICUOTAS.txt</h5>
              <p style="font-size:9.5px;color:var(--text-secondary);margin-top:4px;">Alícuotas del Libro de Compras</p>
              <input type="file" id="file-compras-ali" style="display:none;" accept=".txt,.zip">
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button class="btn btn-outline" id="btn-simular-import-libro" data-simulated="1" title="Simulación: no disponible todavía" style="flex:1;">
              <i data-lucide="refresh-cw"></i> Sincronizar Libro Digital ARCA
            </button>
            ${libroImportado ? `
            <button class="btn btn-outline" id="btn-reset-libro" style="font-size:12px;padding:8px 12px;color:#f87171;border-color:rgba(239,68,68,0.2);">
              <i data-lucide="trash-2"></i>
            </button>` : ''}
          </div>
        </div>
      </div>

      <!-- Consistencia -->
      <div class="card" data-consist-ok-calc="${consistOkCalc}" style="border-color:${consistenciaOk ? 'rgba(34,197,94,0.3)' : consistOkCalc ? 'rgba(22,163,74,0.2)' : 'rgba(239,68,68,0.3)'}; margin-bottom:0;">
        <div class="card-header" style="background:${consistenciaOk ? 'rgba(34,197,94,0.02)' : consistOkCalc ? 'rgba(22,163,74,0.01)' : 'rgba(239,68,68,0.02)'};">
          <h3>
            <i data-lucide="${consistenciaOk ? 'check-circle-2' : 'bar-chart-2'}" style="color:${consistenciaOk ? 'var(--color-accent)' : 'var(--color-accent-light)'};"></i>
            Cuadrante de Consistencia de Débito Fiscal
          </h3>
          <span style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;background:${consistenciaOk ? 'rgba(34,197,94,0.1)' : consistOkCalc ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.1)'};color:${consistenciaOk ? 'var(--color-accent)' : consistOkCalc ? 'var(--color-accent-light)' : '#f87171'};border:1px solid ${consistenciaOk ? 'rgba(34,197,94,0.3)' : consistOkCalc ? 'rgba(22,163,74,0.2)' : 'rgba(239,68,68,0.3)'};">
            ${consistenciaOk ? '● VERDE — Validado' : consistOkCalc ? '○ Sin validar — Puede confirmar' : '● ROJO — Diferencia detectada'}
          </span>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="font-size:12.5px;margin-bottom:8px;">
            Distribución de ventas por actividad económica (CLAE). El débito fiscal calculado debe coincidir exactamente con el total del Libro de Ventas.
            <strong style="color:var(--color-accent-light);"> Sin validación verde, ARCA bloquea la presentación.</strong>
          </p>
          ${totalNetVentas === 0 ? `
          <div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:12.5px;background:rgba(255,255,255,0.02);border-radius:var(--radius-sm);margin-bottom:16px;">
            Sin ventas registradas en el período. Importá comprobantes para habilitar el cuadrante.
          </div>
          ` : ''}
          <div class="table-responsive">
            <table class="table table-sm" style="margin-bottom:16px;">
              <thead>
                <tr>
                  <th>Código CLAE</th>
                  <th>Descripción</th>
                  <th class="text-right">Neto Gravado</th>
                  <th class="text-right">Alíc.</th>
                  <th class="text-right">DF Calculado</th>
                </tr>
              </thead>
              <tbody>
                ${actividadRows.map(r => `
                <tr>
                  <td class="font-mono text-xs">${r.codigo}</td>
                  <td style="font-size:12.5px;">${esc(r.descripcion)} <span style="font-size:10px;color:var(--text-muted);">(${(r.pct*100).toFixed(0)}%)</span></td>
                  <td class="font-mono text-right">$ ${fmt(r.neto)}</td>
                  <td class="font-mono text-right">${r.alicuota}%</td>
                  <td class="font-mono text-right text-emerald">$ ${fmt(r.df)}</td>
                </tr>
                `).join('')}
                <tr style="background:rgba(255,255,255,0.02);font-weight:700;">
                  <td colspan="4" style="text-align:right;font-size:13px;">Total DF por Actividad:</td>
                  <td class="font-mono text-right text-emerald">$ ${fmt(totalActividadDF)}</td>
                </tr>
                <tr style="background:rgba(255,255,255,0.02);font-weight:700;">
                  <td colspan="4" style="text-align:right;font-size:13px;">DF Libro Ventas ARCA:</td>
                  <td class="font-mono text-right" style="color:#fbbf24;">$ ${fmt(debFiscal)}</td>
                </tr>
                <tr>
                  <td colspan="4" style="text-align:right;font-size:13px;font-weight:700;">Diferencia:</td>
                  <td class="font-mono text-right" style="font-weight:800;color:${consistDiff < 1 ? 'var(--color-accent)' : '#f87171'};">
                    ${consistDiff < 1 ? '$ 0,00 ✓' : `$ ${fmt(consistDiff)}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-outline" id="btn-recalc-consist" style="flex:1;">
              <i data-lucide="refresh-cw"></i> Recalcular
            </button>
            <button class="btn btn-primary" id="btn-validar-consist" style="flex:1;background:var(--color-accent);border-color:var(--color-accent);" ${consistenciaOk ? 'disabled style="opacity:.45;"' : ''}>
              <i data-lucide="check-circle-2"></i> ${consistenciaOk ? 'Ya validado ✓' : 'Validar Consistencia'}
            </button>
          </div>
          ${!consistOkCalc && !consistenciaOk ? `
          <p style="font-size:11.5px;color:#f87171;margin-top:12px;text-align:center;">
            Ajustá los porcentajes de distribución por actividad hasta que la diferencia sea $ 0,00 antes de validar.
          </p>` : ''}
        </div>
      </div>

      <!-- Retenciones/Percepciones -->
      <div class="card" style="margin-bottom:0;">
        <div class="card-header">
          <h3><i data-lucide="percent" style="color:#f59e0b;"></i> Retenciones y Percepciones</h3>
          <span class="badge" style="margin:0;font-size:10px;">SIRE (ex-SICORE)</span>
        </div>
        <div class="card-body">
          <div style="background:rgba(239,68,68,0.03);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:14px;font-size:12px;color:var(--text-secondary);">
            <strong style="color:#f87171;display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <i data-lucide="alert-octagon" style="width:14px;height:14px;"></i> Cuenta Puente Retenciones:
            </strong>
            Hay <strong>$ 6.080,75</strong> de percepciones suspendidas (sin cert. o no conciliadas) que <strong>NO se computan</strong> en este F.2051 para evitar rechazos de ARCA.
          </div>
          
          <div style="background:rgba(245,158,11,0.03);border:1px solid rgba(245,158,11,0.15);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:18px;font-size:12px;color:var(--text-secondary);">
            <strong style="color:#fbbf24;display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> Requisitos técnicos para CSV de percepciones (ARCA):
            </strong>
            <ul style="list-style:disc;padding-left:16px;display:flex;flex-direction:column;gap:4px;">
              <li>Asignar formato <strong>Texto</strong> a toda la planilla antes de ingresar datos.</li>
              <li>Orden de Pago: exactamente <strong>16 caracteres</strong>. Factura de Compra: entre <strong>5 y 8</strong>. Otro: exactamente <strong>16</strong>.</li>
              <li>Exportar como <strong>CSV UTF-8</strong> y NO volver a abrir con Excel.</li>
            </ul>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div>
              <label style="font-size:12px;font-weight:600;display:block;margin-bottom:8px;">Retenciones sufridas ($)</label>
              <input type="number" id="inp-ret-valor" placeholder="0.00" min="0" style="width:100%;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--color-primary);font-size:13px;" value="${retPercSaldo}">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;display:block;margin-bottom:8px;">Saldo técnico a favor ($)</label>
              <input type="number" id="inp-saldo-favor" placeholder="0.00" min="0" style="width:100%;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--color-primary);font-size:13px;" value="${saldoFavor}">
            </div>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-outline" id="btn-generar-csv-ret" style="flex:1;">
              <i data-lucide="download"></i> Generar CSV Percepciones
            </button>
            <button class="btn btn-outline" id="btn-guardar-ret" style="flex:1;">
              <i data-lucide="save"></i> Guardar Valores
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- Right Sidebar Column (RI) -->
    <div style="display:flex;flex-direction:column;gap:24px;">
      
      <!-- Liquidación Provisoria -->
      <div class="card" style="margin-bottom:0;">
        <div class="card-header" style="border-bottom:1px solid var(--border-color);">
          <h3><i data-lucide="scale" style="color:var(--color-accent);"></i> Liquidación Estimada</h3>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span class="text-secondary">Débito Fiscal (+)</span>
            <span class="font-mono" style="font-weight:700;color:#f87171;">$ ${fmt(debFiscal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span class="text-secondary">Crédito Fiscal (−)</span>
            <span class="font-mono" style="font-weight:700;color:#22c55e;">$ ${fmt(credFiscal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid var(--border-color);padding-bottom:8px;">
            <span class="text-secondary">Saldo a Favor / Ret. (−)</span>
            <span class="font-mono" style="font-weight:700;color:#fbbf24;">$ ${fmt(retPercSaldo + saldoFavor)}</span>
          </div>
          <div data-saldo-neto="${saldoNeto}" style="display:flex;justify-content:space-between;font-size:14.5px;font-weight:800;padding-top:4px;">
            <span style="color:var(--color-primary);">${saldoNeto >= 0 ? 'Saldo a Pagar ARCA' : 'Saldo Técnico Favor Contribuyente'}</span>
            <span class="font-mono" style="color:${saldoNeto >= 0 ? '#ef4444' : 'var(--color-accent-light)'};">$ ${fmt(Math.abs(saldoNeto))}</span>
          </div>
        </div>
      </div>

      <!-- Calendar obligations -->
      <div class="card" style="margin-bottom:0;">
        <div class="card-header">
          <h3><i data-lucide="calendar" style="color:var(--color-accent);"></i> Vencimiento Impositivo</h3>
        </div>
        <div class="card-body">
          <div style="background:rgba(22,163,74,0.03);border:1px solid rgba(22,163,74,0.15);border-radius:var(--radius-sm);padding:12px 14px;text-align:center;font-size:13px;">
            La fecha límite para la presentación de DDJJ y pago del saldo neto es el 
            <strong style="color:var(--color-accent-light);display:block;font-size:15px;margin-top:6px;">${venc.iva.dia} de Junio de 2026</strong>
          </div>
          <p style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:8px;margin-bottom:0;">
            (Calculado de forma exacta por terminación de CUIT: terminación en <strong>${company.cuit.slice(-1)}</strong>)
          </p>
        </div>
      </div>

    </div>

  </div>
  `;
}

export async function initIVASimple(mainApp) {
  if (window.lucide) window.lucide.createIcons();

  const company = await getActiveCompanyAsync();
  if (!company) return;
  const txs = await getTransactionsAsync(company.id);
  const isMonotributo = company.condicion_iva.includes('Monotributo');

  // -------------------------------------------------------------
  // LISTENERS FOR MONOTRIBUTO CONSOLE
  // -------------------------------------------------------------
  if (isMonotributo) {
    document.getElementById('btn-calculate-recat')?.addEventListener('click', (e) => {
      e.stopPropagation();
      
      const ingresos = Number(document.getElementById('recat-ingresos').value) || 0;
      const energia = Number(document.getElementById('recat-energia').value) || 0;
      const alquileres = Number(document.getElementById('recat-alquileres').value) || 0;
      const superficie = Number(document.getElementById('recat-superficie').value) || 0;

      // Calculate suggested category
      const recommendedCategory = categoriaMonotributoRecomendada({ ingresos, energia, alquileres, superficie });

      const resultBox = document.getElementById('recat-result-box');
      const resultText = document.getElementById('recat-result-text');

      resultBox.style.display = 'block';

      if (recommendedCategory === 'EXCLUIDO' || ingresos > MONOTRIBUTO_CATEGORIAS_2026['K'].maxIngresos) {
        resultText.innerHTML = `
          <strong style="color:#ef4444; font-size:13px; display:block; margin-bottom:4px;">🚨 EXCLUSIÓN RECOMENDADA</strong>
          Los ingresos declarados de **$ ${ingresos.toLocaleString('es-AR')}** superan los topes máximos de bienes y servicios del Monotributo. El contribuyente debe pasar obligatoriamente al **Régimen General (Responsable Inscripto)**.
        `;
        mainApp.showToast("Alerta: Contribuyente excedido del Régimen Simplificado.", "error");
      } else {
        const recommendedVal = MONOTRIBUTO_CATEGORIAS_2026[recommendedCategory];
        
        resultText.innerHTML = `
          <strong style="color:var(--color-accent-light); font-size:13px; display:block; margin-bottom:4px;">🎯 CATEGORÍA SUGERIDA: CATEGORÍA ${recommendedCategory}</strong>
          De acuerdo a la simulación contable semestral:
          <ul style="list-style:disc; padding-left:14px; margin-top:6px; display:flex; flex-direction:column; gap:3px;">
            <li>Ingresos anuales: **$ ${ingresos.toLocaleString('es-AR')}** (Límite Cat ${recommendedCategory}: $ ${recommendedVal.maxIngresos.toLocaleString('es-AR')})</li>
            <li>Cuota mensual estimada para Servicios: **$ ${recommendedVal.cuotaServicios > 0 ? recommendedVal.cuotaServicios.toLocaleString('es-AR') : 'Excluido'}**</li>
            <li>Cuota mensual estimada para Bienes: **$ ${recommendedVal.cuotaBienes.toLocaleString('es-AR')}**</li>
          </ul>
          <p style="margin-top:6px; font-weight:700; color:var(--color-primary);">El trámite formal de recategorización debe realizarse en la web de ARCA con Clave Fiscal.</p>
        `;
        mainApp.showToast(`Cálculo finalizado: Categoría Sugerida ${recommendedCategory}`, "success");
      }
    });

    return; // Exit
  }

  // -------------------------------------------------------------
  // LISTENERS FOR RESPONSABLES INSCRIPTOS (F.2051)
  // -------------------------------------------------------------
  const btnRecalc = document.getElementById('btn-recalc-consist');
  const btnValidar = document.getElementById('btn-validar-consist');
  const btnPresentar = document.getElementById('btn-presentar-f2051');
  const btnGuardarRet = document.getElementById('btn-guardar-ret');
  const btnGenerarCSV = document.getElementById('btn-generar-csv-ret');
  
  const inpRet = document.getElementById('inp-ret-valor');
  const inpFavor = document.getElementById('inp-saldo-favor');

  // Recalcular
  btnRecalc?.addEventListener('click', (e) => {
    e.stopPropagation();
    mainApp.showToast('Recalculando consistencias impositivas...', 'info');
    mainApp.router();
  });

  // Validar consistencia
  btnValidar?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const consistOkCalc = document.querySelector('[data-consist-ok-calc]')?.dataset.consistOkCalc === 'true';
    if (!consistOkCalc) {
      mainApp.showToast('No se puede validar. La diferencia entre el débito del libro y el calculado por actividad excede $ 1,00.', 'error');
      return;
    }
    if (isSupabaseConfigured && supabase) {
      await updateEmpresaFieldsAsync(company.id, { iva_consist_ok: true });
    } else {
      localStorage.setItem(`vmp_consist_ok_${company.id}`, 'true');
    }
    mainApp.showToast('¡Consistencia validada y registrada en ARCA! Cuadrante en VERDE.', 'success');
    mainApp.router();
  });

  // Guardar Retenciones
  btnGuardarRet?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const retVal = parseFloat(inpRet.value) || 0;
    const favorVal = parseFloat(inpFavor.value) || 0;

    if (isSupabaseConfigured && supabase) {
      await updateEmpresaFieldsAsync(company.id, { ret_perc_saldo_manual: retVal, saldo_favor_iva: favorVal });
    } else {
      localStorage.setItem(`vmp_ret_perc_saldo_${company.id}`, retVal.toString());
      localStorage.setItem(`vmp_saldo_favor_${company.id}`, favorVal.toString());
    }

    mainApp.showToast('Retenciones y Saldos a Favor actualizados en el panel contable.', 'success');
    mainApp.router();
  });

  // Generar CSV Percepciones
  btnGenerarCSV?.addEventListener('click', (e) => {
    e.stopPropagation();
    const retVal = parseFloat(inpRet.value) || 0;
    const csvContent = `Fecha;Código Impuesto;Régimen;Tipo Comprobante;Número Comprobante;CUIT Agente;Monto Sufrido\n24/05/2026;767;217;01;0003-00000850;30-58930219-4;${retVal.toFixed(2)}`;
    downloadFile(`SIRE-PERCEPCIONES-IVA-${company.cuit}-${new Date().toISOString().slice(0,10)}.csv`, csvContent, 'text/csv');
    mainApp.showToast('¡Archivo CSV del SIRE generado con formato de 16 caracteres!', 'success');
  });

  // Presentar F.2051 con simulación de ARCA Live, fallos de red y reintentos
  btnPresentar?.addEventListener('click', (e) => {
    if (blockSimulated(mainApp, 'La presentación del F.2051 ante ARCA')) return;
    e.stopPropagation();

    // Leer el saldo neto ya calculado y mostrado en el panel "Liquidación Estimada"
    const saldoNeto = parseFloat(document.querySelector('[data-saldo-neto]')?.dataset.saldoNeto || '0');

    // Crear el overlay del modal
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
      <div style="background:#ffffff; border:1px solid rgba(15,23,42,0.1); border-radius:16px; padding:32px; max-width:460px; width:90%; box-shadow:0 25px 50px -12px rgba(15,23,42,0.25); text-align:center; transform:scale(0.9); transition:transform 0.25s ease;" class="arca-modal-card">
        <div id="arca-loading-state" style="display:flex; flex-direction:column; gap:16px; align-items:center;">
          <div class="spinner" style="border-left-color:var(--color-accent); width:44px; height:44px; margin-bottom:8px; border-radius:50%; animation: spin 1s linear infinite;"></div>
          <h4 id="arca-progress-title" style="font-family:var(--font-heading); font-size:16px; font-weight:800; color:var(--text-primary); margin:0;">Iniciando conexión con ARCA Live...</h4>
          <p id="arca-progress-txt" style="font-size:12.5px; color:var(--text-secondary); line-height:1.5; margin:0; max-width:320px;">Estableciendo canal cifrado SSL con los servidores del fisco...</p>
        </div>

        <div id="arca-failure-state" style="display:none; flex-direction:column; gap:16px; align-items:center;">
          <div style="background:rgba(239,68,68,0.08); color:#ef4444; width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
            <i data-lucide="alert-triangle" style="width:28px; height:28px;"></i>
          </div>
          <h4 style="font-family:var(--font-heading); font-size:17px; font-weight:800; color:#ef4444; margin:0;">Error en la Presentación F.2051</h4>
          <p style="font-size:13px; color:var(--text-secondary); line-height:1.5; margin:0;">
            El servidor de ARCA Live (ex-AFIP) no responde en el tiempo de espera legal.<br>
            <span style="font-family:monospace; background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11.5px; color:#ef4444; margin-top:8px; display:inline-block;">HTTP/1.1 504 Gateway Timeout (ARCA-WS-12)</span>
          </p>
          <div style="display:flex; gap:12px; width:100%; margin-top:8px;">
            <button id="btn-cancel-arca" style="flex:1; padding:10px 16px; border:1px solid var(--border-color); border-radius:8px; background:#fff; color:var(--text-secondary); font-weight:600; cursor:pointer; font-size:13px;">Cancelar</button>
            <button id="btn-retry-arca" style="flex:1; padding:10px 16px; border:none; border-radius:8px; background:linear-gradient(135deg, var(--color-accent), #4f46e5); color:#fff; font-weight:600; cursor:pointer; font-size:13px; box-shadow:0 4px 12px rgba(22,163,74,0.25);">Reintentar Envío</button>
          </div>
        </div>

        <div id="arca-success-state" style="display:none; flex-direction:column; gap:16px; align-items:center;">
          <div style="background:rgba(34,197,94,0.08); color:var(--color-accent-light); width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
            <i data-lucide="check-circle" style="width:28px; height:28px;"></i>
          </div>
          <h4 style="font-family:var(--font-heading); font-size:18px; font-weight:800; color:var(--color-accent-light); margin:0;">DDJJ Presentada Exitosamente</h4>
          
          <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:10px; padding:16px; width:100%; text-align:left; font-size:12px; box-sizing:border-box;">
            <div style="font-weight:700; color:var(--text-secondary); border-bottom:1px dashed var(--border-color); padding-bottom:6px; margin-bottom:8px; font-size:13px;">ACUSE DE RECIBO OFICIAL (ARCA)</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span class="text-secondary">Trámite Nro:</span>
              <strong class="font-mono" style="color:var(--text-primary);">ARCA-F2051-${Math.floor(100000000 + Math.random() * 900000000)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span class="text-secondary">Fecha y Hora:</span>
              <strong class="font-mono" style="color:var(--text-primary);">${new Date().toLocaleString('es-AR')}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span class="text-secondary">Contribuyente:</span>
              <strong style="color:var(--text-primary);">${esc(company.razon_social)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span class="text-secondary">Período Fiscal:</span>
              <strong class="font-mono" style="color:var(--text-primary);">Mayo 2026</strong>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px dashed var(--border-color); padding-top:6px; margin-top:8px;">
              <span class="text-secondary">Saldo a Pagar:</span>
              <strong class="font-mono text-emerald" style="font-size:12.5px;">$ ${Math.round(saldoNeto).toLocaleString('es-AR')}</strong>
            </div>
            <div style="margin-top:12px; font-size:9.5px; color:var(--text-muted); line-height:1.4; word-break:break-all;">
              <strong>HASH SHA-256:</strong><br>
              e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
            </div>
          </div>

          <button id="btn-close-arca" class="btn btn-primary w-full" style="background:var(--color-accent); border-color:var(--color-accent); font-weight:700; height:40px; cursor:pointer;">
            Entendido
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons({ root: modal });

    // Animación de entrada
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.querySelector('.arca-modal-card').style.transform = 'scale(1)';
    }, 20);

    const runTransmission = (simulateFailure = true) => {
      if (!document.body.contains(modal)) return;
      document.getElementById('arca-loading-state').style.display = 'flex';
      document.getElementById('arca-failure-state').style.display = 'none';
      document.getElementById('arca-success-state').style.display = 'none';

      const title = document.getElementById('arca-progress-title');
      const text = document.getElementById('arca-progress-txt');

      setTimeout(() => {
        if (!document.body.contains(modal)) return;
        title.textContent = "Transmitiendo datos XML a ARCA...";
        text.textContent = "Subiendo liquidación F.2051 con desglose de CLAE y débitos/créditos...";

        setTimeout(async () => {
          if (!document.body.contains(modal)) return;
          if (simulateFailure) {
            document.getElementById('arca-loading-state').style.display = 'none';
            document.getElementById('arca-failure-state').style.display = 'flex';
          } else {
            document.getElementById('arca-loading-state').style.display = 'none';
            document.getElementById('arca-success-state').style.display = 'flex';

            if (isSupabaseConfigured && supabase) {
              await updateEmpresaFieldsAsync(company.id, { f2051_presentado: true, iva_consist_ok: false, libro_iva_importado: false });
            } else {
              localStorage.setItem(`vmp_f2051_presented_${company.id}`, 'true');
              localStorage.removeItem(`vmp_consist_ok_${company.id}`);
              localStorage.removeItem(`vmp_libro_importado_${company.id}`);
            }
          }
        }, 1500);

      }, 1500);
    };

    // La primera vez simulamos un fallo del webservice
    runTransmission(true);

    modal.querySelector('#btn-cancel-arca').addEventListener('click', () => {
      modal.style.opacity = '0';
      modal.querySelector('.arca-modal-card').style.transform = 'scale(0.9)';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 250);
    });

    modal.querySelector('#btn-retry-arca').addEventListener('click', (e) => {
      e.stopPropagation();
      mainApp.showToast('Reintentando transmisión F.2051...', 'info');
      runTransmission(false); // Segunda vez tiene éxito
    });

    modal.querySelector('#btn-close-arca').addEventListener('click', (e) => {
      e.stopPropagation();
      modal.style.opacity = '0';
      modal.querySelector('.arca-modal-card').style.transform = 'scale(0.9)';
      setTimeout(() => {
        document.body.removeChild(modal);
        mainApp.showToast('¡F.2051 presentado oficialmente y acuse registrado!', 'success');
        mainApp.router();
      }, 250);
    });
  });

  // Simulate Import Books
  document.getElementById('btn-simular-import-libro')?.addEventListener('click', (e) => {
    if (blockSimulated(mainApp, 'La sincronización del Libro IVA Digital con ARCA')) return;
    e.stopPropagation();
    mainApp.showToast('Sincronizando libros con el portal de ARCA...', 'info');
    setTimeout(async () => {
      if (isSupabaseConfigured && supabase) {
        await updateEmpresaFieldsAsync(company.id, { libro_iva_importado: true });
      } else {
        localStorage.setItem(`vmp_libro_importado_${company.id}`, 'true');
      }
      mainApp.showToast('¡Libros sincronizados de forma exitosa!', 'success');
      mainApp.router();
    }, 1000);
  });

  document.getElementById('btn-reset-libro')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (isSupabaseConfigured && supabase) {
      await updateEmpresaFieldsAsync(company.id, { libro_iva_importado: false });
    } else {
      localStorage.removeItem(`vmp_libro_importado_${company.id}`);
    }
    mainApp.showToast('Libros contables restablecidos.', 'info');
    mainApp.router();
  });
}
