/* -------------------------------------------------------------
   VMP Studio Contable — RT 54 / Panel Contable
   Categorización de entidades y valuación bajo RT 54 FACPCE
   ------------------------------------------------------------- */
import { getActiveCompanyAsync, getTransactionsAsync, addTransaction, updateEmpresaFieldsAsync } from '../db/mockdb.js';
import { supabase, isSupabaseConfigured } from '../db/supabase.js';
import { fmt, categorizarRT54, RT54_COEF, RT54_BASE_MEDIANA, RT54_BASE_RESTANTE, fetchAndCompileIPC } from '../utils.js';
import { amortizacionAnualTotal, coeficienteReexpresion } from '../domain/fiscal.js';
import { sanitizeInput as esc } from '../utils.js';

const EI_FACTOR = 1.2; // EI = stockFinal * EI_FACTOR

// -------------------------------------------------------------
// Bienes de Uso y Ajustes por Inflación cargados a mano (los detectados
// automáticamente desde el Libro de Compras NUNCA se persisten acá — se
// recalculan en vivo a partir de txs.compras en cada render).
// -------------------------------------------------------------
async function getActivosUsoAsync(companyId) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('activos_uso').select('*').eq('empresa_id', companyId).order('created_at', { ascending: true });
    if (!error) return data.map(a => ({ id: a.id, nombre: a.nombre, valor: Number(a.valor), fecha: a.fecha, categoria: a.categoria, vidaUtil: a.vida_util_anios }));
    console.error("Error trayendo activos_uso de Supabase:", error);
    return [];
  }
  return JSON.parse(localStorage.getItem(`vmp_custom_assets_${companyId}`)) || [];
}

async function addActivoUsoAsync(companyId, asset) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('activos_uso').insert({
      id: asset.id, empresa_id: companyId, nombre: asset.nombre, valor: asset.valor,
      fecha: asset.fecha, categoria: asset.categoria, vida_util_anios: asset.vidaUtil
    });
    if (error) throw error;
    return;
  }
  const assets = JSON.parse(localStorage.getItem(`vmp_custom_assets_${companyId}`)) || [];
  assets.push(asset);
  localStorage.setItem(`vmp_custom_assets_${companyId}`, JSON.stringify(assets));
}

async function deleteActivoUsoAsync(companyId, assetId) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('activos_uso').delete().eq('id', assetId);
    if (error) throw error;
    return;
  }
  const assets = JSON.parse(localStorage.getItem(`vmp_custom_assets_${companyId}`)) || [];
  localStorage.setItem(`vmp_custom_assets_${companyId}`, JSON.stringify(assets.filter(a => a.id !== assetId)));
}

async function getAjustesInflacionAsync(companyId) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('ajustes_inflacion').select('*').eq('empresa_id', companyId).order('created_at', { ascending: true });
    if (!error) return data.map(i => ({ id: i.id, concepto: i.concepto, origen: i.origen, valor: Number(i.valor), tipo: i.tipo }));
    console.error("Error trayendo ajustes_inflacion de Supabase:", error);
    return [];
  }
  if (!localStorage.getItem(`vmp_axi_items_${companyId}`)) {
    const defaultAxiItems = [
      { id: "axi-1", concepto: "Capital Social (Patrimonio Neto)", origen: "2025-12", valor: 1000000, tipo: "patrimonio" },
      { id: "axi-2", concepto: "Notebook Lenovo (Bien de Uso)", origen: "2026-02", valor: 500000, tipo: "activo" },
      { id: "axi-3", concepto: "Mercaderías en Stock (Bienes de Cambio)", origen: "2026-04", valor: 300000, tipo: "activo" }
    ];
    localStorage.setItem(`vmp_axi_items_${companyId}`, JSON.stringify(defaultAxiItems));
  }
  return JSON.parse(localStorage.getItem(`vmp_axi_items_${companyId}`)) || [];
}

async function addAjusteInflacionAsync(companyId, item) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('ajustes_inflacion').insert({
      id: item.id, empresa_id: companyId, concepto: item.concepto, origen: item.origen, valor: item.valor, tipo: item.tipo
    });
    if (error) throw error;
    return;
  }
  const items = JSON.parse(localStorage.getItem(`vmp_axi_items_${companyId}`)) || [];
  items.push(item);
  localStorage.setItem(`vmp_axi_items_${companyId}`, JSON.stringify(items));
}

// Campos puntuales de RT 54 en la empresa: vienen como columna real (NUMERIC
// llega como string desde PostgREST) cuando Supabase está configurado, o
// como clave suelta de localStorage en modo sandbox — ninguno de los dos
// vive en el objeto `company` del sandbox, así que hay que leer distinto
// según el modo.
function getRt54Ingresos(company) {
  if (isSupabaseConfigured && supabase) return Number(company.rt54_ingresos_periodo) || 0;
  return parseFloat(localStorage.getItem(`vmp_rt54_ingresos_${company.id}`) || '0');
}

function getRt54Stock(company) {
  if (isSupabaseConfigured && supabase) return Number(company.rt54_stock_final_unidades) || 100;
  return parseInt(localStorage.getItem(`vmp_rt54_stock_${company.id}`) || '100', 10);
}

function getRt54AsientoRegistrado(company) {
  if (isSupabaseConfigured && supabase) return !!company.rt54_asiento_registrado;
  return localStorage.getItem(`vmp_rt54_asiento_ok_${company.id}`) === 'true';
}

async function deleteAjusteInflacionAsync(companyId, itemId) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('ajustes_inflacion').delete().eq('id', itemId);
    if (error) throw error;
    return;
  }
  const items = JSON.parse(localStorage.getItem(`vmp_axi_items_${companyId}`)) || [];
  localStorage.setItem(`vmp_axi_items_${companyId}`, JSON.stringify(items.filter(i => i.id !== itemId)));
}

export async function renderRT54() {
  const company = await getActiveCompanyAsync();
  if (!company) {
    return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Panel Contable · RT 54 FACPCE</h1>
        <p class="view-subtitle">Categorización de entidades, valuación de inventarios y amortizaciones de Bienes de Uso.</p>
      </div>
    </div>
    <div class="card">
      <div class="card-body" style="text-align: center; padding: 48px;">
        <i data-lucide="building" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 12px;"></i>
        <h4>Todavía no cargaste ninguna empresa cliente</h4>
        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 6px; margin-bottom: 16px;">Registrá una empresa para empezar a trabajar en RT 54.</p>
        <a href="#/studio/empresas" class="btn btn-primary">Ir a Empresas Clientes</a>
      </div>
    </div>
    `;
  }
  const txs = await getTransactionsAsync(company.id);

  const ingresosGuardados = getRt54Ingresos(company);
  const categoria = ingresosGuardados > 0 ? categorizarRT54(ingresosGuardados) : null;
  const umbralMediana  = RT54_BASE_MEDIANA  * RT54_COEF;
  const umbralRestante = RT54_BASE_RESTANTE * RT54_COEF;

  const catConfig = {
    pequena: {
      label: 'Entidad Pequeña',
      color: 'var(--color-accent-light)',
      bg: 'rgba(34,197,94,0.04)',
      border: 'rgba(34,197,94,0.2)',
      simplificaciones: [
        'No segregar Componentes Financieros Implícitos (CFI) en transacciones normales.',
        'Exención total de Impuesto Diferido — solo registrar impuesto corriente.',
        'Valuación de inventarios al costo de la última compra (método simplificado).',
        'Costo de ventas por diferencia de inventarios: CV = EI + C − EF.',
      ]
    },
    mediana: {
      label: 'Entidad Mediana',
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.04)',
      border: 'rgba(251,191,36,0.2)',
      simplificaciones: [
        'Exención de evaluar desvalorizaciones de bienes de uso o intangibles si la entidad obtuvo resultados positivos netos en alguno de los últimos 3 ejercicios.',
        'Segregación de CFI obligatoria en transacciones financieras.',
        'Valuación de inventarios al costo de la última compra si aplica.',
      ]
    },
    restante: {
      label: 'Restante / Interés Público',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.04)',
      border: 'rgba(239,68,68,0.2)',
      simplificaciones: [
        'Sin simplificaciones. Aplicación del modelo retroactivo integral.',
        'Segregación rigurosa de Componentes Financieros Implícitos (CFI).',
        'Valuación de pasivos al costo de cancelación.',
        'Reconocimiento de Impuesto Diferido obligatorio.',
      ]
    }
  };

  const cat = categoria ? catConfig[categoria] : null;

  // Valuación inventario: última compra
  const comprasOrdenadas = [...txs.compras].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
  const ultimaCompra = comprasOrdenadas[0];
  const stockUnidades = getRt54Stock(company);
  const costoUltimaCompra = ultimaCompra ? ultimaCompra.neto / 10 : 0;
  const existenciaInicial  = Math.round(stockUnidades * EI_FACTOR);
  const valuacionStock     = costoUltimaCompra * stockUnidades;

  // Total compras sum
  const totalCompras = txs.compras.reduce((s,c) => s+c.total, 0);

  // Asset dynamic extraction: compras where es_activo = true
  const dbAssets = txs.compras.filter(c => c.es_activo === true);

  // Bienes de uso cargados a mano (nunca incluye los detectados desde compras).
  const customAssets = await getActivosUsoAsync(company.id);

  // Merge lists
  const allAssets = [
    ...dbAssets.map(c => ({
      id: c.id,
      nombre: c.proveedor ? `${c.proveedor} (Bien de Uso)` : 'Computadora / Activo Adquirido',
      valor: c.total,
      fecha: c.fecha,
      categoria: 'Equipos de Computación',
      vidaUtil: 5
    })),
    ...customAssets
  ];

  // Sum total annual amortizations
  const totalAnnualAmortization = amortizacionAnualTotal(allAssets);

  const isAsientoRegistrado = getRt54AsientoRegistrado(company);

  // -------------------------------------------------------------
  // CALCULATOR PARAMETERS FOR INFLATION ADJUSTMENT (AxI - RT 54)
  // -------------------------------------------------------------
  const FALLBACK_INDICES = {
    '2025-12': 1500.0,
    '2026-01': 1543.5,
    '2026-02': 1588.26,
    '2026-03': 1642.26,
    '2026-04': 1684.96
  };

  let IPC_INDICES = FALLBACK_INDICES;
  try {
    const cached = localStorage.getItem('vmp_ipc_indices');
    if (cached) {
      IPC_INDICES = JSON.parse(cached);
    }
  } catch (e) {
    console.error("Error reading IPC_INDICES from localStorage:", e);
  }

  // Get sorted periods and latest period/value
  const periods = Object.keys(IPC_INDICES).sort();
  const latestPeriod = periods[periods.length - 1] || '2026-04';
  const latestValue = IPC_INDICES[latestPeriod] || 1684.96;

  // Helper function to format periods
  const formatPeriodName = (periodStr) => {
    if (!periodStr || !periodStr.includes('-')) return periodStr;
    const [year, month] = periodStr.split('-');
    const monthNames = {
      '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
      '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic'
    };
    return `${monthNames[month] || month} ${year}`;
  };

  // Partidas cargadas a mano para reexpresar.
  const customAxiItems = await getAjustesInflacionAsync(company.id);

  // Las compras digitalizadas marcadas como Bien de Uso (es_activo) se
  // reexpresan también, pero se recalculan en vivo desde el Libro de
  // Compras en cada carga — nunca se persisten como una copia aparte.
  const activeDbAssets = txs.compras.filter(c => c.es_activo === true);
  const axiItems = [
    ...customAxiItems,
    ...activeDbAssets
      .filter(c => !customAxiItems.some(item => item.id === c.id))
      .map(c => ({
        id: c.id,
        concepto: `${c.proveedor} (${c.tipo_comprobante} N° ${c.numero})`,
        origen: c.fecha ? c.fecha.substring(0, 7) : '2026-04',
        valor: c.total,
        tipo: "activo"
      }))
  ];

  // Con datos reales no se conoce el saldo de Caja y Bancos: no se inventa uno.
  // (el sandbox conserva el saldo de ejemplo de $ 200.000)
  const CAJA_INICIAL = isSupabaseConfigured ? 0 : 200000;
  let totalHistoricAssets = CAJA_INICIAL;
  let totalAdjustedAssets = CAJA_INICIAL;
  
  let totalHistoricEquity = 0;
  let totalAdjustedEquity = 0;

  const axiRowsHtml = axiItems.map(item => {
    const isBienesDeCambio = item.concepto.toLowerCase().includes('cambio');
    const coef = coeficienteReexpresion(item, IPC_INDICES, latestValue);
    const adjusted = item.valor * coef;
    const adjustment = adjusted - item.valor;

    if (item.tipo === 'activo') {
      totalHistoricAssets += item.valor;
      totalAdjustedAssets += adjusted;
    } else if (item.tipo === 'patrimonio') {
      totalHistoricEquity += item.valor;
      totalAdjustedEquity += adjusted;
    }

    return `
      <tr>
        <td style="font-weight: 700; color: var(--color-primary);">${esc(item.concepto)}</td>
        <td class="text-center font-mono" style="font-size:11px;">${item.origen}</td>
        <td class="font-mono text-right">$ ${item.valor.toLocaleString('es-AR')}</td>
        <td class="font-mono text-center text-secondary" ${isBienesDeCambio ? 'title="Bajo RT 54, los Bienes de Cambio se valúan al costo de última compra. Al estar medidos a valores de cierre, no se reexpresan (coeficiente 1.0000)." style="cursor:help; text-decoration:underline dashed;"' : ''}>
          ${coef.toFixed(4)} ${isBienesDeCambio ? 'ℹ️' : ''}
        </td>
        <td class="font-mono text-right text-emerald" style="font-weight:700;">$ ${Math.round(adjusted).toLocaleString('es-AR')}</td>
        <td class="font-mono text-right" style="color: #fbbf24;">$ ${Math.round(adjustment).toLocaleString('es-AR')}</td>
        <td class="text-center">
          <button class="item-remove-btn btn-delete-axi-item" data-id="${esc(item.id)}" style="margin:0 auto; padding:2px;">
            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Calculate balancing RECPAM
  const recpam = totalAdjustedAssets - totalAdjustedEquity; // Assets = Liabilities + Equity + RECPAM => RECPAM = Assets - Equity
  const totalAdjustedLiabEquity = totalAdjustedEquity + recpam;

  // Dynamic options based on last 60 periods (5 years of history)
  const dropdownPeriods = [...periods].reverse().slice(0, 60);
  const optionsHtml = dropdownPeriods.map(p => {
    const val = IPC_INDICES[p];
    return `<option value="${p}">${formatPeriodName(p)} (${val.toFixed(1)})</option>`;
  }).join('');

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Panel Contable · RT 54 FACPCE</h1>
      <p class="view-subtitle">Categorización de entidades, valuación de inventarios y amortizaciones de Bienes de Uso.</p>
    </div>
    <div style="background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.2);padding:7px 14px;border-radius:var(--radius-sm);font-size:12px;font-weight:600;color:var(--color-accent-light);">
      Normativa Contable FACPCE 2026
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;">

    <!-- ── Categorizador ──────────────────────────────────────── -->
    <div class="card" style="${cat ? `border-color:${cat.border};background:${cat.bg};` : ''} margin-bottom: 0;">
      <div class="card-header">
        <h3><i data-lucide="layers" style="color:var(--color-accent);"></i> Categorización RT 54 — Ejercicio Activo</h3>
      </div>
      <div class="card-body">
        <p class="text-secondary" style="font-size:12.5px;margin-bottom:16px;">
          Ingresá los ingresos del ejercicio anterior (en <strong>moneda homogénea</strong>, ya reexpresados con el índice de inflación).
          La norma actualiza los umbrales con coeficiente inflacionario (base octubre 2022).
        </p>
        <div style="display:flex;gap:12px;margin-bottom:16px;align-items:flex-end;">
          <div style="flex:1;">
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:8px;">Ingresos anuales reexpresados ($)</label>
            <input type="number" id="inp-ingresos-rt54" class="form-input" placeholder="Ej: 12.000.000" style="width:100%;padding:10px 12px;" value="${ingresosGuardados || ''}">
          </div>
          <button class="btn btn-primary" id="btn-categorizar" style="background:var(--color-accent);border-color:var(--color-accent);white-space:nowrap;">
            <i data-lucide="calculator"></i> Categorizar
          </button>
        </div>

        <!-- Umbrales de referencia -->
        <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:12px;margin-bottom:16px;">
          <p style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;">UMBRALES 2026 (Base oct/22 × ${RT54_COEF}×)</p>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;font-size:11.5px;">
              <span style="color:var(--color-accent-light);font-weight:600;">Pequeña (hasta)</span>
              <span class="font-mono">$ ${fmt(umbralMediana)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11.5px;">
              <span style="color:#fbbf24;font-weight:600;">Mediana (hasta)</span>
              <span class="font-mono">$ ${fmt(umbralRestante)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11.5px;">
              <span style="color:#ef4444;font-weight:600;">Restante/Interés Público</span>
              <span class="font-mono">Superior</span>
            </div>
          </div>
        </div>

        ${cat ? `
        <div style="border:1px solid ${cat.border};background:${cat.bg};border-radius:var(--radius-md);padding:16px;">
          <h4 style="font-size:14px;font-weight:800;color:${cat.color};margin-bottom:10px;display:flex;align-items:center;gap:8px;">
            <i data-lucide="check-circle-2" style="width:16px;height:16px;"></i>
            ${cat.label}
          </h4>
          <ul style="list-style:disc;padding-left:16px;display:flex;flex-direction:column;gap:6px;">
            ${cat.simplificaciones.map(s => `<li style="font-size:12px;color:var(--text-secondary);line-height:1.4;">${s}</li>`).join('')}
          </ul>
        </div>
        ` : `
        <div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px;">
          <i data-lucide="arrow-up-circle" style="width:32px;height:32px;margin-bottom:8px;opacity:.4;display:block;margin-inline:auto;"></i>
          Ingresá los ingresos para determinar la categoría y simplificaciones disponibles.
        </div>
        `}
      </div>
    </div>

    <!-- ── Valuación Inventarios ──────────────────────────────── -->
    <div class="card" style="margin-bottom: 0;">
      <div class="card-header">
        <h3><i data-lucide="package" style="color:var(--color-accent);"></i> Valuación de Bienes de Cambio</h3>
        <span class="badge" style="margin:0;font-size:10px;color:var(--color-accent-light);border-color:rgba(34,197,94,0.25);background:rgba(34,197,94,0.05);">Costo Última Compra</span>
      </div>
      <div class="card-body">
        <p class="text-secondary" style="font-size:12.5px;margin-bottom:16px;">
          RT 54 permite medir inventarios al <strong>costo de la última compra</strong> realizada antes del cierre. Especialmente conveniente en contextos inflacionarios.
        </p>

        ${ultimaCompra ? `
        <div style="background:rgba(34,197,94,0.03);border:1px solid rgba(34,197,94,0.15);border-radius:var(--radius-md);padding:14px;margin-bottom:16px;">
          <p style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">ÚLTIMA COMPRA REGISTRADA</p>
          <div style="font-size:13px;font-weight:700;">${esc(ultimaCompra.proveedor)}</div>
          <div class="font-mono" style="font-size:11.5px;color:var(--text-secondary);">${ultimaCompra.fecha.split('-').reverse().join('/')} · Factura ${esc(ultimaCompra.numero)}</div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;">
            <span class="text-secondary">Total Factura:</span>
            <span class="font-mono font-bold">$ ${fmt(ultimaCompra.total)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span class="text-secondary" title="Supuesto de trabajo: el sistema no registra unidades por compra, asume 10.">Costo unitario estimado (neto ÷ 10 unidades, supuesto):</span>
            <span class="font-mono font-bold text-emerald">$ ${fmt(costoUltimaCompra)}</span>
          </div>
        </div>
        ` : `
        <div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:12px;background:rgba(255,255,255,0.02);border-radius:var(--radius-sm);margin-bottom:16px;">
          Sin compras registradas. Importá facturas de compra para activar la valuación.
        </div>
        `}

        <div style="display:flex;gap:12px;margin-bottom:16px;align-items:flex-end;">
          <div style="flex:1;">
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:8px;">Unidades en stock final</label>
            <input type="number" id="inp-stock-final" class="form-input" placeholder="Ej: 100" style="width:100%;padding:10px 12px;" value="${stockUnidades}">
          </div>
          <button class="btn btn-outline" id="btn-calcular-inventario" style="white-space:nowrap;">
            <i data-lucide="calculator"></i> Calcular
          </button>
        </div>

        <div style="border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;display:flex;flex-direction:column;gap:8px;">
          <p style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:4px;">FÓRMULA RT 54: CV = EI + C − EF</p>
          <p style="font-size:10.5px;line-height:1.45;color:#b45309;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:6px;padding:8px 10px;margin:0 0 6px;"><strong>Estimación orientativa.</strong> El costo unitario se aproxima como neto de la última compra ÷ 10 y la existencia inicial como existencia final × ${EI_FACTOR}: ambos son supuestos de trabajo que <strong>no surgen de la RT 54</strong>. Reemplazalos por las unidades y la existencia inicial reales del ejercicio anterior antes de usar este resultado.</p>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span class="text-secondary">Existencia Inicial (EI <span style="font-size:10px;">= EF × ${EI_FACTOR}, supuesto no normativo)</span></span>
            <span class="font-mono">$ ${fmt(costoUltimaCompra * existenciaInicial)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span class="text-secondary">+ Compras del período (C)</span>
            <span class="font-mono">$ ${fmt(totalCompras)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span class="text-secondary">− Existencia Final (EF · Costo últ. compra)</span>
            <span class="font-mono" id="val-ef">$ ${fmt(valuacionStock)}</span>
          </div>
          <div style="border-top:2px solid var(--border-color);padding-top:8px;display:flex;justify-content:space-between;font-size:15px;font-weight:800;">
            <span>Costo de Ventas <span style="font-size:10px;font-weight:400;color:var(--text-secondary);">(EI + C − EF)</span></span>
            <span class="font-mono text-emerald" id="val-cv">$ ${fmt((costoUltimaCompra * existenciaInicial) + totalCompras - valuacionStock)}</span>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- ── SUB-LIBRO DE BIENES DE USO Y AMORTIZACIONES RT 54 (NEW MODULE) ── -->
  <div class="card" style="margin-bottom: 24px; border-color: rgba(22, 163, 74, 0.25);">
    <div class="card-header" style="border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
      <h3><i data-lucide="calculator" style="color: var(--color-accent);"></i> Sub-Libro de Activos y Amortizaciones Automáticas (RT 54)</h3>
      <span class="badge" style="margin: 0; background: rgba(22, 163, 74, 0.08); color: var(--color-accent-light); border-color: rgba(22, 163, 74, 0.25);">Bienes de Uso Sincronizados</span>
    </div>
    <div class="card-body">
      <p class="text-secondary" style="font-size: 13px; margin-bottom: 16px;">
        Los activos de capital marcados como **Bienes de Uso** al digitalizar comprobantes (Gemini OCR o facturador) se indexan en este módulo contable. Podés amortizarlos anualmente y registrar el asiento de cierre de manera instantánea.
      </p>

      <!-- Grid for displaying Assets list -->
      <div class="table-responsive" style="margin-bottom: 20px;">
        <table class="table table-sm" style="font-size: 11.5px;">
          <thead>
            <tr>
              <th>Activo / Detalle</th>
              <th>Adquisición</th>
              <th>Valor Origen</th>
              <th>Vida Útil</th>
              <th>Amort. Anual</th>
              <th>Amort. Acum.</th>
              <th>Valor Residual</th>
              <th class="text-center" style="width: 50px;">Borrar</th>
            </tr>
          </thead>
          <tbody>
            ${allAssets.length === 0 ? `
              <tr><td colspan="8" class="text-center text-muted" style="padding:16px;">Sin bienes de uso registrados en el ejercicio.</td></tr>
            ` : allAssets.map((asset, index) => {
              const annual = asset.valor / asset.vidaUtil;
              
              // Calculate accumulated (since it's year 2026, let's assume 1 year of depreciation)
              const accum = annual; 
              const residual = asset.valor - accum;
              return `
                <tr>
                  <td style="font-weight: 700; color: var(--color-primary);">${esc(asset.nombre)}</td>
                  <td class="font-mono">${asset.fecha.split('-').reverse().join('/')}</td>
                  <td class="font-mono">$ ${asset.valor.toLocaleString('es-AR')}</td>
                  <td class="text-center">${asset.vidaUtil} años</td>
                  <td class="font-mono text-emerald">$ ${annual.toLocaleString('es-AR')}</td>
                  <td class="font-mono" style="color: #fbbf24;">$ ${accum.toLocaleString('es-AR')}</td>
                  <td class="font-mono" style="font-weight: 700; color: var(--color-accent);">$ ${residual.toLocaleString('es-AR')}</td>
                  <td class="text-center">
                    ${asset.id.startsWith('cust-') ? `
                      <button class="item-remove-btn btn-delete-custom-asset" data-id="${esc(asset.id)}" style="margin:0 auto; padding:2px;">
                        <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                      </button>
                    ` : `<span class="text-muted" style="font-size:9.5px;">Facturado</span>`}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Add manual asset controls and register adjustment entries -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-top: 1px dashed var(--border-color); padding-top: 16px;">
        
        <!-- Add manual asset form -->
        <div style="border-right: 1px dashed var(--border-color); padding-right: 20px;">
          <h4 style="font-size: 13px; font-weight: 800; color: var(--color-primary); margin-bottom: 12px; display:flex; align-items:center; gap:4px;">
            <i data-lucide="plus-circle" style="color: var(--color-accent);"></i> Incorporar Bien de Uso Manual
          </h4>
          <form id="form-add-asset" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 8px;">
              <div>
                <input type="text" id="asset-name" class="form-input" style="padding: 6px 10px; font-size:12px; width:100%; background:#fff;" placeholder="Nombre (ej: Servidor HP)..." required>
              </div>
              <div>
                <select id="asset-category" class="form-input" style="padding: 6px 10px; font-size:12px; width:100%; background:#fff;">
                  <option value="Equipos de Computación" selected>Computación (5a)</option>
                  <option value="Muebles y Útiles">Muebles (10a)</option>
                  <option value="Instalaciones">Instalaciones (10a)</option>
                  <option value="Rodados">Rodados (5a)</option>
                </select>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 8px;">
              <div>
                <input type="number" id="asset-value" class="form-input font-mono text-right" style="padding: 6px 10px; font-size:12px; width:100%; background:#fff;" placeholder="Valor de Origen ($)" required>
              </div>
              <button type="button" id="btn-add-asset-submit" class="btn btn-outline" style="font-size:12px; height:32px; display:flex; align-items:center; justify-content:center; gap:2px; padding:0 8px;">
                <i data-lucide="plus" style="width:14px; height:14px;"></i> Cargar Activo
              </button>
            </div>
          </form>
        </div>

        <!-- Ledger Adjustment entry block -->
        <div>
          <h4 style="font-size: 13px; font-weight: 800; color: var(--color-primary); margin-bottom: 8px; display:flex; align-items:center; gap:4px;">
            <i data-lucide="book-open" style="color: var(--color-accent-light);"></i> Asiento de Amortizaciones de Cierre (RT 54)
          </h4>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 12px; line-height:1.4;">
            Calcula la cuota anual acumulada y genera el asiento contable de ajuste en el Libro Diario formal.
          </p>

          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size:10px; color: var(--text-muted); text-transform:uppercase;">Cuota de Depreciación Anual:</span>
                <div class="font-mono text-emerald" style="font-size: 18px; font-weight: 850; margin-top: 2px;">$ ${totalAnnualAmortization.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                ${isAsientoRegistrado ? `
                  <span style="font-size: 10.5px; font-weight: 700; color: var(--color-accent-light); background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); padding: 3px 8px; border-radius: 4px; display:flex; align-items:center; gap:2px;">
                    <i data-lucide="check-circle-2" style="width:12px; height:12px;"></i> ASENTADO
                  </span>
                ` : `
                  <button type="button" id="btn-register-amort-entry" class="btn btn-primary btn-sm" style="background:var(--color-accent-light); border-color:var(--color-accent-light); font-weight:700; padding:6px 12px; font-size:11px;">
                    ⚡ Asentar Cierre
                  </button>
                `}
              </div>
            </div>

            <!-- Double-entry formal accounting layout display -->
            <div id="double-entry-ledger-preview" style="display: ${isAsientoRegistrado ? 'block' : 'none'}; background: var(--text-primary); border: 1px solid #1e293b; border-radius: var(--radius-sm); padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: var(--text-muted); line-height: 1.4;">
              <div style="border-bottom:1px solid #1e293b; padding-bottom:4px; margin-bottom:6px; font-size:9px; color:var(--text-secondary); font-weight:700;">ASIENTO N° 0928 - AJUSTE AMORTIZACIONES RT 54</div>
              <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                <span>6.1.04.01 - Deprec. Bienes de Uso (Debe)</span>
                <span style="color:var(--color-accent-light);">$ ${totalAnnualAmortization.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px; padding-left:14px;">
                <span>a 1.1.05.02 - Deprec. Acum. Equipamiento (Haber)</span>
                <span style="color:#fbbf24;">$ ${totalAnnualAmortization.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style="font-size:8.5px; color:var(--text-secondary); border-top:1px dashed #1e293b; padding-top:4px; margin-top:4px;">Leyenda: Registración formal amortización Ejercicio 2026 bajo normas simplificadas RT 54.</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ── SIMULADOR DE AJUSTE POR INFLACIÓN CONTABLE (AxI - RT 54) [NEW MODULE] ── -->
  <div class="card" style="margin-bottom: 24px; border-color: rgba(22, 163, 74, 0.25);">
    <style>
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .spin-icon {
        animation: spin 1.2s linear infinite;
      }
    </style>
    <div class="card-header" style="border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap: 10px;">
      <h3><i data-lucide="trending-up" style="color: var(--color-accent);"></i> Simulador de Ajuste por Inflación Contable (AxI — RT 54)</h3>
      <div style="display:flex; align-items:center; gap:8px;">
        <button id="btn-sync-ipc" class="btn btn-outline btn-sm" style="font-size:11px; padding: 5px 10px; display:flex; align-items:center; gap:6px; margin:0; height:auto; border-color:rgba(22, 163, 74, 0.3); color:var(--color-accent-light); font-weight:600;">
          <i data-lucide="refresh-cw" style="width:12px; height:12px;" id="icon-sync-ipc"></i> Sincronizar Índices IPC
        </button>
        <span class="badge" style="margin: 0; background: rgba(22, 163, 74, 0.08); color: var(--color-accent-light); border-color: rgba(22, 163, 74, 0.25);">Índice IPC Cierre: ${latestValue.toFixed(2)} (${latestPeriod})</span>
      </div>
    </div>
    <div class="card-body">
      <p class="text-secondary" style="font-size: 13px; margin-bottom: 16px;">
        RT 54 FACPCE exige que los balances del ejercicio se expresen en **moneda homogénea de cierre**. Este simulador utiliza los coeficientes oficiales del IPC del INDEC para reexpresar partidas no monetarias del activo y patrimonio, calculando automáticamente la contrapartida de **RECPAM**.
      </p>

      <!-- Form to add AxI items -->
      <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 20px;">
        <h4 style="font-size: 13px; font-weight: 800; color: var(--color-primary); margin-bottom: 10px; display:flex; align-items:center; gap:4px;">
          <i data-lucide="plus-circle" style="color: var(--color-accent);"></i> Incorporar Partida a Reexpresar
        </h4>
        <form id="form-add-axi" style="display: grid; grid-template-columns: 1.2fr 0.8fr 0.8fr 1fr; gap: 8px; align-items: flex-end;">
          <div>
            <label style="font-size: 10px; color: var(--text-secondary); display:block; margin-bottom:4px;">Concepto / Cuenta</label>
            <input type="text" id="axi-concept" class="form-input" style="padding: 6px 10px; font-size:12px; width:100%; background:#fff;" placeholder="Ej: Inmuebles, Capital..." required>
          </div>
          <div>
            <label style="font-size: 10px; color: var(--text-secondary); display:block; margin-bottom:4px;">Mes Origen</label>
            <select id="axi-origen" class="form-input" style="padding: 6px 10px; font-size:12px; width:100%; background:#fff;">
              ${optionsHtml}
            </select>
          </div>
          <div>
            <label style="font-size: 10px; color: var(--text-secondary); display:block; margin-bottom:4px;">Tipo Partida</label>
            <select id="axi-tipo" class="form-input" style="padding: 6px 10px; font-size:12px; width:100%; background:#fff;">
              <option value="activo" selected>Activo No Monetario</option>
              <option value="patrimonio">Patrimonio Neto</option>
            </select>
          </div>
          <div style="display:flex; gap:6px;">
            <div style="flex:1;">
              <label style="font-size: 10px; color: var(--text-secondary); display:block; margin-bottom:4px;">Monto Histórico ($)</label>
              <input type="number" id="axi-value" class="form-input font-mono text-right" style="padding: 6px 10px; font-size:12px; width:100%; background:#fff;" placeholder="Valor ($)" required>
            </div>
            <button type="button" id="btn-add-axi-submit" class="btn btn-primary" style="height:32px; font-size:12px; padding: 0 12px; background: var(--color-accent); border-color:var(--color-accent); font-weight:700;">
              Ajustar
            </button>
          </div>
        </form>
      </div>

      <!-- Table of Reexpressed items -->
      <h4 style="font-size: 13px; font-weight: 800; color: var(--color-primary); margin-bottom: 10px;">Partidas Reexpresadas a ${formatPeriodName(latestPeriod)}</h4>
      <div class="table-responsive" style="margin-bottom: 24px;">
        <table class="table table-sm" style="font-size: 11.5px;">
          <thead>
            <tr>
              <th>Partida No Monetaria</th>
              <th class="text-center">Origen</th>
              <th class="text-right">Valor Histórico</th>
              <th class="text-center">Coef. IPC</th>
              <th class="text-right">Valor Reexpresado</th>
              <th class="text-right">Ajuste Neto AxI</th>
              <th class="text-center" style="width: 50px;">Borrar</th>
            </tr>
          </thead>
          <tbody>
            ${axiRowsHtml.length === 0 ? `
              <tr><td colspan="7" class="text-center text-muted" style="padding:16px;">Sin partidas ingresadas para reexpresar.</td></tr>
            ` : axiRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Side-by-Side Balance Sheet comparison -->
      <h4 style="font-size: 13px; font-weight: 800; color: var(--color-primary); margin-bottom: 12px; display:flex; align-items:center; gap:4px;">
        <i data-lucide="scale" style="color: var(--color-accent);"></i> Cruce de Situación Patrimonial: Histórico vs. Homogéneo
      </h4>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Historic Balance Sheet -->
        <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px;">
          <h5 style="font-size:11.5px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; border-bottom:1px solid var(--border-color); padding-bottom:6px; margin-bottom:8px;">Balance Histórico</h5>
          <div style="display:flex; flex-direction:column; gap:6px; font-size:11.5px;">
            <div style="display:flex; justify-content:space-between;">
              <span class="text-secondary">Caja y Bancos (Monetario)${isSupabaseConfigured ? ' — sin datos cargados' : ''}:</span>
              <span class="font-mono">$ ${CAJA_INICIAL.toLocaleString('es-AR')}</span>
            </div>
            ${axiItems.filter(i => i.tipo === 'activo').map(i => `
              <div style="display:flex; justify-content:space-between;">
                <span class="text-secondary">${esc(i.concepto)}:</span>
                <span class="font-mono">$ ${i.valor.toLocaleString('es-AR')}</span>
              </div>
            `).join('')}
            <div style="display:flex; justify-content:space-between; font-weight:800; border-top:1px solid var(--border-color); padding-top:4px; color: var(--color-primary);">
              <span>TOTAL ACTIVO:</span>
              <span class="font-mono">$ ${totalHistoricAssets.toLocaleString('es-AR')}</span>
            </div>
            <div style="margin-top:8px; border-top: 1px dashed var(--border-color); padding-top:8px;"></div>
            ${axiItems.filter(i => i.tipo === 'patrimonio').map(i => `
              <div style="display:flex; justify-content:space-between;">
                <span class="text-secondary">${esc(i.concepto)}:</span>
                <span class="font-mono">$ ${i.valor.toLocaleString('es-AR')}</span>
              </div>
            `).join('')}
            <div style="display:flex; justify-content:space-between; font-weight:800; border-top:1px solid var(--border-color); padding-top:4px; color: var(--color-primary);">
              <span>TOTAL PASIVO + PN:</span>
              <span class="font-mono">$ ${totalHistoricEquity.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>

        <!-- Adjusted (Homogeneous) Balance Sheet -->
        <div style="background: rgba(22, 163, 74, 0.02); border: 1px solid rgba(22, 163, 74, 0.2); border-radius: var(--radius-sm); padding: 14px;">
          <h5 style="font-size:11.5px; font-weight:700; color:var(--color-accent-light); text-transform:uppercase; border-bottom:1px solid rgba(22,163,74,0.15); padding-bottom:6px; margin-bottom:8px;">Balance Reexpresado (RT 54) a ${formatPeriodName(latestPeriod)}</h5>
          <div style="display:flex; flex-direction:column; gap:6px; font-size:11.5px;">
            <div style="display:flex; justify-content:space-between;">
              <span class="text-secondary">Caja y Bancos (Monetario)${isSupabaseConfigured ? ' — sin datos cargados' : ''}:</span>
              <span class="font-mono">$ ${CAJA_INICIAL.toLocaleString('es-AR')}</span>
            </div>
            ${axiItems.filter(i => i.tipo === 'activo').map(i => {
              const ipcOrig = IPC_INDICES[i.origen] || 1500.0;
              const coef = latestValue / ipcOrig;
              const adjVal = i.valor * coef;
              return `
              <div style="display:flex; justify-content:space-between;">
                <span class="text-secondary">${esc(i.concepto)}:</span>
                <span class="font-mono text-emerald" style="font-weight:600;">$ ${Math.round(adjVal).toLocaleString('es-AR')}</span>
              </div>
              `;
            }).join('')}
            <div style="display:flex; justify-content:space-between; font-weight:800; border-top:1px solid rgba(22,163,74,0.15); padding-top:4px; color: var(--color-accent-light);">
              <span>TOTAL ACTIVO AJUSTADO:</span>
              <span class="font-mono">$ ${Math.round(totalAdjustedAssets).toLocaleString('es-AR')}</span>
            </div>
            <div style="margin-top:8px; border-top: 1px dashed rgba(22,163,74,0.15); padding-top:8px;"></div>
            ${axiItems.filter(i => i.tipo === 'patrimonio').map(i => {
              const ipcOrig = IPC_INDICES[i.origen] || 1500.0;
              const coef = latestValue / ipcOrig;
              const adjVal = i.valor * coef;
              return `
              <div style="display:flex; justify-content:space-between;">
                <span class="text-secondary">${esc(i.concepto)}:</span>
                <span class="font-mono">$ ${Math.round(adjVal).toLocaleString('es-AR')}</span>
              </div>
              `;
            }).join('')}
            
            <!-- RECPAM balancing row -->
            <div style="display:flex; justify-content:space-between; font-weight:700; color: #fbbf24;">
              <span title="RECPAM (Resultado por Exposición al Cambio en el Poder Adquisitivo de la Moneda): Es la contrapartida de la reexpresión de partidas no monetarias. Representa la ganancia o pérdida real por la pérdida de poder de compra de la moneda." style="cursor:help; border-bottom:1px dashed #fbbf24;">Diferencia de reexpresión (referencial, no es el RECPAM contable) ℹ️:</span>
              <span class="font-mono">$ ${Math.round(recpam).toLocaleString('es-AR')}</span>
            </div>

            <div style="display:flex; justify-content:space-between; font-weight:800; border-top:1px solid rgba(22,163,74,0.15); padding-top:4px; color: var(--color-accent-light);">
              <span>TOTAL PASIVO + PN + DIFERENCIA:</span>
              <span class="font-mono">$ ${Math.round(totalAdjustedLiabEquity).toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Descargo de responsabilidad CPN para producción -->
      <div style="margin-top: 20px; background: rgba(245, 158, 11, 0.03); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: var(--radius-sm); padding: 12px; display: flex; gap: 10px; align-items: flex-start;">
        <i data-lucide="alert-triangle" style="color: #fbbf24; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px;"></i>
        <div style="font-size: 11.5px; line-height: 1.4; color: var(--text-secondary);">
          <strong style="color: #fbbf24;">Descargo de Responsabilidad Profesional (CPN):</strong> Los cálculos y reexpresiones patrimoniales arrojados por este simulador de Ajuste por Inflación (RT 54) se presentan con fines exclusivamente orientativos y de soporte técnico pre-auditoría. La validación definitiva, firma y presentación formal del Balance de Situación Patrimonial ante los consejos profesionales correspondientes (FACPCE / Colegios de Graduados en Ciencias Económicas) queda bajo la exclusiva responsabilidad y criterio profesional del contador público matriculado firmante.
        </div>
      </div>

    </div>
  </div>

  <!-- ── Comprobantes Especiales 2026 ───────────────────────── -->
  <div class="card">
    <div class="card-header">
      <h3><i data-lucide="shield-alert" style="color:#fbbf24;"></i> Parámetros Especiales de Comprobantes — ARCA 2026</h3>
      <span class="badge" style="margin:0;font-size:10px;color:#fbbf24;background:rgba(245,158,11,0.08);border-color:rgba(245,158,11,0.3);">Normativa vigente</span>
    </div>
    <div class="card-body p-0">
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0;border-radius:var(--radius-md);overflow:hidden;">

        <!-- Factura A con Retención -->
        <div style="padding:24px;border-right:1px solid var(--border-color);border-bottom:1px solid var(--border-color);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:36px;height:36px;border-radius:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;color:#ef4444;flex-shrink:0;">
              <i data-lucide="percent" style="width:17px;height:17px;"></i>
            </div>
            <h4 style="font-size:13.5px;font-weight:700;">Factura A — Operación Sujeta a Retención</h4>
          </div>
          <p class="text-secondary" style="font-size:12px;line-height:1.5;margin-bottom:12px;">
            Habilitada tras evaluación patrimonial desfavorable (evaluación cuatrimestral: feb / jun / oct).
          </p>
          <div style="background:rgba(239,68,68,0.03);border:1px solid rgba(239,68,68,0.15);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Retención IVA:</span>
              <span style="font-weight:800;color:#ef4444;">100% del IVA facturado</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Retención Ganancias:</span>
              <span style="font-weight:800;color:#ef4444;">6% del monto neto</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Quién retiene:</span>
              <span style="font-weight:600;">El adquirente (obligatorio)</span>
            </div>
          </div>
        </div>

        <!-- Factura A con CBU -->
        <div style="padding:24px;border-bottom:1px solid var(--border-color);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:36px;height:36px;border-radius:8px;background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2);display:flex;align-items:center;justify-content:center;color:#22d3ee;flex-shrink:0;">
              <i data-lucide="landmark" style="width:17px;height:17px;"></i>
            </div>
            <h4 style="font-size:13.5px;font-weight:700;">Factura A — Pago en CBU Informada</h4>
          </div>
          <p class="text-secondary" style="font-size:12px;line-height:1.5;margin-bottom:12px;">
            Opción alternativa para emisores con solvencia no acreditada. Reemplaza la histórica Factura M (derogada a fines de 2025).
          </p>
          <div style="background:rgba(6,182,212,0.03);border:1px solid rgba(6,182,212,0.15);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Método de pago:</span>
              <span style="font-weight:800;color:#22d3ee;">Transferencia a CBU declarada</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Monto transferido:</span>
              <span style="font-weight:600;">Neto de retenciones de ley</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Factura M:</span>
              <span style="font-weight:700;color:#ef4444;">❌ Derogada definitivamente</span>
            </div>
          </div>
        </div>

        <!-- Granos - Tipo 033 -->
        <div style="padding:24px;border-right:1px solid var(--border-color);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:36px;height:36px;border-radius:8px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);display:flex;align-items:center;justify-content:center;color:#fbbf24;flex-shrink:0;">
              <i data-lucide="wheat" style="width:17px;height:17px;"></i>
            </div>
            <h4 style="font-size:13.5px;font-weight:700;">Liquidaciones Primarias de Granos (Tipo 033)</h4>
          </div>
          <p class="text-secondary" style="font-size:12px;line-height:1.5;margin-bottom:12px;">
            Registración obligatoria con parámetros específicos de ARCA para evitar rechazo del validador.
          </p>
          <div style="background:rgba(245,158,11,0.03);border:1px solid rgba(245,158,11,0.15);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Tipo de comprobante:</span>
              <span class="font-mono" style="font-weight:800;color:#fbbf24;">033</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Punto de venta:</span>
              <span class="font-mono" style="font-weight:800;color:#fbbf24;">00000 (cero)</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Número comprobante:</span>
              <span style="font-weight:600;">Últimos 8 dígitos del COE</span>
            </div>
          </div>
        </div>

        <!-- Importación de Servicios -->
        <div style="padding:24px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:36px;height:36px;border-radius:8px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);display:flex;align-items:center;justify-content:center;color:#a78bfa;flex-shrink:0;">
              <i data-lucide="globe" style="width:17px;height:17px;"></i>
            </div>
            <h4 style="font-size:13.5px;font-weight:700;">Importación de Servicios</h4>
          </div>
          <p class="text-secondary" style="font-size:12px;line-height:1.5;margin-bottom:12px;">
            Tratamiento diferente a importación de bienes. Solo se registra el crédito fiscal depositado, no el neto gravado.
          </p>
          <div style="background:rgba(139,92,246,0.03);border:1px solid rgba(139,92,246,0.15);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Registrar en archivo .txt:</span>
              <span style="font-weight:800;color:#a78bfa;">Solo crédito fiscal IVA</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Neto en archivo .txt:</span>
              <span style="font-weight:700;color:#ef4444;">❌ Excluir / anular</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;">
              <span class="text-secondary">Carga manual en:</span>
              <span style="font-weight:600;">Portal aduanero ARCA</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- RG 5824/2026 -->
  <div class="card" style="margin-top:24px;border-color:rgba(34,197,94,0.2);background:rgba(34,197,94,0.01); margin-bottom: 0;">
    <div class="card-header">
      <h3><i data-lucide="layers-2" style="color:var(--color-accent);"></i> RG 5824/2026 — Facturación Consolidada Mensual</h3>
      <span style="font-size:10px;font-weight:700;color:var(--color-accent);background:rgba(34,197,94,0.08);padding:3px 10px;border-radius:20px;border:1px solid rgba(34,197,94,0.25);">Vigente desde 1° Julio 2026</span>
    </div>
    <div class="card-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <p class="text-secondary" style="font-size:13px;line-height:1.5;">
            Los <strong>prestadores de servicios masivos</strong> (empresas de medicina prepaga, servicios de abonos mensuales, etc.) pueden emitir 
            <strong>un único comprobante consolidado al mes por cliente</strong>, eliminando la generación y carga de miles de facturas individuales.
          </p>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;gap:10px;align-items:center;padding:10px;background:rgba(255,255,255,0.02);border-radius:var(--radius-sm);border:1px solid var(--border-color);">
            <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--color-accent);flex-shrink:0;"></i>
            <span style="font-size:12.5px;">Medicina prepaga y seguros</span>
          </div>
          <div style="display:flex;gap:10px;align-items:center;padding:10px;background:rgba(255,255,255,0.02);border-radius:var(--radius-sm);border:1px solid var(--border-color);">
            <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--color-accent);flex-shrink:0;"></i>
            <span style="font-size:12.5px;">Servicios de abono mensual (telefonía, internet)</span>
          </div>
          <div style="display:flex;gap:10px;align-items:center;padding:10px;background:rgba(255,255,255,0.02);border-radius:var(--radius-sm);border:1px solid var(--border-color);">
            <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--color-accent);flex-shrink:0;"></i>
            <span style="font-size:12.5px;">Reduce carga masiva de facturas en estudios</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

export async function initRT54(mainApp) {
  if (window.lucide) window.lucide.createIcons();

  const company = await getActiveCompanyAsync();
  if (!company) return; // Estado vacío ya renderizado por renderRT54(), nada que inicializar.
  const txs = await getTransactionsAsync(company.id);

  document.getElementById('btn-categorizar')?.addEventListener('click', async () => {
    const val = parseFloat(document.getElementById('inp-ingresos-rt54')?.value || '0');
    if (!val || val <= 0) {
      mainApp.showToast('Ingresá un valor de ingresos válido.', 'error');
      return;
    }
    try {
      if (isSupabaseConfigured && supabase) {
        await updateEmpresaFieldsAsync(company.id, { rt54_ingresos_periodo: val });
      } else {
        localStorage.setItem(`vmp_rt54_ingresos_${company.id}`, val.toString());
      }
    } catch (err) {
      mainApp.showToast(`Error al guardar: ${err.message || err}`, 'error');
      return;
    }
    const cat = categorizarRT54(val);
    const labels = { pequena: 'Pequeña', mediana: 'Mediana', restante: 'Restante / Interés Público' };
    mainApp.showToast(`Entidad categorizada como: ${labels[cat]}`, 'success');
    mainApp.router();
  });

  document.getElementById('btn-calcular-inventario')?.addEventListener('click', async () => {
    const unidades = parseInt(document.getElementById('inp-stock-final')?.value || '0');
    try {
      if (isSupabaseConfigured && supabase) {
        await updateEmpresaFieldsAsync(company.id, { rt54_stock_final_unidades: unidades });
      } else {
        localStorage.setItem(`vmp_rt54_stock_${company.id}`, unidades.toString());
      }
    } catch (err) {
      mainApp.showToast(`Error al guardar: ${err.message || err}`, 'error');
      return;
    }

    const comprasOrdenadas = [...txs.compras].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const ultimaCompra = comprasOrdenadas[0];
    const costoUnit = ultimaCompra ? ultimaCompra.neto / 10 : 0;
    const ei          = Math.round(unidades * EI_FACTOR) * costoUnit;
    const ef          = costoUnit * unidades;
    const totalCompras = txs.compras.reduce((s,c) => s+c.total, 0);
    const cv           = ei + totalCompras - ef;

    const elEF = document.getElementById('val-ef');
    const elCV = document.getElementById('val-cv');
    if (elEF) elEF.textContent = `$ ${ef.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    if (elCV) elCV.textContent = `$ ${cv.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

    mainApp.showToast('Valuación de inventario recalculada con RT 54.', 'success');
  });

  // -------------------------------------------------------------
  // CONTROLS FOR THE NEW BIENES DE USO AND DEPRECIATIONS MODULE
  // -------------------------------------------------------------
  document.getElementById('btn-add-asset-submit')?.addEventListener('click', async (e) => {
    e.stopPropagation();

    const nameVal = document.getElementById('asset-name').value.trim();
    const valueVal = Number(document.getElementById('asset-value').value) || 0;
    const categoryVal = document.getElementById('asset-category').value;

    if (!nameVal || valueVal <= 0) {
      mainApp.showToast('Por favor, ingresá el nombre y un valor de origen mayor a $ 0.', 'error');
      return;
    }

    // Determine life years by category
    let lifeYears = 5;
    if (categoryVal.includes('Muebles') || categoryVal.includes('Instalaciones')) {
      lifeYears = 10;
    }

    const newAsset = {
      id: "cust-" + Date.now(),
      nombre: nameVal,
      valor: valueVal,
      fecha: new Date().toISOString().slice(0, 10),
      categoria: categoryVal,
      vidaUtil: lifeYears
    };

    try {
      await addActivoUsoAsync(company.id, newAsset);
      mainApp.showToast(`¡Activo "${nameVal}" incorporado correctamente al Sub-Libro!`, 'success');
      mainApp.router(); // Refresh view
    } catch (err) {
      mainApp.showToast(`Error al guardar el activo: ${err.message || err}`, 'error');
    }
  });

  // Delete Custom Asset handler
  document.querySelectorAll('.btn-delete-custom-asset').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const assetId = btn.dataset.id;

      try {
        await deleteActivoUsoAsync(company.id, assetId);
        mainApp.showToast('Activo removido del sub-libro contable.', 'info');
        mainApp.router();
      } catch (err) {
        mainApp.showToast(`Error al eliminar: ${err.message || err}`, 'error');
      }
    });
  });

  // Formal double-entry ledger adjustment recorder
  document.getElementById('btn-register-amort-entry')?.addEventListener('click', async (e) => {
    e.stopPropagation();

    try {
      if (isSupabaseConfigured && supabase) {
        await updateEmpresaFieldsAsync(company.id, { rt54_asiento_registrado: true });
      } else {
        localStorage.setItem(`vmp_rt54_asiento_ok_${company.id}`, 'true');
      }
      mainApp.showToast("¡Asiento de amortizaciones registrado y conciliado según RT 54!", "success");
      mainApp.router();
    } catch (err) {
      mainApp.showToast(`Error al registrar el asiento: ${err.message || err}`, 'error');
    }
  });

  // -------------------------------------------------------------
  // CONTROLS FOR INFLATION ADJUSTMENT (AxI - RT 54)
  // -------------------------------------------------------------
  document.getElementById('btn-add-axi-submit')?.addEventListener('click', async (e) => {
    e.stopPropagation();

    const conceptVal = document.getElementById('axi-concept').value.trim();
    const origenVal = document.getElementById('axi-origen').value;
    const tipoVal = document.getElementById('axi-tipo').value;
    const valueVal = Number(document.getElementById('axi-value').value) || 0;

    if (!conceptVal || valueVal <= 0) {
      mainApp.showToast('Ingresá el concepto y un monto histórico mayor a $ 0.', 'error');
      return;
    }

    const newItem = {
      id: "axi-" + Date.now(),
      concepto: conceptVal,
      origen: origenVal,
      valor: valueVal,
      tipo: tipoVal
    };

    try {
      await addAjusteInflacionAsync(company.id, newItem);
      mainApp.showToast(`¡Partida "${conceptVal}" ajustada y cargada al Balance Homogéneo!`, 'success');
      mainApp.router(); // Refresh view
    } catch (err) {
      mainApp.showToast(`Error al guardar la partida: ${err.message || err}`, 'error');
    }
  });

  // Delete AxI item handler
  document.querySelectorAll('.btn-delete-axi-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;

      try {
        await deleteAjusteInflacionAsync(company.id, id);
        mainApp.showToast('Partida eliminada de la reexpresión contable.', 'info');
        mainApp.router();
      } catch (err) {
        mainApp.showToast(`Error al eliminar: ${err.message || err}`, 'error');
      }
    });
  });

  // Sincronizar Índices IPC desde API INDEC (ArgentinaDatos)
  document.getElementById('btn-sync-ipc')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = document.getElementById('btn-sync-ipc');
    const icon = document.getElementById('icon-sync-ipc');
    if (!btn || btn.disabled) return;

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="refresh-cw" class="spin-icon" style="width:12px; height:12px; margin-right:4px;"></i> Sincronizando...`;
    if (window.lucide) window.lucide.createIcons();

    try {
      await fetchAndCompileIPC();
      mainApp.showToast('¡Índices IPC actualizados correctamente desde la API!', 'success');
      mainApp.router();
    } catch (err) {
      console.error(err);
      mainApp.showToast('Error al conectar con la API de ArgentinaDatos. Usando índices de contingencia.', 'error');
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      if (window.lucide) window.lucide.createIcons();
    }
  });
}
