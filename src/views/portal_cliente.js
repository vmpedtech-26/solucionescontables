/* -------------------------------------------------------------
   VMP Studio Contable - Portal Cliente View Component
   ------------------------------------------------------------- */
import { getActiveCompany, addTransaction } from '../db/mockdb.js';
import { fmt, fmtDate } from '../utils.js';

// Pre-loaded digital documents (tickets & invoices)
const INITIAL_DIGITAL_TICKETS = [
  { id: "t-1", fecha: "2026-05-25", detalle: "Ticket Nafta Infinia - YPF", archivo: "ticket_ypf.jpg", tipo: "Compra", monto: 18500, estado: "Procesado", es_activo: false, categoria: "Combustibles" },
  { id: "t-2", fecha: "2026-05-24", detalle: "Factura Fibertel - Telecom", archivo: "factura_internet.pdf", tipo: "Compra", monto: 24000, estado: "Aprobado", es_activo: false, categoria: "Servicios" },
  { id: "t-3", fecha: "2026-05-23", detalle: "Librería San Martín (Insumos)", archivo: "insumos_oficina.png", tipo: "Compra", monto: 6500, estado: "Recibido", es_activo: false, categoria: "Librería" }
];

// CUIT Modulo 11 AFIP verification algorithm
export function validarCUIT(cuit) {
  const clean = cuit.replace(/-/g, '').trim();
  if (clean.length !== 11) return false;
  if (!/^\d+$/.test(clean)) return false;

  const digits = clean.split('').map(Number);
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * multipliers[i];
  }
  
  const remainder = sum % 11;
  let checkDigit = 11 - remainder;
  if (checkDigit === 11) checkDigit = 0;
  if (checkDigit === 10) checkDigit = 9; // AFIP custom exception for certain edge numbers

  return digits[10] === checkDigit;
}

// Local Database of Real Argentine Entities for smart auto-complete
const CUIT_PADRON_REGISTRY = {
  '30500012349': { name: "YPF S.A.", cond: "Responsable Inscripto", direccion: "Av. Macacha Güemes 515, CABA" },
  '30708608833': { name: "Mercado Libre S.R.L.", cond: "Responsable Inscripto", direccion: "Aria 3751, CABA" },
  '30707216656': { name: "Telecom Argentina S.A.", cond: "Responsable Inscripto", direccion: "Av. Alicia Moreau de Justo 50, CABA" },
  '30610065429': { name: "Cervecería Quilmes S.A.", cond: "Responsable Inscripto", direccion: "Av. Antártida Argentina 1899, Buenos Aires" },
  '30112233445': { name: "Sinergia Group LLC", cond: "Responsable Inscripto", direccion: "Av. Corrientes 1240, CABA" },
  '30719384952': { name: "Alimentos del Valle S.R.L.", cond: "Responsable Inscripto", direccion: "Parque Industrial Gral. Savio, Mar del Plata" },
  '20358492014': { name: "Carlos Daniel Pérez", cond: "Monotributo", direccion: "Calle 14 N° 402, La Plata" },
  '20283948593': { name: "Mariana Sofía Gómez", cond: "Monotributo", direccion: "Av. Colon 512, Córdoba" },
  '30774433229': { name: "Cervecería Austral S.A.", cond: "Responsable Inscripto", direccion: "Ruta 3 Km 1200, Comodoro Rivadavia" },
  '30559988771': { name: "Distribuidora del Neuquén", cond: "Responsable Inscripto", direccion: "Félix San Martín 1500, Neuquén" }
};

export function renderPortalCliente() {
  const activeCompany = getActiveCompany();
  const hasApiKey = localStorage.getItem('vmp_gemini_api_key') ? true : false;

  // Load from local storage if exists
  if (!localStorage.getItem(`vmp_tickets_${activeCompany.id}`)) {
    localStorage.setItem(`vmp_tickets_${activeCompany.id}`, JSON.stringify(INITIAL_DIGITAL_TICKETS));
  }
  const tickets = JSON.parse(localStorage.getItem(`vmp_tickets_${activeCompany.id}`));

  // Initialize OCR Quota parameters in localStorage if not set
  if (!localStorage.getItem('vmp_ocr_scans_count')) {
    localStorage.setItem('vmp_ocr_scans_count', '284');
  }
  if (!localStorage.getItem('vmp_ocr_scans_limit')) {
    localStorage.setItem('vmp_ocr_scans_limit', '300');
  }
  const ocrScans = parseInt(localStorage.getItem('vmp_ocr_scans_count'), 10);
  const ocrLimit = parseInt(localStorage.getItem('vmp_ocr_scans_limit'), 10);
  const quotaPercent = Math.min(100, (ocrScans / ocrLimit) * 100);

  let proactiveQuotaAlert = '';
  if (ocrScans >= ocrLimit) {
    proactiveQuotaAlert = `
      <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-left: 4px solid #ef4444; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #b91c1c; display: flex; align-items: center; gap: 10px;">
        <i data-lucide="lock" style="width: 18px; height: 18px; flex-shrink: 0; color: #ef4444;"></i>
        <div>
          <strong>Cupo Gemini OCR Agotado:</strong> Has procesado ${ocrScans}/${ocrLimit} comprobantes. El escaneo automático está bloqueado. Por favor, <strong>cargá tus comprobantes manualmente</strong> usando el botón "Carga Manual" o solicita una extensión.
        </div>
      </div>
    `;
  } else if (ocrScans >= (ocrLimit * 0.8)) {
    proactiveQuotaAlert = `
      <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-left: 4px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #92400e; display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; box-sizing: border-box;">
        <div style="display:flex; align-items:center; gap:10px;">
          <i data-lucide="alert-triangle" style="width: 18px; height: 18px; flex-shrink: 0; color: #f59e0b;"></i>
          <div>
            <strong>Advertencia de Cupo OCR:</strong> Has consumido el ${quotaPercent.toFixed(1)}% (${ocrScans}/${ocrLimit}) del cupo mensual de digitalizaciones con IA.
          </div>
        </div>
        <button id="btn-upgrade-quota-alert" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 4px 10px; border-color: rgba(245,158,11,0.3); color: #d97706; background:#fff; cursor:pointer;">Aumentar Cupo</button>
      </div>
    `;
  }

  const isMonotributo = activeCompany.condicion_iva.includes('Monotributo');
  const allowedComprobante = isMonotributo 
    ? '<option value="Factura C" selected>Factura C (Monotributo)</option><option value="Factura E">Factura E (Exportación de Servicios)</option>' 
    : '<option value="Factura A" selected>Factura A (Responsable Inscripto)</option><option value="Factura B">Factura B (Consumidor Final)</option><option value="Factura E">Factura E (Exportación)</option>';

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Portal del Cliente (Suite Operativa)</h1>
      <p class="view-subtitle">Consola de facturación y digitalización de comprobantes para la empresa activa.</p>
    </div>
    <div style="background: rgba(31, 92, 67, 0.08); border: 1px solid rgba(31, 92, 67, 0.2); padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: var(--color-accent-light);">
      Acceso: Cliente Final (${activeCompany.razon_social})
    </div>
  </div>

  <div class="portal-grid" style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 24px; align-items: start; min-width: 0;">
    
    <!-- Left Column: Operations (Upload OR Bill) -->
    <div style="display: flex; flex-direction: column; gap: 20px;">
      
      <!-- Solapas (Tabs) Selector -->
      <div style="display: flex; background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 4px; gap: 4px;">
        <button class="btn btn-sm portal-tab-btn active" data-tab="upload" style="flex: 1; border: none; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 4px;">
          <i data-lucide="camera" style="width: 15px; height: 15px;"></i>
          Digitalizar Comprobantes
        </button>
        <button class="btn btn-sm portal-tab-btn" data-tab="invoice" style="flex: 1; border: none; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 4px;">
          <i data-lucide="zap" style="width: 15px; height: 15px; color: var(--color-accent);"></i>
          Emitir Factura Electrónica (ARCA Live)
        </button>
      </div>

      <!-- Gemini API Status Card (Inherited from the Studio) -->
      <div id="gemini-status-card" class="card" style="border-color: rgba(31, 92, 67, 0.2); background: rgba(31, 92, 67, 0.01); margin-bottom: 0;">
        <div class="card-body" style="padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 250px;">
            <div style="background: rgba(31, 92, 67, 0.08); color: var(--color-accent-light); width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink:0;">
              <i data-lucide="sparkles"></i>
            </div>
            <div>
              <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 2px; color: var(--color-primary);">Motor Inteligente de Estudio Activo</h4>
              <p style="font-size: 11px; color: var(--text-secondary); margin: 0;">Los tickets de gastos cargados heredarán el reconocimiento OCR de tu contador.</p>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            ${hasApiKey ? `
              <span style="font-size: 11px; font-weight: 700; color: var(--color-accent-light); background: rgba(47, 122, 89, 0.08); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(47, 122, 89, 0.2); display: flex; align-items: center; gap: 4px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent-light);"></span>
                IA Conectada
              </span>
            ` : `
              <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); background: var(--bg-secondary); padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 4px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); flex-shrink:0;"></span>
                Carga Offline
              </span>
            `}
          </div>
        </div>
      </div>

      <!-- PANEL 1: DIGITALIZACIÓN (UPLOAD) -->
      <div id="portal-panel-upload" class="card">
        <div class="card-header">
          <h3><i data-lucide="camera"></i> Enviar Comprobante al Contador</h3>
        </div>
        <div class="card-body">
          ${proactiveQuotaAlert}
          <p class="text-secondary" style="font-size: 13.5px; margin-bottom: 20px;">
            Subí una foto del ticket impreso, arrastrá un PDF de gastos o usá la cámara de tu celular. El bot contable extraerá los montos y CUITs de forma automática.
          </p>

          <!-- Dynamic Dropzone -->
          <div class="import-area" id="ticket-dropzone" style="border-color: rgba(31, 92, 67, 0.3); background: rgba(31, 92, 67, 0.01); padding: 32px; margin-bottom: 0;">
            <div class="import-icon" style="background: rgba(31, 92, 67, 0.08); color: var(--color-accent-light); border-color: rgba(31, 92, 67, 0.2);">
              <i data-lucide="camera"></i>
            </div>
            <h4 style="font-size: 14px; font-weight: 700;">Arrastrá el ticket o sacá una foto</h4>
            <p style="font-size: 12px; margin-top: 4px; margin-bottom: 16px;">Soportamos JPG, PNG y PDF (facturas electrónicas de email).</p>
            
            <label class="btn btn-outline btn-sm" style="border-color: rgba(31, 92, 67, 0.3); color: var(--color-accent-light); cursor: pointer;">
              <i data-lucide="upload"></i> Elegir Archivo
              <input type="file" id="ticket-file-input" style="display: none;" accept="image/*,application/pdf">
            </label>

            <div class="demo-afip-pills" style="margin-top: 16px; display: flex; gap: 8px; justify-content: center;">
              <div class="afip-sample-pill" id="btn-simulate-ticket" style="border-color: rgba(31, 92, 67, 0.25);">
                <i data-lucide="refresh-cw" style="width: 12px; height: 12px; display: inline; vertical-align: middle; margin-right: 4px; color:var(--color-accent-light);"></i>
                Digitalizar Gasto de Combustible
              </div>
              <div class="afip-sample-pill" id="btn-simulate-asset" style="border-color: rgba(31, 92, 67, 0.4); color: var(--color-accent-light); font-weight: 600;">
                <i data-lucide="refresh-cw" style="width: 12px; height: 12px; display: inline; vertical-align: middle; margin-right: 4px; color:var(--color-accent-light);"></i>
                Digitalizar Compra de Notebook
              </div>
            </div>

            <!-- Quota meter/status -->
            <div id="ocr-quota-container" style="margin-top: 24px; width: 100%; max-width: 320px; margin-left: auto; margin-right: auto; padding: 12px; border-radius: 8px; background: rgba(31, 92, 67, 0.03); border: 1px solid rgba(31, 92, 67, 0.1);">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">
                <span style="display: flex; align-items: center; gap: 4px;"><i data-lucide="sparkles" style="width: 12px; height: 12px; color: var(--color-accent-light);"></i> Cupo Gemini OCR mensual:</span>
                <span id="ocr-quota-text" style="color: var(--color-primary);">${ocrScans} / ${ocrLimit}</span>
              </div>
              <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.06); border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color); margin-bottom: 6px;">
                <div id="ocr-quota-bar" style="width: ${quotaPercent}%; height: 100%; background: ${ocrScans >= ocrLimit ? '#ef4444' : 'linear-gradient(90deg, var(--color-accent) 0%, #a855f7 100%)'}; border-radius: 4px; transition: width 0.3s ease;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                <span id="ocr-quota-warning" style="font-size: 10px; color: ${ocrScans >= ocrLimit ? '#ef4444' : '#f59e0b'}; font-weight: 700;">
                  ${ocrScans >= ocrLimit ? '⚠️ Cupo mensual agotado.' : ocrScans >= (ocrLimit * 0.8) ? '⚠️ Cupo próximo al límite.' : '✓ Cupo disponible.'}
                </span>
                <div style="display:flex; gap:6px;">
                  <button type="button" id="btn-portal-manual-entry" class="btn btn-outline btn-xs" style="font-size: 9.5px; padding: 2px 8px; height: auto; border-color: rgba(245, 158, 11, 0.3); color: #fbbf24; font-weight: 700;">
                    Carga Manual
                  </button>
                  <button type="button" id="btn-increase-ocr-quota" class="btn btn-outline btn-xs" style="font-size: 9.5px; padding: 2px 8px; height: auto; border-color: rgba(31, 92, 67, 0.3); color: var(--color-accent-light); font-weight: 700;">
                    Aumentar Límite
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Progress animation -->
          <div id="ticket-progress" style="display: none; text-align: center; padding: 16px;">
            <div class="spinner" style="margin: 0 auto 12px; border-left-color: var(--color-accent-light);"></div>
            <p style="font-size: 13px; font-weight: 600;" id="ticket-progress-txt">Subiendo y extrayendo datos con IA...</p>
          </div>
        </div>
      </div>

      <!-- PANEL 2: FACTURADOR DIRECTO ARCA (BILLING) -->
      <div id="portal-panel-invoice" style="display: none;" class="card">
        <div class="card-header" style="border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="zap" style="color: var(--color-accent);"></i> 
            <h3 style="margin: 0;">Emitir Factura Electrónica ARCA</h3>
          </div>
          <span class="badge" style="margin: 0; font-size: 10px; background: rgba(47, 122, 89, 0.08); color: var(--color-accent-light); border-color: rgba(47, 122, 89, 0.2);">WSFE v1.3 Directo</span>
        </div>
        <div class="card-body">
          <form id="billing-form" style="display: flex; flex-direction: column; gap: 18px;">
            
            <!-- Comprobante / Concepto / Actividad -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="font-size: 11.5px; font-weight: 700; display: block; margin-bottom: 6px; color: var(--color-primary);">Tipo de Comprobante</label>
                <select id="invoice-type" class="form-input" style="width: 100%; padding: 8px 12px; background: #fff; font-size: 12.5px;">
                  ${allowedComprobante}
                </select>
              </div>
              <div>
                <label style="font-size: 11.5px; font-weight: 700; display: block; margin-bottom: 6px; color: var(--color-primary);">Concepto Comercial</label>
                <select id="invoice-concept" class="form-input" style="width: 100%; padding: 8px 12px; background: #fff; font-size: 12.5px;">
                  <option value="1">1 - Productos</option>
                  <option value="2" selected>2 - Servicios</option>
                  <option value="3">3 - Productos y Servicios</option>
                </select>
              </div>
            </div>

            <!-- Dyn. Services dates section -->
            <div id="service-dates-container" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
              <div>
                <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Servicios Desde</label>
                <input type="date" id="service-from" class="form-input" style="width:100%; padding: 6px; font-size:11.5px;">
              </div>
              <div>
                <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Servicios Hasta</label>
                <input type="date" id="service-to" class="form-input" style="width:100%; padding: 6px; font-size:11.5px;">
              </div>
              <div>
                <label style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Vto Pago Gasto</label>
                <input type="date" id="service-due" class="form-input" style="width:100%; padding: 6px; font-size:11.5px;">
              </div>
            </div>

            <!-- Receptor details -->
            <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; display: flex; flex-direction: column; gap: 12px;">
              <div style="font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: flex; justify-content: space-between;">
                <span>Datos del Receptor</span>
                <span style="color: var(--color-accent); cursor: pointer; font-weight: 700;" id="btn-quick-fill-cuit">🔀 CUIT Aleatorio</span>
              </div>
              
              <div style="display: flex; gap: 10px; align-items: flex-end;">
                <div style="flex: 1;">
                  <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-secondary);">CUIT / Documento del Cliente</label>
                  <input type="text" id="invoice-cuit" class="form-input font-mono" style="width: 100%; padding: 7px 10px; font-size: 12.5px; background: #fff;" placeholder="CUIT sin guiones (ej: 30708608833)..." value="">
                  <div id="cuit-validation-badge" style="font-size: 10px; font-weight: 600; margin-top: 4px; display: none;"></div>
                </div>
                <button type="button" id="btn-search-padron" class="btn btn-outline" style="height: 34px; padding: 0 12px; font-size: 11.5px; display: flex; align-items: center; gap: 4px;">
                  <i data-lucide="search" style="width: 14px; height: 14px;"></i> Buscar
                </button>
              </div>

              <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 12px;">
                <div>
                  <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-secondary);">Razón Social o Nombre Completo</label>
                  <input type="text" id="invoice-name" class="form-input" style="width: 100%; padding: 7px 10px; font-size: 12.5px; background: #fff;" placeholder="Auto-completar desde padrón..." value="">
                </div>
                <div>
                  <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-secondary);">Condición Impositiva</label>
                  <select id="invoice-iva-cond" class="form-input" style="width: 100%; padding: 7px 10px; font-size: 12.5px; background: #fff;">
                    <option value="Responsable Inscripto" selected>Responsable Inscripto</option>
                    <option value="Monotributo">Monotributista</option>
                    <option value="Consumidor Final">Consumidor Final</option>
                    <option value="Exento">Exento</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Multi-item Grid Dynamic System -->
            <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; display: flex; flex-direction: column; gap: 12px;">
              <div style="font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: flex; justify-content: space-between; align-items: center;">
                <span>Detalle de Facturación (Grid Multilínea)</span>
                <button type="button" id="btn-add-item-row" class="btn btn-xs btn-outline" style="font-size: 10px; display: flex; align-items: center; gap: 2px; padding: 2px 8px; height: auto;">
                  <i data-lucide="plus" style="width: 12px; height: 12px;"></i> Agregar Ítem
                </button>
              </div>

              <!-- Item rows wrapper -->
              <div id="invoice-items-rows-container" style="display: flex; flex-direction: column; gap: 10px;">
                <!-- Filled dynamically by JavaScript -->
              </div>
            </div>

            <!-- Tax breakdowns & Perception Engine -->
            <div style="background: rgba(31, 92, 67, 0.02); border: 1px solid rgba(31, 92, 67, 0.15); border-radius: var(--radius-sm); padding: 14px; display: flex; flex-direction: column; gap: 8px;">
              <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 10px; align-items: center; border-bottom: 1px dashed rgba(31, 92, 67, 0.15); padding-bottom: 10px; margin-bottom: 6px;">
                <label style="font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--color-primary); margin:0;">
                  <input type="checkbox" id="chk-apply-iibb" style="width:14px; height:14px; cursor:pointer;">
                  Liquidar Percepción IIBB
                </label>
                <select id="select-iibb-prov" class="form-input" style="padding: 4px 8px; font-size:11.5px; background: #fff;" disabled>
                  <option value="CABA_1.5" selected>CABA (1.5%)</option>
                  <option value="BSAS_2.0">Buenos Aires (2.0%)</option>
                  <option value="CBA_3.0">Córdoba (3.0%)</option>
                  <option value="SFE_2.5">Santa Fe (2.5%)</option>
                  <option value="MZA_1.8">Mendoza (1.8%)</option>
                </select>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary);">
                <span>Subtotal Neto Gravado:</span>
                <span class="font-mono" style="font-weight: 700;" id="invoice-calc-neto">$ 0,00</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary);" id="invoice-vat-row">
                <span>IVA Discriminado:</span>
                <span class="font-mono" style="font-weight: 700; color: var(--color-accent-light);" id="invoice-calc-iva">$ 0,00</span>
              </div>
              <div style="display: none; justify-content: space-between; font-size: 12px; color: var(--text-secondary);" id="invoice-iibb-row">
                <span>Percepción IIBB:</span>
                <span class="font-mono" style="font-weight: 700; color: #e11d48;" id="invoice-calc-iibb">$ 0,00</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 14.5px; font-weight: 800; border-top: 1px solid rgba(31, 92, 67, 0.15); padding-top: 8px;">
                <span style="color: var(--color-primary);">TOTAL FACTURADO:</span>
                <span class="font-mono" style="color: var(--color-accent);" id="invoice-calc-total">$ 0,00</span>
              </div>
            </div>

            <!-- Customizer controls -->
            <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 10px; align-items: center;">
              <div>
                <label style="font-size: 11px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-secondary);">Estilo Comercial (Theme)</label>
                <select id="invoice-theme-select" class="form-input" style="width: 100%; padding: 4px 8px; font-size: 11.5px; background: #fff;">
                  <option value="slate" selected>Slate Professional (Gris/Negro)</option>
                  <option value="emerald">Emerald Premium (Verde)</option>
                  <option value="navy">Navy Executive (Azul)</option>
                </select>
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; cursor: pointer; margin:0; margin-top: 16px;">
                  <input type="checkbox" id="chk-include-logo" style="width:14px; height:14px; cursor:pointer;" checked>
                  Incrustar Logo
                </label>
              </div>
            </div>

            <!-- Actions -->
            <button type="button" id="btn-emitir-factura" class="btn btn-primary w-full" style="background: linear-gradient(135deg, var(--color-accent-light) 0%, var(--color-accent) 100%); border: none; font-size: 13.5px; font-weight: 800; height: 44px; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: var(--shadow-sm);">
              <i data-lucide="zap"></i> Solicitar CAE & Emitir Comprobante
            </button>

          </form>

          <!-- SOAP Cryptographic Handshake Loading Overlay -->
          <div id="invoice-loading-overlay" style="display: none; text-align: center; padding: 24px 16px;">
            <div class="spinner" style="margin: 0 auto 20px; border-left-color: var(--color-accent); width: 44px; height: 44px; animation: spin 0.8s linear infinite;"></div>
            <h4 style="font-size: 15px; font-weight: 800; color: var(--color-primary); margin-bottom: 8px;">Enlace Seguro WSAA/WSFE con ARCA</h4>
            <p id="invoice-loading-status" style="font-size: 13px; color: var(--text-secondary); max-width: 320px; margin: 0 auto 16px; line-height: 1.5;">Iniciando canal seguro TLS 1.3 con servidores impositivos...</p>
            
            <!-- Immersive SOAP XML terminal block -->
            <div style="text-align: left; background: var(--text-primary); border: 1px solid #1e293b; border-radius: var(--radius-sm); padding: 12px; margin: 0 auto 16px; max-width: 480px; box-shadow: var(--shadow-sm);">
              <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:700; color:var(--text-secondary); font-family:var(--font-mono); border-bottom:1px solid #1e293b; padding-bottom:6px; margin-bottom:8px;">
                <span>TERMINAL LOG PROTOCOLO XML SOAP</span>
                <span style="color:var(--color-accent-light);">● CONECTADO</span>
              </div>
              <div id="soap-xml-terminal" style="font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: var(--text-muted); height: 160px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; line-height: 1.3;">
                <!-- Changing real SOAP envelopes injected here -->
              </div>
            </div>

            <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px; text-align: left; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--text-muted); max-width: 480px; margin: 0 auto;">
              <div id="log-seq-1" style="margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                <span class="seq-dot" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent);"></span>
                <span>Enlace a Pasarela de Autenticación WSAA...</span>
              </div>
              <div id="log-seq-2" style="margin-bottom: 4px; display: flex; align-items: center; gap: 6px; opacity: 0.4;">
                <span class="seq-dot" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted);"></span>
                <span>Firma Criptográfica XML SOAP (TA.xml)...</span>
              </div>
              <div id="log-seq-3" style="display: flex; align-items: center; gap: 6px; opacity: 0.4;">
                <span class="seq-dot" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted);"></span>
                <span>Despacho Lote y CAE en WSFE...</span>
              </div>
            </div>
          </div>

          <!-- SUCCESS INVOICE RECEIPT -->
          <div id="invoice-success-receipt" style="display: none; flex-direction: column; gap: 20px;">
            <div style="text-align: center; padding: 10px 0 0 0;">
              <div style="background: rgba(47, 122, 89, 0.08); border: 1px solid rgba(47, 122, 89, 0.2); width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--color-accent-light); margin: 0 auto 10px;">
                <i data-lucide="check-circle-2" style="width: 22px; height: 22px;"></i>
              </div>
              <h4 style="font-size: 15px; font-weight: 800; color: var(--color-primary); margin-bottom: 4px;">¡Comprobante Autorizado por ARCA!</h4>
              <p style="font-size: 12px; color: var(--text-secondary); margin: 0;">La venta fue indexada y notificada de forma real en la cuenta del estudio contable.</p>
            </div>

            <!-- Success Actions -->
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-outline" id="btn-download-pdf-invoice" style="flex: 1; font-size: 12px; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <i data-lucide="download"></i> Guardar Recibo Comercial
              </button>
              <button class="btn btn-outline" id="btn-share-invoice" style="flex: 1; font-size: 12px; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <i data-lucide="share-2"></i> Copiar Enlace
              </button>
            </div>

            <div style="display: flex; gap: 8px;">
              <button class="btn btn-outline" id="btn-export-reginfo" style="flex: 1; border-color: rgba(31, 92, 67, 0.3); color: var(--color-accent); font-weight:700; font-size: 11.5px; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <i data-lucide="file-text"></i> Libro IVA Digital AFIP (.txt)
              </button>
              <button class="btn btn-primary" id="btn-emit-another-invoice" style="flex: 1; background: var(--color-accent); border-color: var(--color-accent); font-weight: 700; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <i data-lucide="plus"></i> Nueva Factura
              </button>
            </div>
          </div>

        </div>
      </div>

    </div>

    <!-- Right Column: Interactive Real-Time Preview OR Digital Documents Register -->
    <div style="display: flex; flex-direction: column; gap: 20px; position: sticky; top: 24px;">
      
      <!-- STICKY REAL-TIME HIGH-FIDELITY PREVIEW -->
      <div id="portal-live-preview-card" class="card" style="display: none; border-color: var(--border-color); overflow: hidden;">
        <div class="card-header" style="background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
          <h4 style="font-size: 11.5px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">Previsualización en Tiempo Real</h4>
          <span style="font-size: 10px; font-weight: 700; color: var(--color-accent); background: rgba(31, 92, 67, 0.08); padding: 2px 8px; border-radius: 4px;">Factura Electrónica</span>
        </div>
        <div class="card-body" style="padding: 16px; background: var(--bg-secondary);">
          
          <!-- AFIP Official Looking Invoice Panel -->
          <div id="live-invoice-pdf-replica" class="afip-invoice-wrapper" style="background: #fff; border: 1.5px solid var(--text-primary); border-radius: var(--radius-sm); padding: 16px; font-family: 'Inter', system-ui, sans-serif; color: #000; box-shadow: var(--shadow-sm); transition: all 0.2s;">
            <!-- Rendered Reactively in JS -->
          </div>

        </div>
      </div>

      <!-- DIGITAL TICKETS REGISTER (Always visible, changes scroll) -->
      <div class="card" style="margin-bottom: 0;">
        <div class="card-header" style="border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;"><i data-lucide="check-square"></i> Registro de Comprobantes</h3>
          <span class="badge" style="margin: 0; font-size: 10px; color:var(--color-accent-light); border-color: rgba(31, 92, 67, 0.2); background: rgba(31, 92, 67, 0.05);">Control Mensual</span>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Comprobante</th>
                  <th class="text-right">Monto</th>
                  <th>Estado</th>
                  <th class="text-center">Acción</th>
                </tr>
              </thead>
              <tbody id="ticket-table-body">
                ${tickets.map(t => `
                  <tr>
                    <td class="font-mono text-xs">${t.fecha.split('-').reverse().join('/')}</td>
                    <td>
                      <div style="font-weight: 600; font-size: 12px; color: var(--color-primary);">${t.detalle}</div>
                      <div style="font-size: 10px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                        <i data-lucide="file" style="width: 10px; height: 10px;"></i> ${t.archivo}
                        ${t.es_activo ? `
                          <span style="font-size: 8px; font-weight: 700; color: var(--color-accent-light); background: rgba(31, 92, 67, 0.08); padding: 1px 4px; border-radius: 3px; border: 1px solid rgba(31, 92, 67, 0.2);">BIEN DE USO</span>
                        ` : `
                          <span style="font-size: 8px; font-weight: 600; color: var(--text-muted); background: var(--bg-secondary); padding: 1px 4px; border-radius: 3px; border: 1px solid var(--border-color);">${t.tipo === 'Venta' ? 'VENTA EMITIDA' : 'GASTO (' + (t.categoria || 'General') + ')'}</span>
                        `}
                      </div>
                    </td>
                    <td class="font-mono text-right" style="font-weight: 700; color: ${t.tipo === 'Venta' ? 'var(--color-accent-light)' : 'inherit'};">
                      ${t.tipo === 'Venta' ? '+' : '-'} $ ${t.monto.toLocaleString('es-AR')}
                    </td>
                    <td>
                      <span class="badge-status ${t.estado === 'Aprobado' ? 'active' : (t.estado === 'Procesado' ? 'pending' : 'inactive')}" style="font-size: 10px; padding: 1px 6px;">
                        ${t.estado}
                      </span>
                    </td>
                    <td class="text-center">
                      ${t.tipo !== 'Venta' ? `
                        <button class="btn btn-outline btn-xs btn-reconstruct-ticket" data-id="${t.id}" title="Reconstruir comprobante térmico: Genera una réplica digital exacta del ticket en base a la información extraída por la IA, lista para descargar o imprimir." style="display:inline-flex; align-items:center; gap:2px; font-size:9.5px; padding: 2px 6px; border-color: rgba(31, 92, 67, 0.3); color:var(--color-accent-light);">
                          <i data-lucide="sparkles" style="width:10px; height:10px; color:var(--color-accent-light);"></i> Reconstruir
                        </button>
                      ` : `
                        <span class="text-muted" style="font-size:9.5px;">Efectuada</span>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>

  </div>

  <!-- Modal Reconstrucción Térmica Vectorial [NEW FEATURE] -->
  <div id="reconstruct-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.25s ease;">
    <div class="card" style="width: 100%; max-width: 440px; border-color: var(--border-color); overflow: hidden; transform: scale(0.95); animation: zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;">
      <div class="card-header" style="background: rgba(31, 92, 67, 0.03); border-bottom-color: var(--border-color); display:flex; justify-content:space-between; align-items:center;">
        <h3 style="color:var(--color-accent-light); display:flex; align-items:center; gap:6px;"><i data-lucide="sparkles"></i> Reconstrucción de Ticket OCR</h3>
        <button class="btn-icon-sm" id="btn-close-reconstruct-modal" title="Cerrar"><i data-lucide="x"></i></button>
      </div>
      <div class="card-body" style="background: var(--bg-secondary); padding: 20px; display:flex; flex-direction:column; gap:16px;">
        <p class="text-secondary" style="font-size: 11.5px; line-height: 1.4; margin:0;">
          El motor de IA Gemini 2.5 Flash procesó la imagen del comprobante deteriorado y re-generó este ticket digital vectorial de alta fidelidad comercial.
        </p>

        <!-- Thermal Receipt Box styling -->
        <div class="receipt-print-container" style="background: #fdfdfd; border: 1px solid #e2e8f0; border-radius: 4px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.06); padding: 24px; font-family: 'Courier New', Courier, monospace; color: #000; font-size: 11px; line-height: 1.4;">
          <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 12px; margin-bottom: 12px;">
            <div style="font-weight: 900; font-size: 14px; text-transform: uppercase;" id="rec-vendor-name">YPF S.A.</div>
            <div style="font-size: 9px; margin-top:2px;" id="rec-vendor-address">Av. Macacha Güemes 515, CABA</div>
            <div style="font-size: 9px;" id="rec-vendor-cuit">CUIT: 30-50001234-9</div>
            <div style="font-size: 9px;">IVA RESPONSABLE INSCRIPTO</div>
          </div>

          <div style="border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 10px; font-size: 9.5px;">
            <div>FECHA: <span id="rec-date">25/05/2026</span></div>
            <div>TICKET FACTURA B N°: <span id="rec-ticket-num">0004-00192834</span></div>
            <div>CLIENTE: CONSUMIDOR FINAL</div>
          </div>

          <!-- Items Table inside receipt -->
          <div style="border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 10px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
              <thead>
                <tr style="border-bottom: 1px solid #000; text-align: left; font-weight:900;">
                  <th style="padding-bottom:4px;">DESCRIPCIÓN</th>
                  <th style="text-align: right; padding-bottom:4px; width: 40px;">CANT</th>
                  <th style="text-align: right; padding-bottom:4px; width: 60px;">TOTAL</th>
                </tr>
              </thead>
              <tbody id="rec-items-body">
                <!-- Injected dynamically by JS -->
              </tbody>
            </table>
          </div>

          <!-- Totals -->
          <div style="display:flex; flex-direction:column; gap:4px; font-size: 10px; align-items:flex-end;">
            <div style="display:flex; justify-content:space-between; width: 140px;">
              <span>NETO:</span>
              <span id="rec-neto">$ 15.289,26</span>
            </div>
            <div style="display:flex; justify-content:space-between; width: 140px;">
              <span>IVA (21%):</span>
              <span id="rec-iva">$ 3.210,74</span>
            </div>
            <div style="display:flex; justify-content:space-between; width: 140px; font-weight:900; font-size:11px; border-top:1px solid #000; padding-top:4px;">
              <span>TOTAL:</span>
              <span id="rec-total">$ 18.500,00</span>
            </div>
          </div>

          <!-- Receipt Footer barcode & QR lookalike -->
          <div style="text-align:center; margin-top:20px; font-size:8px; border-top: 1px dashed #000; padding-top:12px;">
            <div style="width:100px; height:24px; margin: 0 auto 6px; background: repeating-linear-gradient(90deg, #000, #000 1px, #fff 1px, #fff 3px);"></div>
            <div id="rec-cae">CAE N°: 76239485012398</div>
            <div id="rec-cae-vto">Vence: 04/06/2026</div>
            <div style="margin-top:4px;">¡Gracias por su compra!</div>
          </div>
        </div>

        <!-- Download receipt action -->
        <div style="display:flex; gap:8px;">
          <button class="btn btn-outline w-full" id="btn-print-thermal-receipt" style="font-size:12px; height:36px; display:flex; align-items:center; justify-content:center; gap:4px;">
            <i data-lucide="printer"></i> Imprimir Ticket
          </button>
          <button class="btn btn-primary w-full" id="btn-download-thermal-txt" style="font-size:12px; height:36px; display:flex; align-items:center; justify-content:center; gap:4px;">
            <i data-lucide="download"></i> Descargar Ticket
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal de Cupo Excedido [NEW] -->
  <div id="ocr-quota-exceeded-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.25s ease;">
    <div class="card" style="width: 100%; max-width: 400px; border-color: #ef4444; overflow: hidden; transform: scale(0.95); animation: zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;">
      <div class="card-header" style="background: rgba(239, 68, 68, 0.03); border-bottom-color: var(--border-color); display:flex; justify-content:space-between; align-items:center;">
        <h3 style="color:#ef4444; display:flex; align-items:center; gap:6px;"><i data-lucide="alert-triangle"></i> Límite de Escaneos Excedido</h3>
        <button class="btn-icon-sm" id="btn-close-quota-modal" title="Cerrar"><i data-lucide="x"></i></button>
      </div>
      <div class="card-body" style="background: var(--bg-secondary); padding: 20px; display:flex; flex-direction:column; gap:16px; text-align: center;">
        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ef4444; margin: 0 auto;">
          <i data-lucide="lock" style="width: 28px; height: 28px;"></i>
        </div>
        <h4 style="font-size: 15px; font-weight: 800; color: var(--color-primary); margin: 0;">Llegaste al límite de 300 escaneos Gemini OCR</h4>
        <p class="text-secondary" style="font-size: 12.5px; line-height: 1.5; margin:0;">
          Tu abono mensual actual incluye un límite de 300 digitalizaciones automáticas con IA. Para seguir procesando comprobantes sin interrupción, solicita una extensión de cupo.
        </p>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top: 8px;">
          <button class="btn btn-primary w-full" id="btn-upgrade-quota-modal" style="background: linear-gradient(135deg, var(--color-accent) 0%, #a855f7 100%); border: none; font-size: 13px; font-weight: 800; height: 40px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <i data-lucide="sparkles"></i> Aumentar Cupo a 400 Escaneos
          </button>
          <button class="btn btn-outline w-full" id="btn-manual-entry-fallback" style="font-size:12.5px; height:40px; border-color:#fbbf24; color:#f59e0b; display:flex; align-items:center; justify-content:center; gap:6px;">
            <i data-lucide="keyboard"></i> Carga Manual (Alternativa)
          </button>
          <button class="btn btn-outline w-full" id="btn-cancel-quota-modal" style="font-size:12px; height:36px;">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </div>
  `;
}

export function initPortalCliente(mainApp) {
  if (window.lucide) window.lucide.createIcons();

  const activeCompany = getActiveCompany();
  const isMonotributo = activeCompany.condicion_iva.includes('Monotributo');

  // Inject styles for tab switching, split screen and invoice replica themes
  const styleId = 'portal-custom-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .portal-tab-btn { background: transparent; border: 1px solid transparent; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; }
      .portal-tab-btn:hover { background: rgba(31, 92, 67, 0.04); color: var(--color-primary); }
      .portal-tab-btn.active { background: var(--color-accent) !important; border-color: var(--color-accent) !important; color: white !important; box-shadow: var(--shadow-sm); }
      
      .afip-invoice-wrapper { background: #fff; border: 1.5px solid var(--text-primary); border-radius: var(--radius-sm); padding: 16px; color: #000; box-shadow: var(--shadow-sm); transition: all 0.2s; }
      
      /* Theme Slate */
      .invoice-theme-slate { border-color: var(--text-primary) !important; }
      .invoice-theme-slate .receipt-theme-bg { background-color: #f1f5f9 !important; border-color: var(--text-primary) !important; color: var(--text-primary) !important; }
      .invoice-theme-slate .invoice-title-color { color: #000000 !important; }
      .invoice-theme-slate .table-border-custom { border-bottom: 2px solid #000 !important; }
      .invoice-theme-slate .accent-text-theme { color: var(--text-primary) !important; }

      /* Theme Emerald */
      .invoice-theme-emerald { border-color: var(--color-accent) !important; }
      .invoice-theme-emerald .receipt-theme-bg { background-color: #ecfdf5 !important; border-color: var(--color-accent) !important; color: #064e3b !important; }
      .invoice-theme-emerald .invoice-title-color { color: var(--color-accent) !important; }
      .invoice-theme-emerald .table-border-custom { border-bottom: 2px solid var(--color-accent) !important; }
      .invoice-theme-emerald .accent-text-theme { color: var(--color-accent) !important; }

      /* Theme Navy */
      .invoice-theme-navy { border-color: #1d4ed8 !important; }
      .invoice-theme-navy .receipt-theme-bg { background-color: #eff6ff !important; border-color: #1d4ed8 !important; color: #1e3a8a !important; }
      .invoice-theme-navy .invoice-title-color { color: #1d4ed8 !important; }
      .invoice-theme-navy .table-border-custom { border-bottom: 2px solid #1d4ed8 !important; }
      .invoice-theme-navy .accent-text-theme { color: #1d4ed8 !important; }

      .afip-sample-pill { cursor: pointer; transition: all 0.2s; }
      .afip-sample-pill:hover { border-color: var(--color-accent) !important; background: rgba(31, 92, 67, 0.02); }
      
      .item-remove-btn { color: #ef4444; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px; transition: background 0.2s; }
      .item-remove-btn:hover { background: rgba(239, 68, 68, 0.08); }
    `;
    document.head.appendChild(style);
  }

  // DOM Elements
  const tabs = document.querySelectorAll('.portal-tab-btn');
  const panelUpload = document.getElementById('portal-panel-upload');
  const panelInvoice = document.getElementById('portal-panel-invoice');
  const geminiStatusCard = document.getElementById('gemini-status-card');
  const livePreviewCard = document.getElementById('portal-live-preview-card');

  const dropzone = document.getElementById('ticket-dropzone');
  const fileInput = document.getElementById('ticket-file-input');
  const btnSim = document.getElementById('btn-simulate-ticket');
  const btnSimAsset = document.getElementById('btn-simulate-asset');
  
  const progressContainer = document.getElementById('ticket-progress');
  const progressTxt = document.getElementById('ticket-progress-txt');
  const tableBody = document.getElementById('ticket-table-body');

  // Billing DOM Elements
  const billingForm = document.getElementById('billing-form');
  const btnEmitirFactura = document.getElementById('btn-emitir-factura');
  const invoiceLoadingOverlay = document.getElementById('invoice-loading-overlay');
  const invoiceLoadingStatus = document.getElementById('invoice-loading-status');
  const soapXmlTerminal = document.getElementById('soap-xml-terminal');
  const logSeq1 = document.getElementById('log-seq-1');
  const logSeq2 = document.getElementById('log-seq-2');
  const logSeq3 = document.getElementById('log-seq-3');
  const invoiceSuccessReceipt = document.getElementById('invoice-success-receipt');

  // Customizer Inputs
  const themeSelect = document.getElementById('invoice-theme-select');
  const chkIncludeLogo = document.getElementById('chk-include-logo');

  // Input Fields for Billing
  const inputCuit = document.getElementById('invoice-cuit');
  const cuitBadge = document.getElementById('cuit-validation-badge');
  const inputName = document.getElementById('invoice-name');
  const selectIvaCond = document.getElementById('invoice-iva-cond');
  const selectType = document.getElementById('invoice-type');
  const selectConcept = document.getElementById('invoice-concept');
  const serviceDatesContainer = document.getElementById('service-dates-container');
  const serviceFrom = document.getElementById('service-from');
  const serviceTo = document.getElementById('service-to');
  const serviceDue = document.getElementById('service-due');

  // Items grid container
  const itemsContainer = document.getElementById('invoice-items-rows-container');
  const btnAddItemRow = document.getElementById('btn-add-item-row');

  // Calculations DOM
  const calcNeto = document.getElementById('invoice-calc-neto');
  const calcIva = document.getElementById('invoice-calc-iva');
  const calcTotal = document.getElementById('invoice-calc-total');
  const vatRow = document.getElementById('invoice-vat-row');
  const chkApplyIibb = document.getElementById('chk-apply-iibb');
  const selectIibbProv = document.getElementById('select-iibb-prov');
  const iibbRow = document.getElementById('invoice-iibb-row');
  const calcIibb = document.getElementById('invoice-calc-iibb');

  // Success state parameters cached
  let lastEmittedCompNum = "00000000";
  let lastEmittedNeto = 0;
  let lastEmittedIva = 0;
  let lastEmittedIibb = 0;
  let lastEmittedTotal = 0;
  let lastEmittedType = "Factura A";

  // Pre-initialize service dates (Mayo 2026 default)
  serviceFrom.value = "2026-05-01";
  serviceTo.value = "2026-05-31";
  
  const dueDefault = new Date("2026-06-10");
  serviceDue.value = dueDefault.toISOString().slice(0, 10);

  // Initialize Items State array
  let invoiceItems = [
    { desc: "Servicios Profesionales de Asesoramiento - Mayo 2026", qty: 1, price: 150000, vat: 21 }
  ];

  // -------------------------------------------------------------
  // TAB SWITCHING LOGIC
  // -------------------------------------------------------------
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const selectedTab = tab.dataset.tab;
      if (selectedTab === 'upload') {
        panelUpload.style.display = 'block';
        panelInvoice.style.display = 'none';
        geminiStatusCard.style.display = 'block';
        livePreviewCard.style.display = 'none';
      } else {
        panelUpload.style.display = 'none';
        panelInvoice.style.display = 'block';
        geminiStatusCard.style.display = 'none';
        livePreviewCard.style.display = 'block';
        calculateTotalsAndPreview(); // Refresh sums and rendering
      }
    });
  });

  // -------------------------------------------------------------
  // CONCEPT CHANGE TOGGLES SERVICE DATES
  // -------------------------------------------------------------
  selectConcept?.addEventListener('change', () => {
    const concept = selectConcept.value;
    if (concept === '1') {
      serviceDatesContainer.style.display = 'none';
    } else {
      serviceDatesContainer.style.display = 'grid';
    }
    calculateTotalsAndPreview();
  });

  // IIBB Enable/Disable Select
  chkApplyIibb?.addEventListener('change', () => {
    selectIibbProv.disabled = !chkApplyIibb.checked;
    calculateTotalsAndPreview();
  });

  selectIibbProv?.addEventListener('change', () => {
    calculateTotalsAndPreview();
  });

  themeSelect?.addEventListener('change', () => {
    calculateTotalsAndPreview();
  });

  chkIncludeLogo?.addEventListener('change', () => {
    calculateTotalsAndPreview();
  });

  // -------------------------------------------------------------
  // REAL-TIME TOTALS CALCULATOR & HIGH-FIDELITY LIVE PREVIEW
  // -------------------------------------------------------------
  const calculateTotalsAndPreview = () => {
    let subtotalNeto = 0;
    let totalIva = 0;

    invoiceItems.forEach(item => {
      const qty = item.qty || 1;
      const price = item.price || 0;
      const vatPct = isMonotributo ? 0 : (item.vat || 0);

      const neto = qty * price;
      const iva = neto * (vatPct / 100);

      subtotalNeto += neto;
      totalIva += iva;
    });

    // Percepciones calculation
    let iibbVal = 0;
    if (chkApplyIibb && chkApplyIibb.checked) {
      const iibbSelected = selectIibbProv.value; // Format: PROV_rate
      const rate = Number(iibbSelected.split('_')[1]) || 0;
      iibbVal = subtotalNeto * (rate / 100);
      iibbRow.style.display = 'flex';
      calcIibb.textContent = `$ ${iibbVal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      iibbRow.style.display = 'none';
    }

    const totalGeneral = subtotalNeto + totalIva + iibbVal;

    // Cache calculation parameters
    lastEmittedNeto = subtotalNeto;
    lastEmittedIva = totalIva;
    lastEmittedIibb = iibbVal;
    lastEmittedTotal = totalGeneral;
    lastEmittedType = selectType.value;

    // Set panel summaries
    calcNeto.textContent = `$ ${subtotalNeto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (isMonotributo) {
      vatRow.style.display = 'none';
      calcTotal.textContent = `$ ${totalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      vatRow.style.display = 'flex';
      calcIva.textContent = `$ ${totalIva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      calcTotal.textContent = `$ ${totalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // UPDATE LIVE HIGH-FIDELITY PREVIEW IN REAL TIME
    renderLivePreviewMarkup();
  };

  const renderLivePreviewMarkup = () => {
    const activeTheme = themeSelect.value;
    const typeLabel = selectType.value;
    const compLetter = typeLabel.slice(-1);
    const conceptLabel = selectConcept.options[selectConcept.selectedIndex]?.text || "2 - Servicios";
    
    // Formatting date
    const dateToday = new Date().toLocaleDateString('es-AR');
    
    const clientName = inputName.value.trim() || "Cliente en Padrón (Complete CUIT)";
    const clientCuitStr = inputCuit.value.trim() || "XX-XXXXXXXX-X";
    const clientIvaCondStr = selectIvaCond.value;

    // Custom Logo SVG in Theme
    const companyLogoHtml = chkIncludeLogo.checked ? `
      <div class="accent-text-theme" style="width: 32px; height: 32px; flex-shrink: 0;">
        <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="20" fill="currentColor" fill-opacity="0.08"/>
          <path d="M50 15L85 45L70 85L30 85L15 45L50 15Z" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
          <circle cx="50" cy="50" r="12" fill="currentColor"/>
        </svg>
      </div>
    ` : '';

    const isConceptServices = selectConcept.value !== '1';
    const datesLegend = isConceptServices ? `
      <div style="grid-column: span 3; border-top: 1px dashed #e2e8f0; margin-top: 4px; padding-top: 4px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 8.5px; color: var(--text-secondary);">
        <span><strong>Servicio Desde:</strong> ${serviceFrom.value.split('-').reverse().join('/')}</span>
        <span><strong>Servicio Hasta:</strong> ${serviceTo.value.split('-').reverse().join('/')}</span>
        <span><strong>Vencimiento Pago:</strong> ${serviceDue.value.split('-').reverse().join('/')}</span>
      </div>
    ` : '';

    // Render items table
    let tableItemsRows = '';
    invoiceItems.forEach((item, index) => {
      const qty = item.qty || 1;
      const price = item.price || 0;
      const vatPct = isMonotributo ? 0 : (item.vat || 0);
      const subtotal = qty * price;
      
      tableItemsRows += `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 5px 0; color: #1e293b; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.desc || '(Detalle vacío)'}</td>
          <td style="text-align: center; padding: 5px 0; font-family: monospace;">${qty}</td>
          <td style="text-align: right; padding: 5px 0; font-family: monospace;">$${price.toLocaleString('es-AR')}</td>
          ${!isMonotributo && compLetter === 'A' ? `<td style="text-align: right; padding: 5px 0; font-family: monospace; color:var(--color-accent);">${vatPct}%</td>` : ''}
          <td style="text-align: right; padding: 5px 0; font-family: monospace; font-weight: 700;">$${subtotal.toLocaleString('es-AR')}</td>
        </tr>
      `;
    });

    const isRIAndTypeA = !isMonotributo && compLetter === 'A';

    let taxBreakdownHtml = '';
    if (isMonotributo) {
      taxBreakdownHtml = `
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal:</span>
          <strong>$ ${lastEmittedNeto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
      `;
    } else {
      taxBreakdownHtml = `
        <div style="display: flex; justify-content: space-between;">
          <span>Neto Gravado:</span>
          <strong>$ ${lastEmittedNeto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>IVA Liquidado:</span>
          <strong class="accent-text-theme">$ ${lastEmittedIva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
      `;
    }

    if (chkApplyIibb.checked) {
      const iibbSelected = selectIibbProv.value;
      const provName = iibbSelected.split('_')[0];
      const provRate = iibbSelected.split('_')[1];
      taxBreakdownHtml += `
        <div style="display: flex; justify-content: space-between; color: #e11d48;">
          <span>Percep. IIBB ${provName} (${provRate}%):</span>
          <strong>$ ${lastEmittedIibb.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
      `;
    }

    const codeNumStr = isMonotributo ? '011' : (compLetter === 'A' ? '001' : '006');

    const previewContainer = document.getElementById('live-invoice-pdf-replica');
    if (previewContainer) {
      previewContainer.className = `afip-invoice-wrapper invoice-theme-${activeTheme}`;
      previewContainer.innerHTML = `
        <!-- Receipt Top Header -->
        <div style="display: flex; justify-content: space-between; align-items: stretch; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px;" class="table-border-custom">
          
          <div style="display: flex; flex-direction: column; gap: 2px; justify-content: space-between; flex:1;">
            <div style="display: flex; align-items: center; gap: 6px;">
              ${companyLogoHtml}
              <div style="font-size: 11px; font-weight: 900; letter-spacing: -0.2px;" class="invoice-title-color">${activeCompany.razon_social}</div>
            </div>
            <div style="font-size: 8px; color: var(--text-secondary); line-height: 1.2; margin-top: 4px;">
              CUIT: <strong>${activeCompany.cuit}</strong><br>
              Condición: ${activeCompany.condicion_iva}<br>
              Actividad: ${activeCompany.actividad}
            </div>
          </div>

          <!-- Big centered letter tag -->
          <div style="width: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 2px solid #000; border-right: 2px solid #000; margin: 0 8px;" class="receipt-theme-bg">
            <span style="font-size: 20px; font-weight: 950; line-height: 1;">${compLetter}</span>
            <span style="font-size: 6px; font-weight: 800; margin-top: 1px; text-transform: uppercase;">Cod. ${codeNumStr}</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 2px; text-align: right; justify-content: space-between; flex: 1;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase;" class="invoice-title-color">${typeLabel}</div>
            <div style="font-size: 8px; color: var(--text-secondary); line-height: 1.2;">
              Punto de Venta: 0001<br>
              Comp. N°: <span class="font-mono" style="font-weight: 700;">${lastEmittedCompNum}</span><br>
              Fecha: <span>${dateToday}</span>
            </div>
          </div>

        </div>

        <!-- Dates operativas & Concepto -->
        <div style="display: grid; grid-template-columns: 1.2fr 0.8fr 1fr; border-bottom: 1.5px solid #000; padding: 4px 0 6px 0; margin-bottom: 8px; font-size: 8px; line-height: 1.3;" class="table-border-custom">
          <span><strong>Concepto:</strong> ${conceptLabel}</span>
          <span><strong>Moneda:</strong> PES (Arg)</span>
          <span><strong>T. Cambio:</strong> 1,000000</span>
          ${datesLegend}
        </div>

        <!-- Buyer Receptor details -->
        <div style="border-bottom: 1.5px solid #000; padding-bottom: 6px; margin-bottom: 8px; font-size: 8px; line-height: 1.3;" class="table-border-custom">
          <strong>Cliente:</strong> <span>${clientName}</span><br>
          <strong>CUIT:</strong> <span class="font-mono">${clientCuitStr}</span> | 
          <strong>Condición IVA:</strong> <span>${clientIvaCondStr}</span>
        </div>

        <!-- Items Table -->
        <div style="border-bottom: 1.5px solid #000; padding-bottom: 6px; margin-bottom: 8px;" class="table-border-custom">
          <table style="width: 100%; border-collapse: collapse; font-size: 8px; line-height: 1.3;">
            <thead>
              <tr style="border-bottom: 1px solid #cbd5e1; text-align: left; font-weight: 700; color:#334155;">
                <th style="padding-bottom: 3px;">Detalle / Concepto</th>
                <th style="text-align: center; padding-bottom: 3px; width: 30px;">Cant</th>
                <th style="text-align: right; padding-bottom: 3px; width: 60px;">Unitario</th>
                ${isRIAndTypeA ? `<th style="text-align: right; padding-bottom: 3px; width: 40px; color:var(--color-accent);">IVA</th>` : ''}
                <th style="text-align: right; padding-bottom: 3px; width: 70px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${tableItemsRows}
            </tbody>
          </table>
        </div>

        <!-- Tax breakdown summary -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
          <div style="width: 160px; display: flex; flex-direction: column; gap: 3px; font-size: 8.5px;">
            ${taxBreakdownHtml}
            <div style="display: flex; justify-content: space-between; font-size: 9.5px; border-top: 1px solid #000; padding-top: 3px;">
              <strong>Total General:</strong>
              <strong class="accent-text-theme" style="font-size: 10.5px;">$ ${lastEmittedTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </div>

        <!-- AFIP barcode footer and QR -->
        <div style="border-top: 1.5px solid #000; padding-top: 6px; display: flex; justify-content: space-between; align-items: flex-end;" class="table-border-custom">
          
          <div style="display: flex; gap: 6px; align-items: center;">
            <div style="width: 36px; height: 36px; background: #fff; padding: 1px; border: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: center;">
              <!-- Crisp SVG inline QR Code lookalike -->
              <svg viewBox="0 0 29 29" style="width: 100%; height: 100%; shape-rendering: crispEdges;">
                <path fill="#000" d="M0 0h7v7H0zm1 1v5h5V1zm8 0h3v1H9zm4 0h1v1h-1zm2 0h2v1h-2zm4 0h1v1h-1zm2 0h7v7h-7zm1 1v5h5V1zm-13 1h1v1h-1zm1 0h2v1h-2zm2 0h1v1h-1zm3 0h1v3h-1zm1 0h1v1h-1zm1 0h1v2h-1zm-6 2h1v1h-1zm3 0h1v1h-1zm-5 1h1v1h-1zm1 0h1v2h-1zm5 0h1v2h-1zm-7 1v1h7V7zm8 0h1v1h-1zm1 0h1v2h-1zm3 0h1v1h-1zm4-7v3h1V1zm1 0h2v1h-2zm2 0h1v2h-1zm-3 2h1v1h-1zm1 0h1v1h-1zm-2 1h1v2h-1zm3 0h1v1h-1zm-5 1h2v1h-2zm4 0h1v2h-1zm-3 1h2v1h-2zm-3 1h1v2h-1zm2 0h2v1h-2zm3 0h2v1h-2zm-8 2h1v1h-1zm2 0h1v1h-1zm4 0h1v1h-1zm3 0h1v1h-1zm-9 1h3v1H9zm4 0h2v1h-2zm5 0h2v1h-2zm2 0h2v1h-2zm-12 1h1v1H9zm2 0h1v2h-1zm3 0h1v1h-1zm3 0h2v1h-2zm-7 1h2v1h-2zm3 0h1v1h-1zm3 0h2v1h-2zm-8 1h1v1H8zm2 0h2v1h-2zm3 0h2v1h-2zm1 0h1v1h-1zm-12 5h7v7H0zm1 1v5h5v-5zm16-7v2h1v-2zm1 0h3v1h-3zm-14 3h1v1h-1zm1 0h2v1h-2zm3 0h1v1h-1zm4 0h2v1h-2zm1 0h1v2h-1zm3 0h2v1h-2zm-11 1h1v1h-1zm1 0h1v2h-1zm2 0h1v1h-1zm3 0h1v1h-1zm4 0h2v1h-2zm-11 1h1v2H7zm8 0h1v1h-1zm2 0h2v1h-2zm3 0h1v1h-1zm-13 1v1h7v-7zm8 0h2v1h-2zm4 0h3v1h-3z"/>
              </svg>
            </div>
            <div style="font-size: 6.5px; color: var(--text-secondary); line-height: 1.2;">
              <strong>Comprobante Autorizado por ARCA</strong><br>
              Live-Validation Fiscal Gateway<br>
              <span style="font-family: monospace;">https://arca.gob.ar/validador</span>
            </div>
          </div>

          <div style="text-align: right; font-size: 7.5px; line-height: 1.3;">
            <strong>CAE:</strong> <span class="font-mono" style="font-weight: 750;">76239485018374</span><br>
            <strong>Vto. CAE:</strong> <span class="font-mono">10/06/2026</span>
          </div>

        </div>
      `;
    }
  };

  // -------------------------------------------------------------
  // GRID OF ITEMS RENDER ENGINE
  // -------------------------------------------------------------
  const renderItemsRowsUI = () => {
    itemsContainer.innerHTML = '';
    
    invoiceItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1.2fr 50px 90px 85px 28px';
      row.style.gap = '6px';
      row.style.alignItems = 'center';
      
      row.innerHTML = `
        <div>
          <input type="text" class="form-input row-desc" data-index="${index}" style="width: 100%; padding: 6px; font-size: 11.5px; background: #fff;" value="${item.desc}" placeholder="Detalle del producto/servicio...">
        </div>
        <div>
          <input type="number" class="form-input text-center font-mono row-qty" data-index="${index}" style="width: 100%; padding: 6px 2px; font-size: 11.5px; background: #fff;" value="${item.qty}" min="1">
        </div>
        <div>
          <input type="number" class="form-input text-right font-mono row-price" data-index="${index}" style="width: 100%; padding: 6px; font-size: 11.5px; background: #fff;" value="${item.price}">
        </div>
        <div>
          <select class="form-input row-vat" data-index="${index}" style="width: 100%; padding: 6px; font-size: 11.5px; background: #fff;" ${isMonotributo ? 'disabled' : ''}>
            <option value="21" ${item.vat === 21 ? 'selected' : ''}>21% (Gral)</option>
            <option value="10.5" ${item.vat === 10.5 ? 'selected' : ''}>10.5% (Dif)</option>
            <option value="27" ${item.vat === 27 ? 'selected' : ''}>27% (Serv)</option>
            <option value="0" ${item.vat === 0 ? 'selected' : ''}>0% (Exento)</option>
          </select>
        </div>
        <div>
          ${invoiceItems.length > 1 ? `
            <button type="button" class="item-remove-btn" data-index="${index}" title="Quitar ítem">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          ` : `<div style="width: 22px;"></div>`}
        </div>
      `;
      
      itemsContainer.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons({ root: itemsContainer });

    // Attach listeners
    document.querySelectorAll('.row-desc').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(e.target.dataset.index);
        invoiceItems[idx].desc = e.target.value;
        renderLivePreviewMarkup();
      });
    });

    document.querySelectorAll('.row-qty').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(e.target.dataset.index);
        invoiceItems[idx].qty = Number(e.target.value) || 1;
        calculateTotalsAndPreview();
      });
    });

    document.querySelectorAll('.row-price').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(e.target.dataset.index);
        invoiceItems[idx].price = Number(e.target.value) || 0;
        calculateTotalsAndPreview();
      });
    });

    document.querySelectorAll('.row-vat').forEach(select => {
      select.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.index);
        invoiceItems[idx].vat = Number(e.target.value) || 0;
        calculateTotalsAndPreview();
      });
    });

    document.querySelectorAll('.item-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(e.currentTarget.dataset.index);
        invoiceItems.splice(idx, 1);
        renderItemsRowsUI();
        calculateTotalsAndPreview();
      });
    });
  };

  // Add Item Row Event
  btnAddItemRow?.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Auto-description based on company type
    const defaultDesc = isMonotributo 
      ? "Servicio de Consultoría Profesional" 
      : "Venta de Mercadería General";
    
    invoiceItems.push({ desc: defaultDesc, qty: 1, price: 45000, vat: 21 });
    renderItemsRowsUI();
    calculateTotalsAndPreview();
  });

  // Render initial items grid
  renderItemsRowsUI();

  // -------------------------------------------------------------
  // REAL-TIME CUIT VAL VERIFICATION (MODULE 11)
  // -------------------------------------------------------------
  inputCuit?.addEventListener('input', (e) => {
    const rawVal = e.target.value.replace(/-/g, '').trim();
    
    // Auto formatting as the user types (XX-XXXXXXXX-X)
    if (rawVal.length > 2 && rawVal.length <= 10) {
      e.target.value = `${rawVal.slice(0,2)}-${rawVal.slice(2)}`;
    } else if (rawVal.length > 10) {
      e.target.value = `${rawVal.slice(0,2)}-${rawVal.slice(2,10)}-${rawVal.slice(10,11)}`;
    }

    if (rawVal.length === 11) {
      const isValid = validarCUIT(rawVal);
      cuitBadge.style.display = 'block';
      if (isValid) {
        cuitBadge.style.color = 'var(--color-accent-light)';
        cuitBadge.textContent = '✅ CUIT Válido (Padrón Módulo 11 OK)';
        inputCuit.style.borderColor = 'var(--color-accent-light)';
      } else {
        cuitBadge.style.color = '#ef4444';
        cuitBadge.textContent = '❌ CUIT Matemáticamente Inválido';
        inputCuit.style.borderColor = '#ef4444';
      }
    } else {
      cuitBadge.style.display = 'none';
      inputCuit.style.borderColor = 'var(--border-color)';
    }
    
    // Live update preview
    renderLivePreviewMarkup();
  });

  // -------------------------------------------------------------
  // ORGANIC PADRON AFIP LOOKUP
  // -------------------------------------------------------------
  const handlePadronSearch = () => {
    const rawCuit = inputCuit.value.replace(/-/g, '').trim();
    if (rawCuit.length < 8) {
      mainApp.showToast("Por favor, ingresá un CUIT o DNI válido de 8 a 11 dígitos.", "error");
      return;
    }

    mainApp.showToast("Consultando Padrón Único de ARCA (wspadrón)...", "info");
    
    // Simulate padron latency
    setTimeout(() => {
      const match = CUIT_PADRON_REGISTRY[rawCuit];
      if (match) {
        inputName.value = match.name;
        selectIvaCond.value = match.cond;
        
        // Auto-configure CUIT formatting
        if (rawCuit.length === 11) {
          inputCuit.value = `${rawCuit.slice(0,2)}-${rawCuit.slice(2,10)}-${rawCuit.slice(10)}`;
        }
        
        // Render check digit green
        cuitBadge.style.display = 'block';
        cuitBadge.style.color = 'var(--color-accent-light)';
        cuitBadge.textContent = '✅ CUIT Válido (Cliente en Padrón Activo)';
        inputCuit.style.borderColor = 'var(--color-accent-light)';

        mainApp.showToast("¡Cliente encontrado y verificado en padrón ARCA!", "success");
        calculateTotalsAndPreview();
      } else {
        // Run Module 11 check on custom typed numbers
        const validCheck = validarCUIT(rawCuit);
        cuitBadge.style.display = 'block';

        if (validCheck) {
          cuitBadge.style.color = 'var(--color-accent-light)';
          cuitBadge.textContent = '✅ CUIT Válido (Matemático)';
          inputCuit.style.borderColor = 'var(--color-accent-light)';
        } else {
          cuitBadge.style.color = '#ef4444';
          cuitBadge.textContent = '⚠️ CUIT no registrado en Padrón local';
          inputCuit.style.borderColor = 'var(--color-amber-light)';
        }

        // Generate realistic mock company
        const realisticNames = ["Distribuidora Andina S.A.", "Comercio El Centro S.R.L.", "Constructora del Valle S.R.L.", "Estudio Pérez & Asociados", "Transportes del Norte S.R.L."];
        const hash = rawCuit.split('').reduce((acc, char) => acc + Number(char), 0);
        const generatedName = realisticNames[hash % realisticNames.length];
        
        inputName.value = generatedName;
        selectIvaCond.value = "Consumidor Final";
        mainApp.showToast("CUIT no en caché física de padrón. Asignada Razón Social genérica.", "info");
        calculateTotalsAndPreview();
      }
    }, 800);
  };

  document.getElementById('btn-search-padron')?.addEventListener('click', handlePadronSearch);
  
  // Quick fill CUIT list link
  document.getElementById('btn-quick-fill-cuit')?.addEventListener('click', () => {
    const keys = Object.keys(CUIT_PADRON_REGISTRY);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    inputCuit.value = randomKey;
    handlePadronSearch();
  });

  // -------------------------------------------------------------
  // DIRECT INVOICE EMISSION & CAE REQUEST (WSAA & WSFE CRYTOGRAPHIC HANDSHAKE)
  // -------------------------------------------------------------
  btnEmitirFactura?.addEventListener('click', (e) => {
    e.stopPropagation();

    const cuitVal = inputCuit.value.trim();
    const nameVal = inputName.value.trim();

    if (!cuitVal || !nameVal || invoiceItems.length === 0) {
      mainApp.showToast("Por favor, completá los datos del receptor e ingresá al menos un ítem.", "error");
      return;
    }

    // Start Handshake terminal visualization
    billingForm.style.display = 'none';
    invoiceLoadingOverlay.style.display = 'block';
    
    // Clear log statuses
    logSeq1.style.opacity = '1';
    logSeq1.querySelector('.seq-dot').style.background = '#fbbf24';
    logSeq2.style.opacity = '0.4';
    logSeq3.style.opacity = '0.4';

    // Inyect XML terminal step 1: WSAA TRA Request
    soapXmlTerminal.innerHTML = `<span style="color:var(--color-accent);">&gt; Generando TRA (Ticket de Requerimiento de Acceso) XML...</span>\n`;
    
    setTimeout(() => {
      soapXmlTerminal.innerHTML += `<span style="color:#a5b4fc;">&lt;?xml version="1.0" encoding="UTF-8"?&gt;
&lt;loginTicketRequest version="1.0"&gt;
  &lt;header&gt;
    &lt;uniqueId&gt;${Math.floor(Date.now()/1000)}&lt;/uniqueId&gt;
    &lt;generationTime&gt;2026-05-31T22:04:00&lt;/generationTime&gt;
    &lt;expirationTime&gt;2026-05-31T22:14:00&lt;/expirationTime&gt;
  &lt;/header&gt;
  &lt;service&gt;wsfe&lt;/service&gt;
&lt;/loginTicketRequest&gt;</span>\n`;
      
      soapXmlTerminal.scrollTop = soapXmlTerminal.scrollHeight;
    }, 300);

    // Step 2: WSAA signing soap request
    setTimeout(() => {
      logSeq1.querySelector('.seq-dot').style.background = 'var(--color-accent-light)';
      logSeq1.innerHTML += ' <span style="color:var(--color-accent-light); font-weight:700;">[OK]</span>';
      
      invoiceLoadingStatus.textContent = "Firmando digitalmente token XML con certificado (.key) del estudio...";
      logSeq2.style.opacity = '1';
      logSeq2.querySelector('.seq-dot').style.background = '#fbbf24';

      soapXmlTerminal.innerHTML += `\n<span style="color:var(--color-accent);">&gt; Invocando WSAA mediante SOAP con firma PKCS#7 CMS...</span>\n`;
      soapXmlTerminal.innerHTML += `<span style="color:var(--color-accent-light);">&lt;soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"&gt;
  &lt;soapenv:Body&gt;
    &lt;loginCms xmlns="http://wsaa.view.afip.gov.ar/ws/"&gt;
      &lt;in0&gt;MIIHDgYJKoZIhvcNAQcCoIIH9zCCB/MCAQExCzAJBgUrDgMC... [CMS ENVELOPE]&lt;/in0&gt;
    &lt;/loginCms&gt;
  &lt;/soapenv:Body&gt;
&lt;/soapenv:Envelope&gt;</span>\n`;
      
      soapXmlTerminal.scrollTop = soapXmlTerminal.scrollHeight;

      setTimeout(() => {
        soapXmlTerminal.innerHTML += `\n<span style="color:var(--color-accent-light);">&lt; WSAA Response: Token de Autorización recibido exitosamente:</span>\n`;
        soapXmlTerminal.innerHTML += `<span style="color:var(--text-muted);">&lt;loginCmsResponse&gt;
  &lt;loginCmsReturn&gt;
    &lt;header&gt;CN=wsaa, O=AFIP, C=AR&lt;/header&gt;
    &lt;credentials&gt;
      &lt;token&gt;PD94bWwgdmVyc2lvbj0iMS4w...&lt;/token&gt;
      &lt;sign&gt;MIIEPgYJKoZIhvcNAQcCoIIE...&lt;/sign&gt;
    &lt;/credentials&gt;
  &lt;/loginCmsReturn&gt;
&lt;/loginCmsResponse&gt;</span>\n`;
        
        soapXmlTerminal.scrollTop = soapXmlTerminal.scrollHeight;
      }, 700);

    }, 1200);

    // Step 3: WSFE request for CAE
    setTimeout(() => {
      logSeq2.querySelector('.seq-dot').style.background = 'var(--color-accent-light)';
      logSeq2.innerHTML += ' <span style="color:var(--color-accent-light); font-weight:700;">[OK]</span>';
      
      invoiceLoadingStatus.textContent = "Solicitando Código de Autorización Electrónico (CAE) en WSFE...";
      logSeq3.style.opacity = '1';
      logSeq3.querySelector('.seq-dot').style.background = '#fbbf24';

      soapXmlTerminal.innerHTML += `\n<span style="color:var(--color-accent);">&gt; Enviando solicitud FECAESolicitar lote de venta a WSFE...</span>\n`;
      soapXmlTerminal.innerHTML += `<span style="color:#f472b6;">&lt;soapenv:Envelope xmlns:ar="http://ar.gov.afip.dif.FEV1/"&gt;
  &lt;ar:FECAESolicitar&gt;
    &lt;ar:Auth&gt;
      &lt;ar:Token&gt;PD94bWwgdmVyc2lvbj0iMS4w...&lt;/ar:Token&gt;
      &lt;ar:Sign&gt;MIIEPgYJKoZIhvcNAQc...&lt;/ar:Sign&gt;
      &lt;ar:Cuit&gt;${activeCompany.cuit.replace(/-/g, '')}&lt;/ar:Cuit&gt;
    &lt;/ar:Auth&gt;
    &lt;ar:FeCAEReq&gt;
      &lt;ar:FeCabReq&gt;
        &lt;ar:CantReg&gt;1&lt;/ar:CantReg&gt;
        &lt;ar:CbteTipo&gt;${isMonotributo ? '11' : (selectType.value.includes('A') ? '1' : '6')}&lt;/ar:CbteTipo&gt;
        &lt;ar:PtoVta&gt;1&lt;/ar:PtoVta&gt;
      &lt;/ar:FeCabReq&gt;
      &lt;ar:FeDetReq&gt;
        &lt;ar:FECAEDetRequest&gt;
          &lt;ar:Concepto&gt;${selectConcept.value}&lt;/ar:Concepto&gt;
          &lt;ar:DocTipo&gt;80&lt;/ar:DocTipo&gt;
          &lt;ar:DocNro&gt;${cuitVal.replace(/-/g, '')}&lt;/ar:DocNro&gt;
          &lt;ar:ImpNeto&gt;${lastEmittedNeto.toFixed(2)}&lt;/ar:ImpNeto&gt;
          &lt;ar:ImpIVA&gt;${lastEmittedIva.toFixed(2)}&lt;/ar:ImpIVA&gt;
          &lt;ar:ImpTotal&gt;${lastEmittedTotal.toFixed(2)}&lt;/ar:ImpTotal&gt;
        &lt;/ar:FECAEDetRequest&gt;
      &lt;/ar:FeDetReq&gt;
    &lt;/ar:FeCAEReq&gt;
  &lt;/ar:FECAESolicitar&gt;
&lt;/soapenv:Envelope&gt;</span>\n`;
      
      soapXmlTerminal.scrollTop = soapXmlTerminal.scrollHeight;

      setTimeout(() => {
        soapXmlTerminal.innerHTML += `\n<span style="color:#f472b6;">&lt; WSFE Response: CAE Otorgado con éxito!</span>\n`;
        soapXmlTerminal.innerHTML += `<span style="color:var(--color-accent-light);">&lt;FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"&gt;
  &lt;FECAESolicitarResult&gt;
    &lt;FeCabResp&gt;
      &lt;Resultado&gt;A&lt;/Resultado&gt;
    &lt;/FeCabResp&gt;
    &lt;FeDetResp&gt;
      &lt;FECAEDetResponse&gt;
        &lt;Resultado&gt;A&lt;/Resultado&gt;
        &lt;CAE&gt;76239485018374&lt;/CAE&gt;
        &lt;CAEFchVto&gt;2026-06-10&lt;/CAEFchVto&gt;
      &lt;/FECAEDetResponse&gt;
    &lt;/FeDetResp&gt;
  &lt;/FECAESolicitarResult&gt;
&lt;/FECAESolicitarResponse&gt;</span>\n`;
        
        soapXmlTerminal.scrollTop = soapXmlTerminal.scrollHeight;
      }, 700);

    }, 2800);

    // Complete Handshake successfully!
    setTimeout(() => {
      logSeq3.querySelector('.seq-dot').style.background = 'var(--color-accent-light)';
      logSeq3.innerHTML += ' <span style="color:var(--color-accent-light); font-weight:700;">[OK]</span>';

      const dateToday = new Date().toISOString().slice(0, 10);
      const compNum = Math.floor(1000 + Math.random() * 9000);
      lastEmittedCompNum = compNum.toString().padStart(8, '0');

      // 1. ADD TRANSACTION TO ACCOUNTING LEDGER (DB)
      const newSale = {
        fecha: dateToday,
        cliente: nameVal,
        cuit: cuitVal,
        tipo_comprobante: selectType.value,
        numero: "0001-0000" + compNum,
        neto: lastEmittedNeto,
        iva: lastEmittedIva,
        total: lastEmittedTotal
      };
      addTransaction(activeCompany.id, 'ventas', newSale);

      // 2. ADD TO DIGITALIZED DOCUMENTS LIST FOR RE-RENDER
      const newDoc = {
        id: "t-" + Date.now(),
        fecha: dateToday,
        detalle: `${selectType.value} - ${nameVal}`,
        archivo: `factura_arca_${compNum}.pdf`,
        tipo: "Venta",
        monto: lastEmittedTotal,
        estado: "Aprobado",
        es_activo: false
      };

      const tickets = JSON.parse(localStorage.getItem(`vmp_tickets_${activeCompany.id}`)) || [];
      tickets.unshift(newDoc);
      localStorage.setItem(`vmp_tickets_${activeCompany.id}`, JSON.stringify(tickets));

      // Refresh Live Preview Markup for final successful receipt
      renderLivePreviewMarkup();

      // Toggle displays to Success receipt
      invoiceLoadingOverlay.style.display = 'none';
      invoiceSuccessReceipt.style.display = 'flex';

      mainApp.showToast(`¡Factura N° ${compNum} emitida con CAE!`, "success");
      renderTicketsList();

    }, 4500);

  });

  // Reset Billing Form for a New Invoice
  document.getElementById('btn-emit-another-invoice')?.addEventListener('click', () => {
    // Reset forms inputs
    inputCuit.value = '';
    inputName.value = '';
    cuitBadge.style.display = 'none';
    inputCuit.style.borderColor = 'var(--border-color)';
    
    // Auto-reset items grid
    invoiceItems = [
      { desc: isMonotributo ? "Servicio de Consultoría Profesional" : "Venta de Mercadería General", qty: 1, price: 150000, vat: 21 }
    ];
    renderItemsRowsUI();

    // Reset perception checked
    chkApplyIibb.checked = false;
    selectIibbProv.disabled = true;

    // Reset terminal XML log
    soapXmlTerminal.innerHTML = '';
    
    // Toggle containers
    invoiceSuccessReceipt.style.display = 'none';
    billingForm.style.display = 'flex';
    
    // Clear logs opacity and ok labels
    logSeq1.style.opacity = '0.4';
    logSeq1.innerHTML = '<span class="seq-dot" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted);"></span><span>Enlace a Pasarela de Autenticación WSAA...</span>';
    logSeq2.style.opacity = '0.4';
    logSeq2.innerHTML = '<span class="seq-dot" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted);"></span><span>Firma Criptográfica XML SOAP (TA.xml)...</span>';
    logSeq3.style.opacity = '0.4';
    logSeq3.innerHTML = '<span class="seq-dot" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted);"></span><span>Despacho Lote y CAE en WSFE...</span>';

    calculateTotalsAndPreview();
  });

  // Download Commercial Invoice Receipt File
  document.getElementById('btn-download-pdf-invoice')?.addEventListener('click', () => {
    const replicaEl = document.getElementById('live-invoice-pdf-replica');
    if (!replicaEl) {
      mainApp.showToast("No se pudo encontrar la factura para imprimir.", "error");
      return;
    }

    const activeTheme = themeSelect.value;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      mainApp.showToast("El navegador bloqueó la ventana emergente. Por favor, permití popups para descargar el PDF.", "error");
      return;
    }

    const themeColors = {
      slate: { border: 'var(--text-primary)', bg: '#f1f5f9', text: 'var(--text-primary)', title: '#000000' },
      emerald: { border: 'var(--color-accent)', bg: '#ecfdf5', text: '#064e3b', title: 'var(--color-accent)' },
      navy: { border: '#1d4ed8', bg: '#eff6ff', text: '#1e3a8a', title: '#1d4ed8' }
    };
    const colors = themeColors[activeTheme] || themeColors.slate;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Factura Electrónica ARCA - ${activeCompany.razon_social}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: 'Inter', sans-serif;
            background: #ffffff;
            display: flex;
            justify-content: center;
          }
          .afip-invoice-wrapper {
            background: #fff;
            border: 2px solid ${colors.border} !important;
            border-radius: 6px;
            padding: 24px;
            color: #000;
            width: 175mm;
            box-sizing: border-box;
          }
          .receipt-theme-bg {
            background-color: ${colors.bg} !important;
            border-color: ${colors.border} !important;
            color: ${colors.text} !important;
          }
          .invoice-title-color {
            color: ${colors.title} !important;
          }
          .table-border-custom {
            border-bottom: 2px solid ${colors.border} !important;
          }
          .accent-text-theme {
            color: ${colors.border} !important;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            font-size: 10px;
            line-height: 1.4;
          }
          .font-mono {
            font-family: 'Courier New', Courier, monospace;
          }
          @media print {
            body { padding: 0; }
            .afip-invoice-wrapper { border-width: 2px !important; box-shadow: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="afip-invoice-wrapper">
          ${replicaEl.innerHTML}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    mainApp.showToast("Generando PDF de Factura Electrónica...", "success");
  });

  // Share link to invoice copy
  document.getElementById('btn-share-invoice')?.addEventListener('click', () => {
    const link = `https://vmp.com.ar/studio/comprobante?id=f-2026-${lastEmittedCompNum}`;
    navigator.clipboard.writeText(link).then(() => {
      mainApp.showToast("¡Enlace del comprobante copiado al portapapeles para WhatsApp!", "success");
    }).catch(() => {
      mainApp.showToast("Error al copiar enlace", "error");
    });
  });

  // -------------------------------------------------------------
  // EXPORT LIBRO IVA DIGITAL (REGINFO VENTAS TEXT GENERATOR)
  // -------------------------------------------------------------
  document.getElementById('btn-export-reginfo')?.addEventListener('click', () => {
    const rawCuitEmisor = activeCompany.cuit.replace(/-/g, '');
    const rawCuitReceptor = inputCuit.value.replace(/-/g, '') || "00000000000";
    const dateTodayYYYYMMDD = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Record Specifications columns width for AFIP REGINFO Ventas:
    // Pos 1-8: Fecha (8 chars)
    // Pos 9-11: Tipo de Comprobante (3 chars, '001'=A, '006'=B, '011'=C)
    // Pos 12-16: Punto de Venta (5 chars, e.g. '00001')
    // Pos 17-36: Número de Comprobante (20 chars)
    // Pos 37-56: Número de Comprobante Hasta (20 chars)
    // Pos 57-58: Código de Documento Comprador (2 chars, '80'=CUIT, '96'=DNI, '99'=Sin doc)
    // Pos 59-78: Nro Identificación Comprador (20 chars)
    // Pos 79-108: Razón Social Comprador (30 chars)
    // Pos 109-123: Importe Total (15 chars, decimals omitted, multiply by 100)
    // Pos 124-138: Importe conceptos no gravados (15 chars, zeros)
    // Pos 139-153: Importe operaciones exentas (15 chars, zeros)
    // Pos 154-168: Importe percepciones IIBB (15 chars)
    // Pos 169-183: Importe IVA Liquidado (15 chars)
    // Pos 184-191: Fecha Vencimiento Pago (8 chars)

    const cbteTypeVal = isMonotributo ? '011' : (selectType.value.includes('A') ? '001' : '006');
    const ptoVta = '00001';
    const compNumPadded = lastEmittedCompNum.padStart(20, '0');
    const docTipo = rawCuitReceptor.length === 11 ? '80' : '96';
    const receptorCuitPadded = rawCuitReceptor.padStart(20, '0');
    
    let clientNameRaw = inputName.value.trim();
    if (clientNameRaw.length > 30) clientNameRaw = clientNameRaw.substring(0, 30);
    const clientNamePadded = clientNameRaw.padEnd(30, ' ');

    const totalInt = Math.round(lastEmittedTotal * 100).toString().padStart(15, '0');
    const iibbInt = Math.round(lastEmittedIibb * 100).toString().padStart(15, '0');
    const ivaInt = Math.round(lastEmittedIva * 100).toString().padStart(15, '0');
    const dueDateYYYYMMDD = serviceDue.value.replace(/-/g, '');

    const recordLine = `${dateTodayYYYYMMDD}${cbteTypeVal}${ptoVta}${compNumPadded}${compNumPadded}${docTipo}${receptorCuitPadded}${clientNamePadded}${totalInt}${'0'.repeat(15)}${'0'.repeat(15)}${iibbInt}${ivaInt}${dueDateYYYYMMDD}PES00010000001 76239485018374`;

    const blob = new Blob([recordLine], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `REGINFO-VENTAS-CBTE-${rawCuitEmisor}-${dateTodayYYYYMMDD}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    mainApp.showToast("¡Archivo de importación de Libro IVA Digital AFIP (.txt) generado!", "success");
  });

  // -------------------------------------------------------------
  // DIGITAL TICKETS UPLOADER ACTIONS (EXISTING FLUX)
  // -------------------------------------------------------------
  const renderTicketsList = () => {
    const tickets = JSON.parse(localStorage.getItem(`vmp_tickets_${activeCompany.id}`)) || [];
    tableBody.innerHTML = tickets.map(t => `
      <tr>
        <td class="font-mono text-xs">${t.fecha.split('-').reverse().join('/')}</td>
        <td>
          <div style="font-weight: 600; font-size: 12px; color: var(--color-primary);">${t.detalle}</div>
          <div style="font-size: 10px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
            <i data-lucide="file" style="width: 10px; height: 10px;"></i> ${t.archivo}
            ${t.es_activo ? `
              <span style="font-size: 8px; font-weight: 700; color: var(--color-accent-light); background: rgba(31, 92, 67, 0.08); padding: 1px 4px; border-radius: 3px; border: 1px solid rgba(31, 92, 67, 0.2);">BIEN DE USO</span>
            ` : `
              <span style="font-size: 8px; font-weight: 600; color: var(--text-muted); background: var(--bg-secondary); padding: 1px 4px; border-radius: 3px; border: 1px solid var(--border-color);">${t.tipo === 'Venta' ? 'VENTA EMITIDA' : 'GASTO (' + (t.categoria || 'General') + ')'}</span>
            `}
          </div>
        </td>
        <td class="font-mono text-right" style="font-weight: 700; color: ${t.tipo === 'Venta' ? 'var(--color-accent-light)' : 'inherit'};">
          ${t.tipo === 'Venta' ? '+' : '-'} $ ${t.monto.toLocaleString('es-AR')}
        </td>
        <td>
          <span class="badge-status ${t.estado === 'Aprobado' ? 'active' : (t.estado === 'Procesado' ? 'pending' : 'inactive')}" style="font-size: 10px; padding: 1px 6px;">
            ${t.estado}
          </span>
        </td>
      </tr>
    `).join('');
    if (window.lucide) window.lucide.createIcons({ root: tableBody });
  };

  // Real AI OCR using Gemini API
  const processRealTicketWithGemini = async (file) => {
    // Quota check
    const scansCount = parseInt(localStorage.getItem('vmp_ocr_scans_count') || '284', 10);
    const scansLimit = parseInt(localStorage.getItem('vmp_ocr_scans_limit') || '300', 10);
    if (scansCount >= scansLimit) {
      const quotaModal = document.getElementById('ocr-quota-exceeded-modal');
      if (quotaModal) {
        quotaModal.style.display = 'flex';
        if (window.lucide) window.lucide.createIcons({ root: quotaModal });
      }
      return;
    }

    const apiKey = localStorage.getItem('vmp_gemini_api_key');
    
    dropzone.style.display = 'none';
    progressContainer.style.display = 'block';
    progressTxt.textContent = "Conectando con el Agente de IA (Gemini 2.5 Flash)...";

  try {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      progressTxt.textContent = "El Agente IA está extrayendo información fiscal del comprobante...";

      const model = "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const prompt = `Analizá esta imagen de ticket de compra o factura. Extraé los datos clave del comprobante y clasificalo.
      Determiná si el comprobante representa la compra de un ACTIVO (Bien de Uso / Bien de Capital / Activo Fijo, como computadoras, celulares, maquinaria, mobiliario, vehículos o refacciones de valor) o si es un GASTO OPERATIVO corriente (combustibles, librería, papelería, servicios, viáticos, internet).
      Extraé los datos en el siguiente formato JSON estricto:
      {
        "proveedor": "Nombre del Comercio / Razón Social",
        "cuit": "CUIT del proveedor en formato XX-XXXXXXXX-X",
        "tipo_comprobante": "Factura A" o "Factura B" o "Ticket C" (según corresponda)",
        "numero": "Número de comprobante (formato XXXX-XXXXXXXX, si no hay, inventá uno realista)",
        "neto": Monto neto sin IVA como número,
        "iva": Monto del IVA (21% del neto) como número,
        "total": Monto total final como número,
        "categoria": "Categoría descriptiva de la compra (ej: Computación, Mobiliario, Combustibles, etc.)",
        "es_activo": true (si es una compra de activo/bien de uso como computadoras, servidores, aire acondicionado, etc.) o false (si es un gasto normal o servicio de consumo inmediato)
      }
      Es fundamental que el total, el neto y el IVA cuadren matemáticamente (neto + iva = total).
      Devolvé ÚNICAMENTE el objeto JSON puro sin bloques de código markdown ni texto extra.`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: file.type,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const resData = await response.json();
      const rawText = resData.candidates[0].content.parts[0].text;
      const parsedData = JSON.parse(rawText.trim());

      const date = new Date().toISOString().slice(0, 10);
      const newTicket = {
        id: "t-" + Date.now(),
        fecha: date,
        detalle: parsedData.proveedor,
        archivo: file.name,
        tipo: "Compra",
        monto: parsedData.total,
        estado: "Aprobado",
        es_activo: parsedData.es_activo === true,
        categoria: parsedData.categoria || "Otros"
      };

      const tickets = JSON.parse(localStorage.getItem(`vmp_tickets_${activeCompany.id}`)) || [];
      tickets.unshift(newTicket);
      localStorage.setItem(`vmp_tickets_${activeCompany.id}`, JSON.stringify(tickets));

      const newPurchase = {
        fecha: date,
        proveedor: parsedData.proveedor,
        cuit: parsedData.cuit,
        tipo_comprobante: parsedData.tipo_comprobante || "Factura A",
        numero: parsedData.numero || "0001-00001234",
        neto: Number(parsedData.neto) || Number(parsedData.total) / 1.21,
        iva: Number(parsedData.iva) || Number(parsedData.total) - (Number(parsedData.total) / 1.21),
        total: Number(parsedData.total),
        es_activo: parsedData.es_activo === true,
        categoria: parsedData.categoria || "Otros"
      };

      addTransaction(activeCompany.id, 'compras', newPurchase);

      // Increment scans count
      const updatedScans = scansCount + 1;
      localStorage.setItem('vmp_ocr_scans_count', updatedScans.toString());

      progressContainer.style.display = 'none';
      dropzone.style.display = 'flex';

      mainApp.showToast(`¡Agente IA: digitalizado ticket de "${parsedData.proveedor}" por $ ${parsedData.total}!`, "success");
      renderTicketsList();

    } catch (error) {
      console.error("Gemini OCR Error:", error);
      progressContainer.style.display = 'none';
      dropzone.style.display = 'flex';
      mainApp.showToast("Error de conexión con el Agente IA de Gemini. Corrobore la clave API.", "error");
    }
  };

  const startUploadSimulation = (isAsset = false) => {
    // Quota check
    const scansCount = parseInt(localStorage.getItem('vmp_ocr_scans_count') || '284', 10);
    const scansLimit = parseInt(localStorage.getItem('vmp_ocr_scans_limit') || '300', 10);
    if (scansCount >= scansLimit) {
      const quotaModal = document.getElementById('ocr-quota-exceeded-modal');
      if (quotaModal) {
        quotaModal.style.display = 'flex';
        if (window.lucide) window.lucide.createIcons({ root: quotaModal });
      }
      return;
    }

    dropzone.style.display = 'none';
    progressContainer.style.display = 'block';
    progressTxt.textContent = "Subiendo archivo a la nube...";

    setTimeout(() => {
      progressTxt.textContent = "Digitalizando ticket y extrayendo CUIT con OCR...";
      
      setTimeout(() => {
        const date = new Date().toISOString().slice(0, 10);
        const newTicket = isAsset ? {
          id: "t-" + Date.now(),
          fecha: date,
          detalle: "Notebook Dell Latitude i7 - Megatone",
          archivo: "factura_compu_" + Math.floor(Math.random() * 1000) + ".pdf",
          tipo: "Compra",
          monto: 650000,
          estado: "Aprobado",
          es_activo: true,
          categoria: "Computación"
        } : {
          id: "t-" + Date.now(),
          fecha: date,
          detalle: "Ticket Combustibles - Combustibles YPF",
          archivo: "ticket_ypf_" + Math.floor(Math.random() * 1000) + ".jpg",
          tipo: "Compra",
          monto: 18500,
          estado: "Procesado",
          es_activo: false,
          categoria: "Combustibles"
        };

        const tickets = JSON.parse(localStorage.getItem(`vmp_tickets_${activeCompany.id}`)) || [];
        tickets.unshift(newTicket);
        localStorage.setItem(`vmp_tickets_${activeCompany.id}`, JSON.stringify(tickets));

        const newPurchase = isAsset ? {
          fecha: date,
          proveedor: "Megatone S.A.",
          cuit: "30-54930281-2",
          tipo_comprobante: "Factura A",
          numero: "0005-0000" + Math.floor(1000 + Math.random() * 9000),
          neto: 537190.08,
          iva: 112809.92,
          total: 650000.00,
          es_activo: true,
          categoria: "Computación"
        } : {
          fecha: date,
          proveedor: "Combustibles YPF",
          cuit: "30-50001234-9",
          tipo_comprobante: "Factura A",
          numero: "4820-002" + Math.floor(10000 + Math.random() * 90000),
          neto: 15289.26,
          iva: 3210.74,
          total: 18500.00,
          es_activo: false,
          categoria: "Combustibles"
        };
        addTransaction(activeCompany.id, 'compras', newPurchase);

        // Increment scans count
        const updatedScans = scansCount + 1;
        localStorage.setItem('vmp_ocr_scans_count', updatedScans.toString());

        progressContainer.style.display = 'none';
        dropzone.style.display = 'flex';

        mainApp.showToast(isAsset ? "¡Comprobante: Bien de Uso (Activo Fijo) digitalizado!" : "¡Comprobante de Gasto enviado al contador con éxito!", "success");
        renderTicketsList();

      }, 1200);
    }, 800);
  };

  const handleFileProcess = (file) => {
    if (!file) return;
    const apiKey = localStorage.getItem('vmp_gemini_api_key');
    if (apiKey) {
      processRealTicketWithGemini(file);
    } else {
      const isAssetSim = file.name.toLowerCase().includes('compu') || 
                         file.name.toLowerCase().includes('notebook') || 
                         file.name.toLowerCase().includes('activo') || 
                         file.name.toLowerCase().includes('dell') ||
                         file.name.toLowerCase().includes('laptop') ||
                         file.name.toLowerCase().includes('pc');
      startUploadSimulation(isAssetSim);
    }
  };

  // Drag and drop event listeners
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  });

  fileInput?.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileProcess(fileInput.files[0]);
    }
  });

  btnSim?.addEventListener('click', (e) => {
    e.stopPropagation();
    startUploadSimulation(false);
  });

  btnSimAsset?.addEventListener('click', (e) => {
    e.stopPropagation();
    startUploadSimulation(true);
  });

  // -------------------------------------------------------------
  // CONTROLS FOR TICKET RECONSTRUCTION MODAL (NEW FEATURE)
  // -------------------------------------------------------------
  const recModal = document.getElementById('reconstruct-modal');
  const btnCloseRecModal = document.getElementById('btn-close-reconstruct-modal');
  const btnPrintThermal = document.getElementById('btn-print-thermal-receipt');
  const btnDownloadThermal = document.getElementById('btn-download-thermal-txt');

  const recVendorName = document.getElementById('rec-vendor-name');
  const recVendorAddress = document.getElementById('rec-vendor-address');
  const recVendorCuit = document.getElementById('rec-vendor-cuit');
  const recDate = document.getElementById('rec-date');
  const recTicketNum = document.getElementById('rec-ticket-num');
  const recItemsBody = document.getElementById('rec-items-body');
  const recNeto = document.getElementById('rec-neto');
  const recIva = document.getElementById('rec-iva');
  const recTotal = document.getElementById('rec-total');
  const recCae = document.getElementById('rec-cae');
  const recCaeVto = document.getElementById('rec-cae-vto');

  let activeReconstructedData = null;

  // Event delegation for reconstruct buttons in ticket-table-body
  document.getElementById('ticket-table-body')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-reconstruct-ticket');
    if (!btn) return;

    e.stopPropagation();
    const id = btn.dataset.id;
    
    // Determine which ticket we are reconstruct
    let data = {
      vendor: "YPF S.A.",
      address: "Av. Macacha Güemes 515, CABA",
      cuit: "30-50001234-9",
      date: "25/05/2026",
      ticket: "0004-00192834",
      items: `<tr><td style="padding: 4px 0;">NAFTA INFINIA SUPER (Ltrs)</td><td style="text-align:right; padding: 4px 0; width: 40px;">22.31</td><td style="text-align:right; padding: 4px 0; width: 60px;">$ 18.500,00</td></tr>`,
      neto: "$ 15.289,26",
      iva: "$ 3.210,74",
      total: "$ 18.500,00",
      cae: "76239485012398",
      vto: "04/06/2026"
    };

    if (id === 't-2') {
      data = {
        vendor: "TELECOM ARGENTINA S.A.",
        address: "Av. Alicia Moreau de Justo 50, CABA",
        cuit: "30-70721665-6",
        date: "24/05/2026",
        ticket: "0008-00928347",
        items: `<tr><td style="padding: 4px 0;">ABONO INTERNET FIBERTER 300MB</td><td style="text-align:right; padding: 4px 0; width: 40px;">1.00</td><td style="text-align:right; padding: 4px 0; width: 60px;">$ 24.000,00</td></tr>`,
        neto: "$ 19.834,71",
        iva: "$ 4.165,29",
        total: "$ 24.000,00",
        cae: "76239586102938",
        vto: "03/06/2026"
      };
    } else if (id === 't-3') {
      data = {
        vendor: "LIBRERÍA SAN MARTÍN S.H.",
        address: "Av. San Martín 1204, Comodoro Rivadavia",
        cuit: "30-11223344-5",
        date: "23/05/2026",
        ticket: "0002-00012839",
        items: `
          <tr><td style="padding: 4px 0;">RESMA PAPEL A4 LEDESMA (75g)</td><td style="text-align:right; padding: 4px 0; width: 40px;">2.00</td><td style="text-align:right; padding: 4px 0; width: 60px;">$ 4.500,00</td></tr>
          <tr><td style="padding: 4px 0;">BOLÍGRAFOS BIC NEGRO</td><td style="text-align:right; padding: 4px 0; width: 40px;">5.00</td><td style="text-align:right; padding: 4px 0; width: 60px;">$ 2.000,00</td></tr>
        `,
        neto: "$ 5.371,90",
        iva: "$ 1.128,10",
        total: "$ 6.500,00",
        cae: "76239485012398",
        vto: "02/06/2026"
      };
    } else if (id.startsWith('t-')) {
      const tickets = JSON.parse(localStorage.getItem(`vmp_tickets_${activeCompany.id}`)) || [];
      const found = tickets.find(x => x.id === id);
      if (found) {
        const hasCompu = found.detalle.toLowerCase().includes('notebook') || found.detalle.toLowerCase().includes('dell') || found.detalle.toLowerCase().includes('compu') || found.detalle.toLowerCase().includes('megatone');
        if (hasCompu) {
          data = {
            vendor: "MEGATONE S.A.",
            address: "Av. Cabildo 2040, CABA",
            cuit: "30-54930281-2",
            date: found.fecha.split('-').reverse().join('/'),
            ticket: "0005-0000" + Math.floor(1000 + Math.random() * 9000),
            items: `<tr><td style="padding: 4px 0;">NOTEBOOK DELL LATITUDE i7</td><td style="text-align:right; padding: 4px 0; width: 40px;">1.00</td><td style="text-align:right; padding: 4px 0; width: 60px;">$ 650.000,00</td></tr>`,
            neto: "$ 537.190,08",
            iva: "$ 112.809,92",
            total: "$ 650.000,00",
            cae: "76239785930219",
            vto: new Date(Date.now() + 10 * 24 * 3600 * 1000).toLocaleDateString('es-AR')
          };
        } else {
          data = {
            vendor: "COMBUSTIBLES YPF",
            address: "Ruta 3 Km 15, Comodoro Rivadavia",
            cuit: "30-50001234-9",
            date: found.fecha.split('-').reverse().join('/'),
            ticket: "4820-002" + Math.floor(10000 + Math.random() * 90000),
            items: `<tr><td style="padding: 4px 0;">CARGA COMBUSTIBLE INFINIA</td><td style="text-align:right; padding: 4px 0; width: 40px;">22.31</td><td style="text-align:right; padding: 4px 0; width: 60px;">$ ${found.monto.toLocaleString('es-AR')},00</td></tr>`,
            neto: `$ ${(found.monto / 1.21).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            iva: `$ ${(found.monto - (found.monto / 1.21)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            total: `$ ${found.monto.toLocaleString('es-AR')},00`,
            cae: "76239485012398",
            vto: new Date(Date.now() + 10 * 24 * 3600 * 1000).toLocaleDateString('es-AR')
          };
        }
      }
    }

    activeReconstructedData = data;

    // Populating modal fields
    recVendorName.textContent = data.vendor;
    recVendorAddress.textContent = data.address;
    recVendorCuit.textContent = `CUIT: ${data.cuit}`;
    recDate.textContent = data.date;
    recTicketNum.textContent = data.ticket;
    recItemsBody.innerHTML = data.items;
    recNeto.textContent = data.neto;
    recIva.textContent = data.iva;
    recTotal.textContent = data.total;
    recCae.textContent = `CAE N°: ${data.cae}`;
    recCaeVto.textContent = `Vence: ${data.vto}`;

    // Show modal
    recModal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons({ root: recModal });
  });

  // Close modal click
  btnCloseRecModal?.addEventListener('click', (e) => {
    e.stopPropagation();
    recModal.style.display = 'none';
  });

  // Print receipt click
  btnPrintThermal?.addEventListener('click', (e) => {
    e.stopPropagation();
    mainApp.showToast("Iniciando impresión de ticket térmico...", "info");
    setTimeout(() => {
      window.print();
    }, 500);
  });

  // Download thermal ticket receipt text file
  btnDownloadThermal?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activeReconstructedData) return;

    const data = activeReconstructedData;
    // Strip tags and clean whitespace for item text formatting
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = data.items;
    const cleanItemsText = Array.from(tempDiv.querySelectorAll('tr')).map(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length === 3) {
        return `${tds[0].textContent.padEnd(25, ' ')} ${tds[1].textContent.padStart(6, ' ')} ${tds[2].textContent.padStart(10, ' ')}`;
      }
      return tr.textContent.trim();
    }).join('\n');

    const ticketContent = `
========================================
             TICKET COMERCIAL
========================================
${data.vendor.toUpperCase()}
Dirección: ${data.address}
CUIT: ${data.cuit}
----------------------------------------
FECHA: ${data.date}
COMPROBANTE: FACTURA B N° ${data.ticket}
----------------------------------------
DESCRIPCIÓN               CANT     TOTAL
${cleanItemsText}
----------------------------------------
NETO:    ${data.neto.padStart(28, ' ')}
IVA 21%: ${data.iva.padStart(28, ' ')}
TOTAL:   ${data.total.padStart(28, ' ')}
----------------------------------------
CAE:     ${data.cae}
Vence:   ${data.vto}
Sabor digital, VMP Studio.
========================================
`;

    const blob = new Blob([ticketContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket-${data.vendor.toLowerCase().replace(/ /g, '-')}-${data.ticket}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    mainApp.showToast("¡Ticket térmico vectorial descargado con éxito!", "success");
  });

  // -------------------------------------------------------------
  // CONTROLS FOR OCR QUOTA LIMITS & UPGRADE
  // -------------------------------------------------------------
  const quotaModal = document.getElementById('ocr-quota-exceeded-modal');
  const btnCloseQuotaModal = document.getElementById('btn-close-quota-modal');
  const btnCancelQuotaModal = document.getElementById('btn-cancel-quota-modal');
  const btnUpgradeQuotaModal = document.getElementById('btn-upgrade-quota-modal');
  const btnIncreaseQuota = document.getElementById('btn-increase-ocr-quota');
  const btnUpgradeQuotaAlert = document.getElementById('btn-upgrade-quota-alert');
  const btnPortalManualEntry = document.getElementById('btn-portal-manual-entry');
  const btnManualEntryFallback = document.getElementById('btn-manual-entry-fallback');

  const increaseOcrQuota = () => {
    localStorage.setItem('vmp_ocr_scans_limit', '400');
    mainApp.showToast("¡Cupo mensual de Gemini OCR ampliado a 400 escaneos con éxito!", "success");
    if (quotaModal) quotaModal.style.display = 'none';
    // Reactively refresh the view
    mainApp.router();
  };

  const openManualEntryModal = () => {
    if (quotaModal) quotaModal.style.display = 'none'; // Cerrar modal de cuota si está abierto

    const modal = document.createElement('div');
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
      <div style="background:#ffffff; border:1px solid rgba(15,23,42,0.1); border-radius:16px; padding:28px; max-width:420px; width:90%; box-shadow:0 25px 50px -12px rgba(15,23,42,0.25); transform:scale(0.9); transition:transform 0.25s ease;" class="manual-entry-card">
        <h3 style="font-family:var(--font-heading); font-size:18px; font-weight:800; color:var(--text-primary); margin-top:0; margin-bottom:18px; display:flex; align-items:center; gap:8px;">
          <i data-lucide="keyboard" style="color:#f59e0b;"></i> Carga Manual de Gasto
        </h3>
        <form id="portal-manual-form" style="display:flex; flex-direction:column; gap:14px;">
          <div>
            <label style="display:block; font-size:11px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">Proveedor / Emisor *</label>
            <input type="text" id="m-vendor" placeholder="Ej: Distribuidora Comahue" required style="width:100%; border:1px solid var(--border-color); border-radius:6px; padding:10px 12px; font-size:13px; background:#fff; color:var(--text-primary);">
          </div>
          <div>
            <label style="display:block; font-size:11px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">CUIT Emisor *</label>
            <input type="text" id="m-cuit" placeholder="30-12345678-9" required style="width:100%; border:1px solid var(--border-color); border-radius:6px; padding:10px 12px; font-size:13px; background:#fff; color:var(--text-primary);">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:11px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">Monto Total ($) *</label>
              <input type="number" id="m-total" placeholder="0.00" step="0.01" required style="width:100%; border:1px solid var(--border-color); border-radius:6px; padding:10px 12px; font-size:13px; background:#fff; color:var(--text-primary);">
            </div>
            <div>
              <label style="display:block; font-size:11px; font-weight:700; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">Categoría</label>
              <select id="m-category" style="width:100%; border:1px solid var(--border-color); border-radius:6px; padding:10px 12px; font-size:13px; background:#fff; color:var(--text-primary);">
                <option value="Combustibles">Combustibles</option>
                <option value="Servicios">Servicios</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Tecnología">Tecnología</option>
                <option value="Librería">Librería</option>
                <option value="Otros">Otros</option>
              </select>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
            <input type="checkbox" id="m-is-active" style="width:16px; height:16px; cursor:pointer;">
            <label for="m-is-active" style="font-size:12px; color:var(--text-secondary); cursor:pointer; font-weight:600;">Es Bien de Uso (Activo Fijo)</label>
          </div>
          <div style="display:flex; gap:12px; margin-top:10px;">
            <button type="button" id="btn-cancel-manual" style="flex:1; padding:10px 16px; border:1px solid var(--border-color); border-radius:8px; background:#fff; color:var(--text-secondary); font-weight:600; cursor:pointer; font-size:13px;">Cancelar</button>
            <button type="submit" style="flex:1; padding:10px 16px; border:none; border-radius:8px; background:linear-gradient(135deg, #f59e0b, #d97706); color:#fff; font-weight:600; cursor:pointer; font-size:13px; box-shadow:0 4px 12px rgba(245,158,11,0.25);">Guardar Gasto</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons({ root: modal });

    // Animación de entrada
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.querySelector('.manual-entry-card').style.transform = 'scale(1)';
    }, 20);

    const closeModal = () => {
      modal.style.opacity = '0';
      modal.querySelector('.manual-entry-card').style.transform = 'scale(0.9)';
      setTimeout(() => {
        if (modal.parentNode) document.body.removeChild(modal);
      }, 250);
    };

    modal.querySelector('#btn-cancel-manual').addEventListener('click', closeModal);

    modal.querySelector('#portal-manual-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const vendor = modal.querySelector('#m-vendor').value;
      const cuit = modal.querySelector('#m-cuit').value;
      const total = parseFloat(modal.querySelector('#m-total').value) || 0;
      const category = modal.querySelector('#m-category').value;
      const esActivo = modal.querySelector('#m-is-active').checked;

      // Calcular Neto e IVA del Gasto (21% estándar)
      const neto = total / 1.21;
      const iva = total - neto;

      // Validar CUIT
      const isCuitValid = validarCUIT(cuit);
      if (!isCuitValid) {
        mainApp.showToast('Advertencia: CUIT no válido bajo algoritmo Módulo 11. Se guarda igual con advertencia.', 'warning');
      }

      // Agregar transacción de compra
      const newPurchase = {
        id: "c-" + Date.now(),
        fecha: new Date().toISOString().split('T')[0],
        proveedor: vendor,
        cuit: cuit,
        tipo_comprobante: "Factura A",
        numero: "0009-" + Math.floor(10000000 + Math.random() * 90000000).toString().slice(0, 8),
        neto: neto,
        iva: iva,
        total: total,
        es_activo: esActivo,
        categoria: category
      };

      // Importar base de datos y guardar
      import('../db/mockdb.js').then(db => {
        db.addTransaction(activeCompany.id, 'compras', newPurchase);
        
        // Agregar a la lista de documentos digitalizados
        const newTicket = {
          id: "t-" + Date.now(),
          fecha: new Date().toISOString().split('T')[0],
          detalle: `Factura A - ${vendor}`,
          archivo: `manual_gasto_${Date.now().toString().slice(-4)}.pdf`,
          tipo: "Compra",
          monto: total,
          estado: "Aprobado",
          es_activo: esActivo,
          categoria: category
        };

        const tickets = JSON.parse(localStorage.getItem(`vmp_tickets_${activeCompany.id}`)) || [];
        tickets.unshift(newTicket);
        localStorage.setItem(`vmp_tickets_${activeCompany.id}`, JSON.stringify(tickets));

        mainApp.showToast(`¡Comprobante de "${vendor}" cargado manualmente!`, "success");
        closeModal();
        mainApp.router();
      });
    });
  };

  btnIncreaseQuota?.addEventListener('click', (e) => {
    e.stopPropagation();
    increaseOcrQuota();
  });

  btnUpgradeQuotaAlert?.addEventListener('click', (e) => {
    e.stopPropagation();
    increaseOcrQuota();
  });

  btnUpgradeQuotaModal?.addEventListener('click', (e) => {
    e.stopPropagation();
    increaseOcrQuota();
  });

  btnPortalManualEntry?.addEventListener('click', (e) => {
    e.stopPropagation();
    openManualEntryModal();
  });

  btnManualEntryFallback?.addEventListener('click', (e) => {
    e.stopPropagation();
    openManualEntryModal();
  });

  btnCloseQuotaModal?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (quotaModal) quotaModal.style.display = 'none';
  });

  btnCancelQuotaModal?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (quotaModal) quotaModal.style.display = 'none';
  });
}
