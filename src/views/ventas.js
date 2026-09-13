/* -------------------------------------------------------------
   VMP Studio Contable - Ventas y Compras View Component
   ------------------------------------------------------------- */
import { getActiveCompany, getTransactions, addTransaction } from '../db/mockdb.js';

export function renderVentas() {
  const activeCompany = getActiveCompany();
  const txs = getTransactions(activeCompany.id);
  const activePeriod = localStorage.getItem('vmp_active_period') || '2026-05';

  const filteredVentas = txs.ventas.filter(v => v.fecha.startsWith(activePeriod));
  const filteredCompras = txs.compras.filter(c => c.fecha.startsWith(activePeriod));

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Comprobantes Registrados</h1>
      <p class="view-subtitle">Gestioná las facturas emitidas y recibidas de la empresa.</p>
    </div>
    <button class="btn btn-primary" id="btn-show-add-tx">
      <i data-lucide="plus"></i> Cargar Comprobante
    </button>
  </div>

  <!-- Add Transaction Form Container -->
  <div class="card id-form-card" id="add-tx-form-container" style="display: none; margin-bottom: 32px;">
    <div class="card-header">
      <h3><i data-lucide="file-plus"></i> Registrar Comprobante Manual</h3>
      <button class="btn-icon-sm" id="btn-cancel-add-tx" title="Cancelar"><i data-lucide="x"></i></button>
    </div>
    <div class="card-body">
      <form id="add-tx-form" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="form-group">
          <label class="form-label">Tipo de Operación *</label>
          <select id="tx-operation-type" class="form-select">
            <option value="ventas">Venta (Emitido)</option>
            <option value="compras">Compra (Recibido)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Fecha *</label>
          <input type="date" id="tx-date" class="form-input" value="2026-05-25" required>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Comprobante *</label>
          <select id="tx-voucher-type" class="form-select">
            <optgroup label="Facturas Estándar">
              <option value="Factura A">Factura A</option>
              <option value="Factura B">Factura B</option>
              <option value="Factura C">Factura C</option>
              <option value="Factura E (Export.)">Factura E (Exportación)</option>
            </optgroup>
            <optgroup label="Clase A — Regímenes Especiales 2026">
              <option value="Factura A - Retención">Factura A - Sujeta a Retención (100% IVA + 6% Gcias)</option>
              <option value="Factura A - CBU">Factura A - Pago en CBU Informada</option>
            </optgroup>
            <optgroup label="Clase M — Regímenes Especiales">
              <option value="Factura M">Factura M - Con Retención Especial ARCA (100% IVA + 6% Gcias)</option>
            </optgroup>
            <optgroup label="Comprobantes Especiales">
              <option value="Liq. Primaria Granos (033)">Liquidación Primaria Granos (Tipo 033)</option>
              <option value="Nota de Débito A">Nota de Débito A</option>
              <option value="Nota de Débito B">Nota de Débito B</option>
              <option value="Nota de Crédito A">Nota de Crédito A</option>
              <option value="Nota de Crédito B">Nota de Crédito B</option>
            </optgroup>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Número de Comprobante *</label>
          <input type="text" id="tx-number" class="form-input" placeholder="0001-00001234" required>
        </div>
        <div class="form-group">
          <label class="form-label" id="lbl-entity">Cliente *</label>
          <input type="text" id="tx-entity" class="form-input" placeholder="Razón Social / Consumidor Final" required>
        </div>
        <div class="form-group">
          <label class="form-label">CUIT Cliente/Proveedor *</label>
          <input type="text" id="tx-cuit" class="form-input" placeholder="30-11223344-5" required>
          <div id="cuit-validation-feedback" style="font-size: 11px; margin-top: 4px; min-height: 16px;"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Importe Neto Gravado *</label>
          <input type="number" id="tx-net" class="form-input" placeholder="0.00" min="0" step="0.01" required>
        </div>
        <div class="form-group">
          <label class="form-label">Alícuota IVA %</label>
          <select id="tx-iva-rate" class="form-select">
            <option value="21">21.0 % (Estándar)</option>
            <option value="10.5">10.5 % (Reducido)</option>
            <option value="27">27.0 % (Servicios)</option>
            <option value="0">0.0 % (Exento / No Gravado)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Importe IVA Calculado</label>
          <input type="number" id="tx-iva" class="form-input" style="background: rgba(255,255,255,0.02); color: var(--text-secondary);" placeholder="0.00" readonly>
        </div>
        <div class="form-group">
          <label class="form-label">Total Facturado</label>
          <input type="number" id="tx-total" class="form-input" style="background: rgba(255,255,255,0.02); color: var(--color-teal-light); font-weight: 700;" placeholder="0.00" readonly>
        </div>

        <!-- Alerta especial: Granos 033 -->
        <div id="granos-alert" style="grid-column:span 2; display:none; background:rgba(245,158,11,0.05); border:1px solid rgba(245,158,11,0.25); border-radius:var(--radius-sm); padding:12px 16px; font-size:12px; color:#fbbf24;">
          <strong>⚠ Liquidación Primaria de Granos (Tipo 033):</strong>
          Punto de venta debe ser <strong>00000</strong>. El número de comprobante debe contener los últimos <strong>8 dígitos del COE</strong>.
        </div>

        <!-- Alerta especial: Factura A con Retención -->
        <div id="retencion-alert" style="grid-column:span 2; display:none; background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.25); border-radius:var(--radius-sm); padding:12px 16px; font-size:12px; color:#f87171;">
          <strong>⚠ Factura A Sujeta a Retención:</strong>
          El adquirente debe retener obligatoriamente el <strong>100% del IVA</strong> y el <strong>6% en Ganancias</strong>.
        </div>

        <!-- Alerta especial: Factura M -->
        <div id="factura-m-alert" style="grid-column:span 2; display:none; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-sm); padding:12px 16px; font-size:12px; color:#f87171;">
          <strong>⚠ Factura Clase M Detectada:</strong>
          El adquirente está obligado a actuar como Agente de Retención, debiendo retener el <strong>100% del IVA</strong> y el <strong>6% de Impuesto a las Ganancias</strong> a través de <strong>SIRE (ARCA)</strong>.
        </div>

        <!-- Alerta especial: Factura A con CBU -->
        <div id="cbu-alert" style="grid-column:span 2; display:none; background:rgba(6,182,212,0.05); border:1px solid rgba(6,182,212,0.25); border-radius:var(--radius-sm); padding:12px 16px; font-size:12px; color:#22d3ee;">
          <strong>ⓘ Factura A - Pago CBU:</strong>
          El pago debe realizarse por transferencia bancaria a la CBU declarada ante ARCA, neta de retenciones de ley.
        </div>

        <div style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <!-- Clasificación RT 54 -->
          <div class="form-group" id="fg-es-activo" style="margin:0; display: flex; flex-direction: column; gap: 8px;">
            <label class="form-label" style="margin:0;">Clasificación RT 54 (Compras)</label>
            <div style="display:flex; gap:10px;">
              <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; padding:8px 12px; border:1px solid var(--border-color); border-radius:var(--radius-sm); flex:1; justify-content:center;" id="lbl-gasto">
                <input type="radio" name="tx-es-activo" value="false" checked style="accent-color:var(--color-accent);"> Gasto
              </label>
              <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; padding:8px 12px; border:1px solid rgba(31,92,67,0.3); border-radius:var(--radius-sm); flex:1; justify-content:center; background:rgba(31,92,67,0.02);" id="lbl-activo">
                <input type="radio" name="tx-es-activo" value="true" style="accent-color:var(--color-accent);"> Bien de Uso
              </label>
            </div>
          </div>
          <div class="form-group" id="fg-categoria" style="margin:0;">
            <label class="form-label">Categoría / Rubro</label>
            <select id="tx-categoria" class="form-select">
              <option value="General">General</option>
              <option value="Combustibles">Combustibles</option>
              <option value="Materias Primas">Materias Primas</option>
              <option value="Servicios">Servicios (internet, telefonía)</option>
              <option value="Mantenimiento">Mantenimiento y Reparaciones</option>
              <option value="Librería">Librería e Insumos de Oficina</option>
              <option value="Computación">Computación y Tecnología</option>
              <option value="Mobiliario">Mobiliario y Equipamiento</option>
              <option value="Vehículos">Vehículos y Transporte</option>
              <option value="Inmuebles">Inmuebles y Construcción</option>
              <option value="Maquinaria">Maquinaria e Instalaciones</option>
            </select>
          </div>
        </div>

        <div style="grid-column: span 2; display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px;">
          <button type="button" class="btn btn-outline" id="btn-tx-form-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar Comprobante</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Tabs Navigation -->
  <div style="display: flex; gap: 8px; margin-bottom: 20px;">
    <button class="btn btn-outline active" id="btn-tab-ventas" style="border-radius: var(--radius-full); padding: 8px 20px; font-size: 13px;">
      Ventas Emitidas (${txs.ventas.length})
    </button>
    <button class="btn btn-outline" id="btn-tab-compras" style="border-radius: var(--radius-full); padding: 8px 20px; font-size: 13px;">
      Compras Recibidas (${txs.compras.length})
    </button>
  </div>

  <!-- Panel de Filtros Contables (Filtrado por Fecha, Hora y Tipo) -->
  <div class="card" style="margin-bottom: 24px; background: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
    <div class="card-body" style="padding: 16px 20px; display: grid; grid-template-columns: repeat(4, 1fr) auto; gap: 16px; align-items: flex-end;">
      <div class="form-group" style="margin: 0; display: flex; flex-direction: column; gap: 6px;">
        <label class="form-label" style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">Fecha Desde</label>
        <input type="date" id="filter-date-from" class="form-input" style="padding: 8px 12px; font-size: 12.5px; border-radius: var(--radius-sm);">
      </div>
      <div class="form-group" style="margin: 0; display: flex; flex-direction: column; gap: 6px;">
        <label class="form-label" style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">Fecha Hasta</label>
        <input type="date" id="filter-date-to" class="form-input" style="padding: 8px 12px; font-size: 12.5px; border-radius: var(--radius-sm);">
      </div>
      <div class="form-group" style="margin: 0; display: flex; flex-direction: column; gap: 6px;">
        <label class="form-label" style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">Tipo de Comprobante</label>
        <select id="filter-voucher-type" class="form-select" style="padding: 8px 12px; font-size: 12.5px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <option value="ALL">Todos los tipos</option>
          <option value="Factura A">Factura A</option>
          <option value="Factura B">Factura B</option>
          <option value="Factura C">Factura C</option>
          <option value="Factura M">Factura M</option>
          <option value="Factura E">Factura E (Exportación)</option>
          <option value="033">Liquidación Granos (033)</option>
        </select>
      </div>
      <div class="form-group" style="margin: 0; display: flex; flex-direction: column; gap: 6px;">
        <label class="form-label" style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">Orden (Fecha y Hora)</label>
        <select id="filter-sort-order" class="form-select" style="padding: 8px 12px; font-size: 12.5px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <option value="desc">Cronológico Descendente (Más recientes)</option>
          <option value="asc">Cronológico Ascendente (Más antiguos)</option>
        </select>
      </div>
      <div style="display: flex; align-items: center; justify-content: center; height: 38px;">
        <button class="btn btn-outline" id="btn-clear-filters" style="padding: 10px 14px; font-size: 12.5px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: flex; align-items: center; gap: 6px; font-weight: 600;" title="Limpiar Filtros">
          <i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i> Reset
        </button>
      </div>
    </div>
  </div>

  <!-- Scoped Data Card -->
  <div class="card">
    <div class="card-body p-0" id="tx-list-container">
      <!-- Injected table -->
    </div>
  </div>
  `;
}

// Sub-renderers for clean tab switches
function renderTransactionsTable(transactions, type) {
  if (transactions.length === 0) {
    return `
    <div style="text-align: center; padding: 48px; color: var(--text-secondary);">
      <i data-lucide="info" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 12px;"></i>
      <h4>No hay comprobantes cargados en esta sección</h4>
      <p style="font-size: 13px; margin-top: 6px;">Cargá uno manualmente o importá un archivo de ARCA en la sección "Importación ARCA".</p>
    </div>
    `;
  }

  return `
  <div class="table-responsive">
    <table class="table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Número</th>
          <th>${type === 'ventas' ? 'Cliente' : 'Proveedor'}</th>
          <th>CUIT</th>
          <th class="text-right">Neto Gravado</th>
          <th class="text-right">IVA</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${transactions.map(t => {
          const cleanCuit = t.cuit.replace(/[^0-9]/g, '');
          const lastDigit = cleanCuit.slice(-1);
          let cuitStatusBadge = '';
          
          if (lastDigit === '0') {
            cuitStatusBadge = `
              <div title="Consumidor Final con riesgo fiscal. Posible emisor o receptor apócrifo detectado en base de datos ARCA (Riesgo APOC)." style="font-size: 10px; color: #ef4444; background: rgba(239, 68, 68, 0.08); padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid rgba(239,68,68,0.2); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; cursor: help;">
                <i data-lucide="alert-triangle" style="width: 10px; height: 10px;"></i> RIESGO APOC
              </div>
            `;
          } else if (lastDigit === '9') {
            cuitStatusBadge = `
              <div title="La CUIT del contribuyente se encuentra INACTIVA / SUSPENDIDA en el padrón de ARCA. No computa Crédito Fiscal para el Libro IVA Digital o F.2051 hasta regularizar." style="font-size: 10px; color: #f59e0b; background: rgba(245, 158, 11, 0.08); padding: 2px 6px; border-radius: var(--radius-sm); border: 1px solid rgba(245,158,11,0.2); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; cursor: help;">
                <i data-lucide="shield-alert" style="width: 10px; height: 10px;"></i> CUIT INACTIVA
              </div>
            `;
          }

          const defaultHours = { 'v-1': '09:15', 'v-2': '11:42', 'v-3': '15:20', 'c-1': '10:30', 'c-2': '16:10', 'v-4': '08:45', 'v-5': '14:22', 'c-3': '11:10', 'v-6': '09:50', 'v-7': '13:15', 'c-4': '12:05' };
          const hora = t.hora || defaultHours[t.id] || '09:00';

          return `
          <tr>
            <td class="font-mono text-sm">
              <div style="font-weight: 600;">${t.fecha.split('-').reverse().join('/')}</div>
              <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                <i data-lucide="clock" style="width: 10px; height: 10px; opacity: 0.7;"></i> ${hora} hs
              </div>
            </td>
            <td>
              <span class="badge-status ${type === 'ventas' ? 'active' : 'pending'}" style="font-size: 11.5px; font-weight: 600; padding: 2px 10px;">
                ${t.tipo_comprobante}
              </span>
            </td>
            <td class="font-mono text-sm" style="font-weight: 500;">${t.numero}</td>
            <td style="font-weight: 600; font-size: 13.5px;">
              <div>${t.cliente || t.proveedor}</div>
              ${type === 'compras' ? (t.es_activo ? `
                <div style="font-size: 10px; font-weight: 700; color: var(--color-accent-light); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                  <i data-lucide="building" style="width: 10px; height: 10px;"></i> Bien de Uso / Activo
                </div>
              ` : `
                <div style="font-size: 10px; font-weight: 500; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                  <i data-lucide="tag" style="width: 10px; height: 10px;"></i> Gasto (${t.categoria || 'General'})
                </div>
              `) : ''}
            </td>
            <td class="font-mono" style="color: var(--text-secondary);">
              <div>${t.cuit}</div>
              ${cuitStatusBadge}
            </td>
            <td class="font-mono text-right">$ ${t.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td class="font-mono text-right" style="color: var(--text-secondary);">$ ${t.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td class="font-mono text-right" style="font-weight: 700; color: ${type === 'ventas' ? 'var(--color-emerald-light)' : 'var(--text-primary)'}">
              $ ${t.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  `;
}

export function initVentas(mainApp) {
  if (window.lucide) window.lucide.createIcons();

  const activeCompany = getActiveCompany();
  let activeTab = "ventas"; // 'ventas' or 'compras'

  const container = document.getElementById('tx-list-container');
  const btnShowAdd = document.getElementById('btn-show-add-tx');
  const btnCancelAdd = document.getElementById('btn-cancel-add-tx');
  const btnFormCancel = document.getElementById('btn-tx-form-cancel');
  const formContainer = document.getElementById('add-tx-form-container');
  const form = document.getElementById('add-tx-form');
  
  const tabVentas = document.getElementById('btn-tab-ventas');
  const tabCompras = document.getElementById('btn-tab-compras');

  const inputDateFrom = document.getElementById('filter-date-from');
  const inputDateTo = document.getElementById('filter-date-to');
  const selectVoucherFilter = document.getElementById('filter-voucher-type');
  const selectSortOrder = document.getElementById('filter-sort-order');
  const btnClearFilters = document.getElementById('btn-clear-filters');

  // Renders the active list with filters
  const updateList = () => {
    const txs = getTransactions(activeCompany.id);
    const activePeriod = localStorage.getItem('vmp_active_period') || '2026-05';
    let list = txs[activeTab].filter(t => t.fecha.startsWith(activePeriod));

    // Apply date from filter
    if (inputDateFrom && inputDateFrom.value) {
      list = list.filter(t => t.fecha >= inputDateFrom.value);
    }

    // Apply date to filter
    if (inputDateTo && inputDateTo.value) {
      list = list.filter(t => t.fecha <= inputDateTo.value);
    }

    // Apply voucher type filter
    if (selectVoucherFilter && selectVoucherFilter.value !== 'ALL') {
      list = list.filter(t => t.tipo_comprobante.toLowerCase().includes(selectVoucherFilter.value.toLowerCase()));
    }

    // Apply sorting (by Date and Time)
    const order = selectSortOrder?.value || 'desc';
    list.sort((a, b) => {
      const defaultHours = { 'v-1': '09:15', 'v-2': '11:42', 'v-3': '15:20', 'c-1': '10:30', 'c-2': '16:10', 'v-4': '08:45', 'v-5': '14:22', 'c-3': '11:10', 'v-6': '09:50', 'v-7': '13:15', 'c-4': '12:05' };
      const timeA = a.hora || defaultHours[a.id] || '09:00';
      const timeB = b.hora || defaultHours[b.id] || '09:00';
      const dateTimeA = new Date(`${a.fecha}T${timeA}:00`);
      const dateTimeB = new Date(`${b.fecha}T${timeB}:00`);
      return order === 'asc' ? dateTimeA - dateTimeB : dateTimeB - dateTimeA;
    });

    container.innerHTML = renderTransactionsTable(list, activeTab);
    if (window.lucide) window.lucide.createIcons({ root: container });
  };

  updateList();

  // Tab switching
  tabVentas?.addEventListener('click', () => {
    activeTab = "ventas";
    tabVentas.classList.add('active');
    tabCompras.classList.remove('active');
    updateList();
  });

  tabCompras?.addEventListener('click', () => {
    activeTab = "compras";
    tabCompras.classList.add('active');
    tabVentas.classList.remove('active');
    updateList();
  });

  // Listeners for real-time filtering
  inputDateFrom?.addEventListener('input', updateList);
  inputDateTo?.addEventListener('input', updateList);
  selectVoucherFilter?.addEventListener('change', updateList);
  selectSortOrder?.addEventListener('change', updateList);

  btnClearFilters?.addEventListener('click', () => {
    if (inputDateFrom) inputDateFrom.value = '';
    if (inputDateTo) inputDateTo.value = '';
    if (selectVoucherFilter) selectVoucherFilter.value = 'ALL';
    if (selectSortOrder) selectSortOrder.value = 'desc';
    updateList();
    mainApp.showToast('Filtros contables restablecidos.', 'success');
  });

  // Show/Hide Form
  btnShowAdd?.addEventListener('click', () => {
    formContainer.style.display = 'block';
    btnShowAdd.style.display = 'none';
    document.getElementById('tx-number').focus();
  });

  const hideForm = () => {
    formContainer.style.display = 'none';
    btnShowAdd.style.display = 'flex';
    form.reset();
  };

  btnCancelAdd?.addEventListener('click', hideForm);
  btnFormCancel?.addEventListener('click', hideForm);

  // Switch entity label dynamically on operation type change
  const opType = document.getElementById('tx-operation-type');
  const lblEntity = document.getElementById('lbl-entity');
  
  opType?.addEventListener('change', () => {
    if (opType.value === 'ventas') {
      lblEntity.textContent = 'Cliente *';
      document.getElementById('tx-entity').placeholder = 'Razón Social / Consumidor Final';
    } else {
      lblEntity.textContent = 'Proveedor *';
      document.getElementById('tx-entity').placeholder = 'Nombre del Proveedor';
    }
  });

  // Auto-calculator on net amount change or iva rate change
  const inputNet  = document.getElementById('tx-net');
  const selectIva = document.getElementById('tx-iva-rate');
  const inputIva  = document.getElementById('tx-iva');
  const inputTotal = document.getElementById('tx-total');
  const selectVoucher = document.getElementById('tx-voucher-type');

  // Show/hide RT54 classification section (only relevant for compras)
  const fgActivo   = document.getElementById('fg-es-activo');
  const fgCategoria = document.getElementById('fg-categoria');
  const granosAlert   = document.getElementById('granos-alert');
  const retencionAlert = document.getElementById('retencion-alert');
  const cbuAlert      = document.getElementById('cbu-alert');

  const updateVoucherAlerts = () => {
    const v = selectVoucher?.value || '';
    const isCompra = (document.getElementById('tx-operation-type')?.value === 'compras');
    if (fgActivo) fgActivo.style.display = isCompra ? 'flex' : 'none';
    if (fgCategoria) fgCategoria.style.display = isCompra ? 'block' : 'none';
    if (granosAlert)    granosAlert.style.display    = v.includes('033') ? 'block' : 'none';
    if (retencionAlert) retencionAlert.style.display = v.includes('Retenci') ? 'block' : 'none';
    if (cbuAlert)       cbuAlert.style.display       = v.includes('CBU') ? 'block' : 'none';
    
    const mAlert = document.getElementById('factura-m-alert');
    if (mAlert) mAlert.style.display = v.includes('Factura M') ? 'block' : 'none';

    // For granos: force PV to 00000 prefix hint
    if (v.includes('033')) {
      const numInput = document.getElementById('tx-number');
      if (numInput && !numInput.value) numInput.placeholder = '00000-XXXXXXXX (últimos 8 dígitos COE)';
    } else {
      const numInput = document.getElementById('tx-number');
      if (numInput) numInput.placeholder = '0001-00001234';
    }
  };

  updateVoucherAlerts();
  selectVoucher?.addEventListener('change', updateVoucherAlerts);
  document.getElementById('tx-operation-type')?.addEventListener('change', updateVoucherAlerts);


  const recalculateAmounts = () => {
    const net = parseFloat(inputNet.value) || 0;
    const rate = parseFloat(selectIva.value) || 0;
    const iva = (net * rate) / 100;
    const total = net + iva;

    inputIva.value = iva.toFixed(2);
    inputTotal.value = total.toFixed(2);
  };

  inputNet?.addEventListener('input', recalculateAmounts);
  selectIva?.addEventListener('change', recalculateAmounts);

  const inputCuit = document.getElementById('tx-cuit');
  const cuitFeedback = document.getElementById('cuit-validation-feedback');

  const validateCuitRealtime = () => {
    if (!inputCuit || !cuitFeedback) return;
    const clean = inputCuit.value.replace(/[^0-9]/g, '');
    if (clean.length === 0) {
      cuitFeedback.innerHTML = '';
      return;
    }
    
    if (clean.length < 11) {
      cuitFeedback.innerHTML = `<span style="color: var(--text-secondary); font-size: 11px;">CUIT incompleto (${clean.length}/11 dígitos)</span>`;
      return;
    }

    const lastDigit = clean.slice(-1);
    if (lastDigit === '0') {
      cuitFeedback.innerHTML = `
        <span style="color: #ef4444; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
          <i data-lucide="alert-triangle" style="width: 12px; height: 12px;"></i> 
          ⚠ RIESGO APOC (Listado en Base de Facturación Apócrifa)
        </span>
      `;
    } else if (lastDigit === '9') {
      cuitFeedback.innerHTML = `
        <span style="color: #f59e0b; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
          <i data-lucide="shield-alert" style="width: 12px; height: 12px;"></i> 
          ⚠ CUIT Inactivo / Suspendido en ARCA
        </span>
      `;
    } else {
      cuitFeedback.innerHTML = `
        <span style="color: var(--color-accent-light); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
          <i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> 
          ✓ CUIT en estado activo / regular
        </span>
      `;
    }
    if (window.lucide) window.lucide.createIcons({ root: cuitFeedback });
  };

  inputCuit?.addEventListener('input', validateCuitRealtime);

  // Form submission
  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const op = document.getElementById('tx-operation-type').value;
    const date = document.getElementById('tx-date').value;
    const voucher = document.getElementById('tx-voucher-type').value;
    const num = document.getElementById('tx-number').value;
    const entityName = document.getElementById('tx-entity').value;
    const cuit = document.getElementById('tx-cuit').value;
    const net = parseFloat(inputNet.value);
    const iva = parseFloat(inputIva.value);
    const total = parseFloat(inputTotal.value);
    const esActivoVal = document.querySelector('input[name="tx-es-activo"]:checked')?.value === 'true';
    const categoriaVal = document.getElementById('tx-categoria')?.value || 'General';

    if (!date || !num || !entityName || !cuit || isNaN(net)) {
      mainApp.showToast('Completá todos los campos obligatorios.', 'error');
      return;
    }

    const transaction = {
      fecha: date,
      hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      tipo_comprobante: voucher,
      numero: num,
      cuit,
      neto: net,
      iva,
      total,
      es_activo: op === 'compras' ? esActivoVal : false,
      categoria: op === 'compras' ? categoriaVal : 'Venta',
    };

    if (op === 'ventas') {
      transaction.cliente = entityName;
    } else {
      transaction.proveedor = entityName;
    }

    addTransaction(activeCompany.id, op, transaction);
    mainApp.showToast('¡Comprobante guardado correctamente!', 'success');

    hideForm();
    
    // Switch active tab to match the entered transaction
    activeTab = op;
    if (op === 'ventas') {
      tabVentas.classList.add('active');
      tabCompras.classList.remove('active');
    } else {
      tabCompras.classList.add('active');
      tabVentas.classList.remove('active');
    }
    
    // Refresh main app statistics + local view table
    mainApp.router();
  });
}
