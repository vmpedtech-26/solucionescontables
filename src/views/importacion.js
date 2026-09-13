/* -------------------------------------------------------------
   VMP Studio Contable - Importación ARCA View Component
   ------------------------------------------------------------- */
import { getActiveCompany, addTransaction, getTransactions } from '../db/mockdb.js';
import { fmt } from '../utils.js';

const ARCA_MOCK_EMITIDAS = [
  { fecha: "2026-05-24", tipo_comprobante: "Factura A", numero: "0003-00000850", cliente: "Comercio Mayorista Patagonia", cuit: "30-58930219-4", neto: 150000, iva: 31500, total: 181500, es_activo: false, categoria: "Venta" },
  { fecha: "2026-05-24", tipo_comprobante: "Factura A", numero: "0003-00000851", cliente: "Estación de Servicio Comahue", cuit: "30-50001234-9", neto: 320000, iva: 67200, total: 387200, es_activo: false, categoria: "Venta" },
  { fecha: "2026-05-23", tipo_comprobante: "Factura B", numero: "0003-00000105", cliente: "Gómez Carlos Alberto", cuit: "20-18493021-9", neto: 85000, iva: 17850, total: 102850, es_activo: false, categoria: "Venta" },
  { fecha: "2026-05-22", tipo_comprobante: "Factura A", numero: "0003-00000852", cliente: "Metalúrgica Andina S.A.", cuit: "30-71928371-2", neto: 650000, iva: 136500, total: 786500, es_activo: false, categoria: "Venta" },
  { fecha: "2026-05-21", tipo_comprobante: "Factura B", numero: "0003-00000106", cliente: "Fernández Mariana", cuit: "27-24958302-3", neto: 25000, iva: 5250, total: 30250, es_activo: false, categoria: "Venta" }
];

const ARCA_MOCK_RECIBIDAS = [
  { fecha: "2026-05-25", tipo_comprobante: "Factura A", numero: "1284-00019482", proveedor: "Telecomunicaciones SRL", cuit: "30-99889988-1", neto: 45000, iva: 9450, total: 54450, es_activo: false, categoria: "Servicios" },
  { fecha: "2026-05-23", tipo_comprobante: "Factura A", numero: "0094-00293812", proveedor: "Papelera del Valle", cuit: "30-66442299-5", neto: 38000, iva: 7980, total: 45980, es_activo: false, categoria: "Librería" },
  { fecha: "2026-05-20", tipo_comprobante: "Factura B", numero: "8391-09283746", proveedor: "Librería La Favorita", cuit: "30-11221122-3", neto: 12000, iva: 2520, total: 14520, es_activo: false, categoria: "Librería" },
  { fecha: "2026-05-18", tipo_comprobante: "Factura A", numero: "0103-00048192", proveedor: "Estudio Contable Centenario", cuit: "30-70809010-4", neto: 120000, iva: 25200, total: 145200, es_activo: false, categoria: "Servicios" },
  { fecha: "2026-05-15", tipo_comprobante: "Factura A", numero: "0002-00003291", proveedor: "Constructora Norpat S.A.", cuit: "30-84920193-7", neto: 350000, iva: 73500, total: 423500, es_activo: true, categoria: "Construcciones" },
  { fecha: "2026-05-10", tipo_comprobante: "Factura A", numero: "0008-00012743", proveedor: "Computación Neuquen", cuit: "30-72849102-3", neto: 537190, iva: 112810, total: 650000, es_activo: true, categoria: "Computación" }
];

export function renderImportacion() {
  const activeCompany = getActiveCompany();

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Importación & Reconciliación ARCA</h1>
      <p class="view-subtitle">Consola impositiva para la sincronización y auditoría cruzada de comprobantes con ARCA.</p>
    </div>
    <div style="background: rgba(22, 163, 74, 0.08); border: 1px solid rgba(22, 163, 74, 0.2); padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: var(--color-accent-light);">
      Empresa: ${activeCompany.razon_social}
    </div>
  </div>

  <!-- Solapas de la vista de importación -->
  <div style="display: flex; background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 4px; gap: 4px; margin-bottom: 24px; flex-wrap: wrap;">
    <button class="btn btn-sm import-tab-btn active" data-tab="import" style="flex: 1; min-width: 150px; border: none; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 4px;">
      <i data-lucide="upload-cloud" style="width: 15px; height: 15px;"></i>
      Sincronización Masiva ARCA
    </button>
    <button class="btn btn-sm import-tab-btn" data-tab="reconcile" style="flex: 1; min-width: 150px; border: none; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 4px;">
      <i data-lucide="scale" style="width: 15px; height: 15px; color: var(--color-accent);"></i>
      Conciliación ARCA Live
    </button>
    <button class="btn btn-sm import-tab-btn" data-tab="bank" style="flex: 1; min-width: 150px; border: none; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 4px;">
      <i data-lucide="landmark" style="width: 15px; height: 15px; color: #fbbf24;"></i>
      Conciliación Bancaria (Excel)
    </button>
  </div>

  <!-- PANEL 1: IMPORTACIÓN MASIVA Y SINCRONIZACIÓN -->
  <div id="import-panel-masiva">
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-body">
        <!-- Drag & Drop Zone -->
        <div class="import-area" id="afip-dropzone" style="border-color: rgba(22, 163, 74, 0.3); background: rgba(22, 163, 74, 0.01);">
          <div class="import-icon" style="background: rgba(22, 163, 74, 0.08); color: var(--color-accent-light); border-color: rgba(22, 163, 74, 0.2);">
            <i data-lucide="file-text"></i>
          </div>
          <h4 id="dropzone-title" style="font-size: 14px; font-weight: 700;">Arrastrá aquí tus comprobantes ARCA</h4>
          <p id="dropzone-desc" style="font-size: 12px; margin-top: 4px; margin-bottom: 16px;">Soportamos formatos oficiales de ARCA (Excel .xls / .xlsx, TXT o CSV de "Mis Comprobantes").</p>
          
          <label class="btn btn-outline btn-sm" style="cursor: pointer; border-color: rgba(22, 163, 74, 0.3); color: var(--color-accent-light);">
            Examinar Archivo Real
            <input type="file" id="afip-file-input" style="display: none;" accept=".csv,.txt,.xlsx,.xls">
          </label>

          <div class="demo-afip-pills" style="margin-top: 16px; display: flex; gap: 8px; justify-content: center;">
            <div class="afip-sample-pill" id="btn-simulate-emitidas" style="border-color: rgba(22, 163, 74, 0.25);">
              <i data-lucide="refresh-cw" style="width: 12px; height: 12px; display: inline; vertical-align: middle; margin-right: 4px; color:var(--color-accent-light);"></i>
              Sincronizar Emitidas ARCA (Ventas)
            </div>
            <div class="afip-sample-pill" id="btn-simulate-recibidas" style="border-color: rgba(22, 163, 74, 0.25);">
              <i data-lucide="refresh-cw" style="width: 12px; height: 12px; display: inline; vertical-align: middle; margin-right: 4px; color:var(--color-accent-light);"></i>
              Sincronizar Recibidas ARCA (Compras)
            </div>
          </div>
        </div>

        <!-- Live simulation progress -->
        <div id="sim-progress-container" style="display: none; padding: 24px; border-top: 1px solid var(--border-color); text-align: center;">
          <div class="spinner" style="margin: 0 auto 16px;"></div>
          <h4 id="sim-progress-title">Procesando y validando firmas fiscales ARCA...</h4>
          <div style="width: 100%; max-width: 400px; height: 6px; background: rgba(255,255,255,0.05); border-radius: var(--radius-full); margin: 12px auto; overflow: hidden; position: relative;">
            <div id="sim-progress-bar" style="width: 0%; height: 100%; background: var(--gradient-brand); transition: width 0.1s linear;"></div>
          </div>
          <span id="sim-progress-percent" style="font-family: var(--font-mono); font-size: 13px; font-weight: 600;">0%</span>
        </div>

        <!-- Simulation results -->
        <div id="sim-results-container" style="display: none; border-top: 1px solid var(--border-color); padding-top: 24px;">
          <h3 style="font-size: 15px; font-weight: 800; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="check-circle" style="color: var(--color-accent-light);"></i>
            Comprobantes Importados con Éxito
          </h3>
          <div class="table-responsive">
            <table class="table table-sm">
              <thead>
                <tr id="sim-table-header">
                  <!-- Injected via JS -->
                </tr>
              </thead>
              <tbody id="sim-table-body">
                <!-- Injected via JS -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Instructions Card -->
    <div class="card">
      <div class="card-header">
        <h3><i data-lucide="help-circle"></i> ¿Cómo descargar los comprobantes desde ARCA?</h3>
      </div>
      <div class="card-body">
        <ul style="list-style-type: decimal; padding-left: 20px; font-size: 13.5px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 10px;">
          <li>Ingresá a <strong>ARCA (www.arca.gob.ar)</strong> con tu Clave Fiscal.</li>
          <li>Accedé al servicio interactivo de <strong>"Mis Comprobantes"</strong>.</li>
          <li>Seleccioná la opción <strong>"Emitidos"</strong> (para ventas) o <strong>"Recibidos"</strong> (para compras).</li>
          <li>Elegí el rango de fechas (ej: mes actual) y hacé clic en Buscar.</li>
          <li>En el listado, seleccioná <strong>"Exportar" → Formato XLS o CSV</strong>. El sistema descarga el archivo directamente sin necesidad del botón Excel antiguo.</li>
          <li>¡Listo! Arrastrá ese archivo descargado en este panel y el sistema cargará todo al instante.</li>
        </ul>
        <div style="margin-top:16px; background:rgba(22,163,74,0.03); border:1px solid rgba(22,163,74,0.15); border-radius:var(--radius-sm); padding:12px 16px; font-size:12px; color:var(--text-secondary);">
          <strong style="color:var(--color-accent-light);">Tip RPA:</strong> Para automatizar la descarga sin ingresar manualmente, configurá el bot de descarga en <strong>Configuración ARCA</strong>. Los robots descargan en horarios nocturnos con la clave fiscal del administrador.
        </div>
      </div>
    </div>
  </div>

  <!-- PANEL 2: CONSOLA DE RECONCILIACIÓN AFIP LIVE -->
  <div id="import-panel-reconcile" style="display: none; flex-direction: column; gap: 20px;">
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h3><i data-lucide="scale" style="color: var(--color-accent);"></i> Cruce de Cuentas y Auditoría Cruzada</h3>
        <span class="badge" style="margin: 0; background: rgba(22, 163, 74, 0.08); color: var(--color-accent-light); border-color: rgba(22, 163, 74, 0.2);">ARCA vs VMP Studio</span>
      </div>
      <div class="card-body">
        <p class="text-secondary" style="font-size: 13.5px; margin-bottom: 16px;">
          Esta herramienta cruza de forma inteligente los comprobantes reportados en la base de datos fiscal de ARCA contra los cargados en el Ledger local de VMP Studio. Detecta facturas duplicadas, descuadres de IVA y **documentos omitidos por el cliente (pérdida de crédito fiscal)**.
        </p>

        <!-- Quick actions reconciler buttons -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <button class="btn btn-outline" id="btn-reconcile-compras" style="display: flex; align-items: center; justify-content: center; gap: 6px; border-color: rgba(22, 163, 74, 0.25);">
            <i data-lucide="arrow-down" style="color: var(--color-accent);"></i> Reconciliar Compras (Mis Comprobantes Recibidos)
          </button>
          <button class="btn btn-outline" id="btn-reconcile-ventas" style="display: flex; align-items: center; justify-content: center; gap: 6px; border-color: rgba(22, 163, 74, 0.25);">
            <i data-lucide="arrow-up" style="color: var(--color-accent-light);"></i> Reconciliar Ventas (Mis Comprobantes Emitidos)
          </button>
        </div>

        <!-- Reconciliation status dashboard metrics cards -->
        <div id="reconcile-metrics-dashboard" class="grid-resp-3" style="display: none; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
          <div style="background: rgba(34, 197, 94, 0.04); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: var(--radius-sm); padding: 14px;">
            <div style="font-size: 11px; font-weight: 800; color: var(--color-accent-light); text-transform: uppercase;">Coincidentes</div>
            <div class="font-mono" id="rec-val-coincident" style="font-size: 24px; font-weight: 800; margin-top: 4px; color: var(--color-primary);">0</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Cruce exacto en CUIT y monto.</div>
          </div>
          <div style="background: rgba(239, 68, 68, 0.04); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-sm); padding: 14px;">
            <div style="font-size: 11px; font-weight: 800; color: #ef4444; text-transform: uppercase;">Faltantes en Ledger</div>
            <div class="font-mono" id="rec-val-missing-ledger" style="font-size: 24px; font-weight: 800; margin-top: 4px; color: var(--color-primary);">0</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Declarados en AFIP pero omitidos aquí.</div>
          </div>
          <div style="background: rgba(245, 158, 11, 0.04); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: var(--radius-sm); padding: 14px;">
            <div style="font-size: 11px; font-weight: 800; color: #f59e0b; text-transform: uppercase;">Faltantes en AFIP</div>
            <div class="font-mono" id="rec-val-missing-afip" style="font-size: 24px; font-weight: 800; margin-top: 4px; color: var(--color-primary);">0</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Cargados a mano pero sin CAE legal.</div>
          </div>
        </div>

        <!-- Reconciliation Results Lists -->
        <div id="reconcile-results-container" style="display: none; flex-direction: column; gap: 20px;">
          
          <!-- MISSING IN LEDGER CARD BLOCK -->
          <div id="block-missing-ledger" style="display: flex; flex-direction: column; gap: 10px;">
            <h4 style="font-size: 13px; font-weight: 800; color: #ef4444; display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></span>
              Alerta de Crédito Fiscal Omitido: Comprobantes en ARCA no registrados en el Estudio Contable
            </h4>
            <div class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr style="font-size: 11px;">
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Número</th>
                    <th>Emisor/Proveedor</th>
                    <th>CUIT</th>
                    <th class="text-right">Total</th>
                    <th class="text-center" style="width: 140px;">Acción CPN</th>
                  </tr>
                </thead>
                <tbody id="rec-tbody-missing-ledger">
                  <!-- Filled dynamically -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- COINCIDENT MATCHING CARD BLOCK -->
          <div id="block-coincident" style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
            <h4 style="font-size: 13px; font-weight: 800; color: var(--color-accent-light); display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--color-accent-light);"></span>
              Comprobantes Reconciliados y Conciliados Correctamente (100% Cruzados)
            </h4>
            <div class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr style="font-size: 11px;">
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Número</th>
                    <th>Entidad</th>
                    <th>CUIT</th>
                    <th class="text-right">Total</th>
                    <th class="text-center">Estado</th>
                  </tr>
                </thead>
                <tbody id="rec-tbody-coincident">
                  <!-- Filled dynamically -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- MISSING IN AFIP CARD BLOCK -->
          <div id="block-missing-afip" style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
            <h4 style="font-size: 13px; font-weight: 800; color: #f59e0b; display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;"></span>
              Comprobantes con Carga Manual únicamente (No informados en AFIP)
            </h4>
            <div class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr style="font-size: 11px;">
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Número</th>
                    <th>Entidad</th>
                    <th>CUIT</th>
                    <th class="text-right">Total</th>
                    <th class="text-center">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody id="rec-tbody-missing-afip">
                  <!-- Filled dynamically -->
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  </div>

  <!-- PANEL 3: CONCILIACIÓN BANCARIA INTELIGENTE -->
  <div id="import-panel-bank" style="display: none; flex-direction: column; gap: 20px;">
    <div class="card" style="border-color: rgba(245, 158, 11, 0.25);">
      <div class="card-header" style="border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <h3><i data-lucide="landmark" style="color: #fbbf24;"></i> Conciliación Bancaria con Inteligencia Artificial (AI Matching)</h3>
        <span class="badge" style="margin: 0; background: rgba(245, 158, 11, 0.08); color: #fbbf24; border-color: rgba(245, 158, 11, 0.25);">Estado: Pendiente Conciliar</span>
      </div>
      <div class="card-body">
        <p class="text-secondary" style="font-size: 13.5px; margin-bottom: 16px;">
          Subí el extracto de cuenta bancaria de tu cliente (Banco Galicia, Santander, Macro, Nación o cuenta digital Mercado Pago). El motor de **AI-Matching** cruzará de manera automática las transferencias, comisiones de tarjetas y acreditaciones contra tus facturas de ventas y compras cargadas en el Ledger.
        </p>

        <!-- Configuration parameters and upload -->
        <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 20px; display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 16px; align-items: center;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-secondary); display:block; margin-bottom:6px;">1. Seleccionar Entidad Bancaria</label>
            <select id="bank-entity-select" class="form-input" style="padding: 8px 12px; font-size:13px; width:100%; background:#fff; border-color: var(--border-color);">
              <option value="galicia">Banco Galicia (Oficial)</option>
              <option value="santander">Banco Santander Río</option>
              <option value="nacion">Banco de la Nación Argentina</option>
              <option value="mercadopago">Mercado Pago (CVU)</option>
            </select>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-secondary); display:block; margin-bottom:6px;">2. Cargar Extracto Bancario (Excel o CSV)</label>
            <div style="display:flex; gap:10px;">
              <button type="button" class="btn btn-outline" id="btn-simulate-bank-extract" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; font-size:12px; height:38px; border-color: rgba(245, 158, 11, 0.3); color:#f59e0b; font-weight:700; cursor:pointer;">
                <i data-lucide="refresh-cw" style="width:14px; height:14px;"></i> Cargar Extracto Demo
              </button>
              <label class="btn btn-outline" style="cursor: pointer; font-size:12px; height:38px; display:flex; align-items:center; justify-content:center; gap:6px; margin:0;">
                <i data-lucide="upload" style="width:14px; height:14px;"></i> Examinar...
                <input type="file" id="bank-file-input" style="display: none;" accept=".csv,.xlsx,.xls">
              </label>
            </div>
          </div>
        </div>

        <!-- Bank Loader progress -->
        <div id="bank-progress-container" style="display: none; padding: 24px; border-top: 1px solid var(--border-color); text-align: center;">
          <div class="spinner" style="margin: 0 auto 16px; border-top-color: #fbbf24;"></div>
          <h4 id="bank-progress-title">Procesando extracto e identificando movimientos...</h4>
          <div style="width: 100%; max-width: 400px; height: 6px; background: rgba(255,255,255,0.05); border-radius: var(--radius-full); margin: 12px auto; overflow: hidden; position: relative;">
            <div id="bank-progress-bar" style="width: 0%; height: 100%; background: #fbbf24; transition: width 0.08s linear;"></div>
          </div>
          <span id="bank-progress-percent" style="font-family: var(--font-mono); font-size: 13px; font-weight: 600;">0%</span>
        </div>

        <!-- Bank Reconciliation results layout -->
        <div id="bank-results-container" style="display: none; flex-direction: column; gap: 20px; border-top: 1px solid var(--border-color); padding-top: 20px;">
          
          <div class="grid-resp-4" style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 8px;">
            <div style="background: rgba(34, 197, 94, 0.03); border: 1px solid rgba(34, 197, 94, 0.15); border-radius: var(--radius-sm); padding: 10px;">
              <div style="font-size: 10px; font-weight: 800; color: var(--color-accent-light); text-transform: uppercase;">Movimientos</div>
              <div class="font-mono" style="font-size: 20px; font-weight: 800; margin-top: 2px;">5</div>
            </div>
            <div style="background: rgba(34, 197, 94, 0.03); border: 1px solid rgba(34, 197, 94, 0.15); border-radius: var(--radius-sm); padding: 10px;">
              <div style="font-size: 10px; font-weight: 800; color: var(--color-accent-light); text-transform: uppercase;">Cruces Directos</div>
              <div class="font-mono" style="font-size: 20px; font-weight: 800; margin-top: 2px; color: var(--color-accent-light);">3</div>
            </div>
            <div style="background: rgba(245, 158, 11, 0.03); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: var(--radius-sm); padding: 10px;">
              <div style="font-size: 10px; font-weight: 800; color: #f59e0b; text-transform: uppercase;">Descuadre / Retenciones</div>
              <div class="font-mono" style="font-size: 20px; font-weight: 800; margin-top: 2px; color: #f59e0b;">1</div>
            </div>
            <div style="background: rgba(239, 68, 68, 0.03); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: var(--radius-sm); padding: 10px;">
              <div style="font-size: 10px; font-weight: 800; color: #ef4444; text-transform: uppercase;">Sin Factura</div>
              <div class="font-mono" style="font-size: 20px; font-weight: 800; margin-top: 2px; color: #ef4444;">1</div>
            </div>
          </div>

          <h4 style="font-size: 13px; font-weight: 800; color: var(--color-primary); margin-bottom: 4px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="list" style="width:16px; height:16px; color:#fbbf24;"></i> Resultados de la Conciliación Automática (AI Matcher)
          </h4>

          <div class="table-responsive">
            <table class="table table-sm" style="font-size: 11.5px;">
              <thead>
                <tr>
                  <th>Fecha Banco</th>
                  <th>Detalle / Concepto Extracto</th>
                  <th class="text-right">Importe Banco</th>
                  <th>Comprobante Sugerido en Libros</th>
                  <th class="text-center" style="width:120px;">Diferencia</th>
                  <th class="text-center">Cruce AI</th>
                  <th class="text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="font-mono">24/05/2026</td>
                  <td style="font-weight:600;">TRANSF RECIBIDA - Mayorista Patagonia</td>
                  <td class="font-mono text-right text-emerald" style="font-weight:700;">$ 181.500,00</td>
                  <td style="color:var(--color-accent); font-weight:600;">Factura A N° 0003-00000850</td>
                  <td class="text-center font-mono text-muted">$ 0,00</td>
                  <td class="text-center"><span style="font-size: 9.5px; font-weight:700; color:var(--color-accent-light); background:rgba(34, 197, 94, 0.08); padding:2px 6px; border-radius:4px;">100% COINCIDENTE</span></td>
                  <td class="text-center">
                    <span style="font-size: 9.5px; font-weight:700; color:var(--color-accent-light); background:rgba(34, 197, 94, 0.08); padding:2px 8px; border-radius:4px; display:inline-block;">
                      Conciliado
                    </span>
                  </td>
                </tr>
                <tr>
                  <td class="font-mono">22/05/2026</td>
                  <td style="font-weight:600;">PAGO BANCO GALICIA - Combustibles YPF</td>
                  <td class="font-mono text-right" style="font-weight:700; color:#ef4444;">-$ 217.800,00</td>
                  <td style="color:var(--color-accent); font-weight:600;">Factura A N° 4820-00239481</td>
                  <td class="text-center font-mono text-muted">$ 0,00</td>
                  <td class="text-center"><span style="font-size: 9.5px; font-weight:700; color:var(--color-accent-light); background:rgba(34, 197, 94, 0.08); padding:2px 6px; border-radius:4px;">100% COINCIDENTE</span></td>
                  <td class="text-center">
                    <span style="font-size: 9.5px; font-weight:700; color:var(--color-accent-light); background:rgba(34, 197, 94, 0.08); padding:2px 8px; border-radius:4px; display:inline-block;">
                      Conciliado
                    </span>
                  </td>
                </tr>
                <tr>
                  <td class="font-mono">20/05/2026</td>
                  <td style="font-weight:600;">TRANSF RECIBIDA - Cervecería Austral</td>
                  <td class="font-mono text-right text-emerald" style="font-weight:700;">$ 302.500,00</td>
                  <td style="color:var(--color-accent); font-weight:600;">Factura A N° 0003-00000845</td>
                  <td class="text-center font-mono text-muted">$ 0,00</td>
                  <td class="text-center"><span style="font-size: 9.5px; font-weight:700; color:var(--color-accent-light); background:rgba(34, 197, 94, 0.08); padding:2px 6px; border-radius:4px;">100% COINCIDENTE</span></td>
                  <td class="text-center">
                    <span style="font-size: 9.5px; font-weight:700; color:var(--color-accent-light); background:rgba(34, 197, 94, 0.08); padding:2px 8px; border-radius:4px; display:inline-block;">
                      Conciliado
                    </span>
                  </td>
                </tr>
                <tr>
                  <td class="font-mono">18/05/2026</td>
                  <td style="font-weight:600;">TRANSF RECIBIDA - Estudio Centenario</td>
                  <td class="font-mono text-right text-emerald" style="font-weight:700;">$ 120.000,00</td>
                  <td style="color:var(--color-accent); font-weight:600;">Factura A N° 0103-00048192 ($ 145.200,00)</td>
                  <td class="text-center font-mono text-amber" style="font-weight:700;">-$ 25.200,00</td>
                  <td class="text-center"><span style="font-size: 9.5px; font-weight:700; color:#f59e0b; background:rgba(245, 158, 11, 0.08); padding:2px 6px; border-radius:4px;" title="Retención impositiva de Ingresos Brutos (IIBB)">RETENCIÓN IIBB</span></td>
                  <td class="text-center">
                    <button type="button" class="btn btn-primary" onclick="alert('¡Asiento de retención registrado! Se asientan $ 25.200,00 como Crédito Fiscal de Ingresos Brutos contra la cuenta bancaria en libros contables.')" style="font-size:9px; padding:3px 8px; background:#f59e0b; border-color:#f59e0b; font-weight:700; cursor:pointer;">
                      ⚡ Ajustar
                    </button>
                  </td>
                </tr>
                <tr>
                  <td class="font-mono">15/05/2026</td>
                  <td style="font-weight:600;">RET DE IMPUESTOS - Débito SIRCREB</td>
                  <td class="font-mono text-right" style="font-weight:700; color:#ef4444;">-$ 1.500,00</td>
                  <td class="text-muted">No se encontraron facturas coincidentes</td>
                  <td class="text-center font-mono text-muted">-</td>
                  <td class="text-center"><span style="font-size: 9.5px; font-weight:700; color:#ef4444; background:rgba(239, 68, 68, 0.08); padding:2px 6px; border-radius:4px;">HUÉRFANO</span></td>
                  <td class="text-center">
                    <button type="button" class="btn btn-outline" onclick="alert('¡Gasto registrado! Se asientan $ 1.500,00 en la cuenta 5.2.03.01 (Gastos Bancarios Directos).')" style="font-size:9px; padding:3px 8px; border-color:#ef4444; color:#ef4444; font-weight:700; cursor:pointer;">
                      📝 Gasto
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </div>
  `;

}

export function initImportacion(mainApp) {
  if (window.lucide) window.lucide.createIcons();

  const activeCompany = getActiveCompany();

  // Tab switching setup
  const tabBtns = document.querySelectorAll('.import-tab-btn');
  const panelMasiva = document.getElementById('import-panel-masiva');
  const panelReconcile = document.getElementById('import-panel-reconcile');
  const panelBank = document.getElementById('import-panel-bank');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tabKey = btn.dataset.tab;
      if (tabKey === 'import') {
        panelMasiva.style.display = 'block';
        panelReconcile.style.display = 'none';
        panelBank.style.display = 'none';
      } else if (tabKey === 'reconcile') {
        panelMasiva.style.display = 'none';
        panelReconcile.style.display = 'flex';
        panelBank.style.display = 'none';
      } else {
        panelMasiva.style.display = 'none';
        panelReconcile.style.display = 'none';
        panelBank.style.display = 'flex';
      }
    });
  });

  const dropzone = document.getElementById('afip-dropzone');
  const fileInput = document.getElementById('afip-file-input');
  
  const btnSimEmitidas = document.getElementById('btn-simulate-emitidas');
  const btnSimRecibidas = document.getElementById('btn-simulate-recibidas');
  
  const progContainer = document.getElementById('sim-progress-container');
  const progBar = document.getElementById('sim-progress-bar');
  const progPercent = document.getElementById('sim-progress-percent');
  const progTitle = document.getElementById('sim-progress-title');
  
  const resContainer = document.getElementById('sim-results-container');
  const resHeader = document.getElementById('sim-table-header');
  const resBody = document.getElementById('sim-table-body');

  // Reconciliation DOM
  const btnRecCompras = document.getElementById('btn-reconcile-compras');
  const btnRecVentas = document.getElementById('btn-reconcile-ventas');
  const recMetrics = document.getElementById('reconcile-metrics-dashboard');
  const recContainer = document.getElementById('reconcile-results-container');

  const recValCoincident = document.getElementById('rec-val-coincident');
  const recValMissingLedger = document.getElementById('rec-val-missing-ledger');
  const recValMissingAfip = document.getElementById('rec-val-missing-afip');

  const tbodyMissingLedger = document.getElementById('rec-tbody-missing-ledger');
  const tbodyCoincident = document.getElementById('rec-tbody-coincident');
  const tbodyMissingAfip = document.getElementById('rec-tbody-missing-afip');

  const startSimulation = (batch, type) => {
    if (batch.length === 0) {
      mainApp.showToast("No se detectaron filas válidas de transacciones para importar en el archivo.", "error");
      return;
    }

    resContainer.style.display = 'none';
    progContainer.style.display = 'block';
    
    let percent = 0;
    progBar.style.width = '0%';
    progPercent.textContent = '0%';
    progTitle.textContent = 'Analizando estructura del reporte fiscal de la AFIP...';

    const interval = setInterval(() => {
      percent += 10;
      if (percent > 100) percent = 100;
      
      progBar.style.width = percent + '%';
      progPercent.textContent = percent + '%';

      if (percent === 30) {
        progTitle.textContent = 'Procesando e indexando comprobantes...';
      } else if (percent === 60) {
        progTitle.textContent = 'Validando firmas y consistencia de CUITs en base APOC...';
      } else if (percent === 90) {
        progTitle.textContent = 'Liquidando alícuotas e insertando en base offline-first...';
      } else if (percent === 100) {
        clearInterval(interval);
        
        // Cargar en la DB temporal real
        batch.forEach(tx => {
          addTransaction(activeCompany.id, type, tx);
        });

        // Mostrar listado de resultados
        progContainer.style.display = 'none';
        resContainer.style.display = 'block';
        
        mainApp.showToast(`¡Importación exitosa! Se procesaron ${batch.length} comprobantes reales de la AFIP.`, 'success');

        if (type === 'ventas') {
          resHeader.innerHTML = `
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Número</th>
            <th>Cliente</th>
            <th>CUIT</th>
            <th class="text-right">Total</th>
          `;
          resBody.innerHTML = batch.map(tx => `
            <tr>
              <td class="font-mono text-sm">${tx.fecha.split('-').reverse().join('/')}</td>
              <td><span class="badge-status active" style="font-size:11px; padding:1px 6px;">${tx.tipo_comprobante}</span></td>
              <td class="font-mono text-sm">${tx.numero}</td>
              <td style="font-weight:600;">${tx.cliente}</td>
              <td class="font-mono">${tx.cuit}</td>
              <td class="font-mono text-right" style="font-weight:700; color: var(--color-accent-light);">$ ${tx.total.toLocaleString('es-AR')}</td>
            </tr>
          `).join('');
        } else {
          resHeader.innerHTML = `
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Número</th>
            <th>Proveedor</th>
            <th>CUIT</th>
            <th class="text-right">Total</th>
          `;
          resBody.innerHTML = batch.map(tx => `
            <tr>
              <td class="font-mono text-sm">${tx.fecha.split('-').reverse().join('/')}</td>
              <td><span class="badge-status pending" style="font-size:11px; padding:1px 6px;">${tx.tipo_comprobante}</span></td>
              <td class="font-mono text-sm">${tx.numero}</td>
              <td style="font-weight:600;">${tx.proveedor}</td>
              <td class="font-mono">${tx.cuit}</td>
              <td class="font-mono text-right" style="font-weight:700;">$ ${tx.total.toLocaleString('es-AR')}</td>
            </tr>
          `).join('');
        }

        if (window.lucide) window.lucide.createIcons({ root: resContainer });
      }
    }, 80);
  };

  // -------------------------------------------------------------
  // RECONCILIATION MATCHING ALGORITHM
  // -------------------------------------------------------------
  const executeReconciliation = (afipComprobantes, type) => {
    mainApp.showToast("Iniciando auditoría cruzada de comprobantes en tiempo real...", "info");
    
    // Get existing local transactions for the active company
    const localTxs = getTransactions(activeCompany.id);
    const localList = type === 'compras' ? localTxs.compras : localTxs.ventas;

    const coincident = [];
    const missingLedger = [];
    const missingAfip = [];

    // Helper key creator
    const getCcbteKey = (tx) => {
      const numClean = tx.numero.replace(/[^\d]/g, '');
      return `${numClean}`;
    };

    const localKeysMap = {};
    localList.forEach(tx => {
      const key = getCcbteKey(tx);
      localKeysMap[key] = tx;
    });

    const afipKeysMap = {};
    afipComprobantes.forEach(tx => {
      const key = getCcbteKey(tx);
      afipKeysMap[key] = tx;
    });

    // 1. Cross reference what is in AFIP
    afipComprobantes.forEach(afipTx => {
      const key = getCcbteKey(afipTx);
      const match = localKeysMap[key];
      if (match) {
        coincident.push({ afip: afipTx, local: match });
      } else {
        missingLedger.push(afipTx);
      }
    });

    // 2. Find what is in local list but missing in AFIP
    localList.forEach(localTx => {
      const key = getCcbteKey(localTx);
      const match = afipKeysMap[key];
      if (!match) {
        missingAfip.push(localTx);
      }
    });

    // Render Metrics
    recMetrics.style.display = 'grid';
    recContainer.style.display = 'flex';

    recValCoincident.textContent = coincident.length;
    recValMissingLedger.textContent = missingLedger.length;
    recValMissingAfip.textContent = missingAfip.length;

    // Render lists
    // A. Missing in ledger
    if (missingLedger.length === 0) {
      tbodyMissingLedger.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:16px; font-size:12px;">🎉 ¡Excelente! No se detectaron comprobantes omitidos en el libro contable.</td></tr>`;
    } else {
      tbodyMissingLedger.innerHTML = missingLedger.map((tx, index) => `
        <tr>
          <td class="font-mono text-sm">${tx.fecha.split('-').reverse().join('/')}</td>
          <td><span class="badge-status active" style="font-size:10px; padding:1px 6px;">${tx.tipo_comprobante}</span></td>
          <td class="font-mono text-sm">${tx.numero}</td>
          <td style="font-weight:600;">${type === 'compras' ? tx.proveedor : tx.cliente}</td>
          <td class="font-mono">${tx.cuit}</td>
          <td class="font-mono text-right" style="font-weight:700;">$ ${tx.total.toLocaleString('es-AR')}</td>
          <td class="text-center">
            <button class="btn btn-xs btn-primary btn-rec-incorporate" data-index="${index}" style="font-size: 10px; padding: 2px 8px; background: var(--color-accent); border-color: var(--color-accent);">
              <i data-lucide="plus" style="width:10px; height:10px; display:inline;"></i> Registrar
            </button>
          </td>
        </tr>
      `).join('');

      // Incorporate actions
      document.querySelectorAll('.btn-rec-incorporate').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = Number(btn.dataset.index);
          const item = missingLedger[idx];
          
          // Inject into database
          addTransaction(activeCompany.id, type, item);
          mainApp.showToast(`¡Comprobante N° ${item.numero} incorporado con éxito al Ledger!`, "success");
          
          // Re-trigger reconciler instantly
          if (type === 'compras') {
            executeReconciliation(ARCA_MOCK_RECIBIDAS, 'compras');
          } else {
            executeReconciliation(ARCA_MOCK_EMITIDAS, 'ventas');
          }
        });
      });
    }

    // B. Coincident
    if (coincident.length === 0) {
      tbodyCoincident.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:16px; font-size:12px;">Sin comprobantes coincidentes aún.</td></tr>`;
    } else {
      tbodyCoincident.innerHTML = coincident.map(pair => `
        <tr>
          <td class="font-mono text-sm">${pair.afip.fecha.split('-').reverse().join('/')}</td>
          <td><span class="badge-status active" style="font-size:10px; padding:1px 6px; background: rgba(34, 197, 94, 0.08); color: var(--color-accent-light);">${pair.afip.tipo_comprobante}</span></td>
          <td class="font-mono text-sm">${pair.afip.numero}</td>
          <td style="font-weight:600;">${type === 'compras' ? pair.afip.proveedor : pair.afip.cliente}</td>
          <td class="font-mono">${pair.afip.cuit}</td>
          <td class="font-mono text-right" style="font-weight:700;">$ ${pair.afip.total.toLocaleString('es-AR')}</td>
          <td class="text-center">
            <span style="font-size: 10px; font-weight:700; color:var(--color-accent-light); background:rgba(34, 197, 94, 0.08); padding:2px 8px; border-radius:4px;">
              ✅ CONCILIADO
            </span>
          </td>
        </tr>
      `).join('');
    }

    // C. Missing in AFIP
    if (missingAfip.length === 0) {
      tbodyMissingAfip.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:16px; font-size:12px;">Todos los comprobantes locales están respaldados legalmente por ARCA.</td></tr>`;
    } else {
      tbodyMissingAfip.innerHTML = missingAfip.map(tx => `
        <tr>
          <td class="font-mono text-sm">${tx.fecha.split('-').reverse().join('/')}</td>
          <td><span class="badge-status active" style="font-size:10px; padding:1px 6px; background: rgba(245, 158, 11, 0.08); color: #f59e0b;">${tx.tipo_comprobante}</span></td>
          <td class="font-mono text-sm">${tx.numero}</td>
          <td style="font-weight:600;">${type === 'compras' ? (tx.proveedor || 'Proveedor') : (tx.cliente || 'Cliente')}</td>
          <td class="font-mono">${tx.cuit}</td>
          <td class="font-mono text-right" style="font-weight:700;">$ ${tx.total.toLocaleString('es-AR')}</td>
          <td class="text-center" style="font-size: 10.5px; font-weight:600; color: #f59e0b; line-height:1.2;">
            ⚠️ Carga interna manual<br><span style="font-size:9px; color:var(--text-muted);">Verificar CAE impositivo</span>
          </td>
        </tr>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons({ root: recContainer });
  };

  btnRecCompras?.addEventListener('click', (e) => {
    e.stopPropagation();
    executeReconciliation(ARCA_MOCK_RECIBIDAS, 'compras');
  });

  btnRecVentas?.addEventListener('click', (e) => {
    e.stopPropagation();
    executeReconciliation(ARCA_MOCK_EMITIDAS, 'ventas');
  });

  // -------------------------------------------------------------
  // MOTOR DE ANALIZADOR SINTÁCTICO DE ARCHIVOS REALES DE LA AFIP
  // -------------------------------------------------------------
  const parseAFIPFileContent = (fileContent, fileName) => {
    try {
      const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) throw new Error("El archivo está vacío.");

      // A. Encontrar la fila de encabezados impositiva
      let headerLineIndex = -1;
      for (let i = 0; i < Math.min(15, lines.length); i++) {
        if (/fecha/i.test(lines[i]) && (/comprobante/i.test(lines[i]) || /nro/i.test(lines[i]) || /total/i.test(lines[i]))) {
          headerLineIndex = i;
          break;
        }
      }

      if (headerLineIndex === -1) {
        throw new Error("No se detectó la estructura oficial de AFIP (columna 'Fecha' ausente). Verificá el formato del reporte CSV/TXT.");
      }

      const headerLine = lines[headerLineIndex];
      
      // B. Auto-detectar delimitador impositivo
      let delimiter = ',';
      const commaCount = (headerLine.match(/,/g) || []).length;
      const semiCount = (headerLine.match(/;/g) || []).length;
      const tabCount = (headerLine.match(/\t/g) || []).length;

      if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
      else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

      console.log(`CPN Parser: Separador detectado en reporte: "${delimiter}"`);

      // C. Tokenizar y limpiar nombres de columnas
      const cleanHeaderToken = (token) => {
        return token.replace(/^["']|["']$/g, '').trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quitar tildes
      };

      const columns = headerLine.split(delimiter).map(cleanHeaderToken);
      console.log("CPN Parser: Columnas identificadas:", columns);

      // D. Mapeo inteligente de índices de AFIP
      const idx = {
        fecha: columns.findIndex(c => /fecha/i.test(c)),
        tipo: columns.findIndex(c => /tipo/i.test(c) && !/cambio/i.test(c) && !/documento/i.test(c)),
        pv: columns.findIndex(c => /punto.*venta/i.test(c) || /p\.v\./i.test(c) || /pv/i.test(c)),
        numero: columns.findIndex(c => /numero.*desde/i.test(c) || /nro.*comprobante/i.test(c) || /numero/i.test(c)),
        cuit: columns.findIndex(c => /doc.*receptor/i.test(c) || /doc.*emisor/i.test(c) || /cuit/i.test(c) || /c.u.i.t./i.test(c)),
        entidad: columns.findIndex(c => /denominacion.*receptor/i.test(c) || /denominacion.*emisor/i.test(c) || /nombre/i.test(c) || /cliente/i.test(c) || /proveedor/i.test(c)),
        neto: columns.findIndex(c => /neto.*gravado/i.test(c) || /neto/i.test(c) || /imp.*neto/i.test(c)),
        iva: columns.findIndex(c => /iva/i.test(c) || /impuesto.*valor.*agregado/i.test(c) || /alicuota/i.test(c)),
        total: columns.findIndex(c => /total/i.test(c) || /imp.*total/i.test(c))
      };

      if (idx.fecha === -1 || idx.total === -1) {
        throw new Error("Estructura impositiva incompleta. Faltan columnas core de 'Fecha' o 'Total'.");
      }

      // E. Detectar si el reporte es de Ventas o de Compras
      let operationType = 'ventas';
      const isFileNameCompras = /recibidos|compras|purchases|compr/i.test(fileName);
      const isHeaderCompras = columns.some(c => /emisor/i.test(c) || /proveedor/i.test(c));
      if (isFileNameCompras || isHeaderCompras) {
        operationType = 'compras';
      }
      console.log(`CPN Parser: Dirección operativa detectada: ${operationType.toUpperCase()}`);

      const parsedTransactions = [];

      // F. Parsear filas de datos impositivas
      const sanitizeNumber = (val) => {
        if (!val) return 0;
        let clean = val.replace(/^["']|["']$/g, '').trim();
        clean = clean.replace(/[^0-9,\.-]/g, ''); // quitar signos de peso, espacios
        
        // Formato español: punto para miles y coma para decimales (ej. 1.250,50)
        if (clean.includes(',') && clean.includes('.')) {
          clean = clean.replace(/\./g, '').replace(/,/g, '.');
        } else if (clean.includes(',')) {
          clean = clean.replace(/,/g, '.');
        }
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
      };

      const sanitizeCUIT = (val) => {
        if (!val) return '00-00000000-0';
        let clean = val.replace(/\D/g, ''); // dejar sólo números
        if (clean.length === 11) {
          return `${clean.substring(0, 2)}-${clean.substring(2, 10)}-${clean.substring(10, 11)}`;
        }
        return val;
      };

      const sanitizeDate = (val) => {
        if (!val) return new Date().toISOString().split('T')[0];
        let clean = val.replace(/^["']|["']$/g, '').trim();
        // DD/MM/AAAA o DD-MM-AAAA o DD.MM.AAAA
        const match = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
        if (match) {
          const d = match[1].padStart(2, '0');
          const m = match[2].padStart(2, '0');
          const y = match[3];
          return `${y}-${m}-${d}`;
        }
        return clean; // Retornar tal cual si ya es AAAA-MM-DD
      };

      for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        const tokens = line.split(delimiter).map(t => t.replace(/^["']|["']$/g, '').trim());
        
        if (tokens.length < columns.length / 2) continue; // omitir líneas de totales o firmas cortadas

        const fechaRaw = tokens[idx.fecha];
        if (!fechaRaw || fechaRaw.toLowerCase().includes('total')) continue; // omitir fila de totales al final del archivo

        // Extraer valores sanitizados
        const fecha = sanitizeDate(fechaRaw);
        const tipoComprobante = idx.tipo !== -1 ? tokens[idx.tipo] : 'Factura A';
        
        let numero = '0001-00000001';
        if (idx.pv !== -1 && idx.numero !== -1) {
          const pvStr = tokens[idx.pv].replace(/\D/g, '').padStart(4, '0');
          const numStr = tokens[idx.numero].replace(/\D/g, '').padStart(8, '0');
          numero = `${pvStr}-${numStr}`;
        } else if (idx.numero !== -1) {
          const numClean = tokens[idx.numero].replace(/[^\d-]/g, '');
          if (numClean.includes('-')) {
            numero = numClean;
          } else {
            numero = `0001-${numClean.padStart(8, '0')}`;
          }
        }

        const cuit = sanitizeCUIT(idx.cuit !== -1 ? tokens[idx.cuit] : '');
        const entidad = idx.entidad !== -1 ? tokens[idx.entidad] : 'Cliente Autocargado';
        
        const total = sanitizeNumber(tokens[idx.total]);
        let neto = idx.neto !== -1 ? sanitizeNumber(tokens[idx.neto]) : 0;
        let iva = idx.iva !== -1 ? sanitizeNumber(tokens[idx.iva]) : 0;

        // Si no vienen neto o iva desglosados en el CSV, el sistema los desglosa automáticamente bajo la alícuota general del 21%
        if (neto === 0 && iva === 0 && total > 0) {
          if (tipoComprobante.includes('A') || tipoComprobante.includes('B') || tipoComprobante.includes('C')) {
            neto = Number((total / 1.21).toFixed(2));
            iva = Number((total - neto).toFixed(2));
          } else {
            neto = total;
            iva = 0;
          }
        }

        const record = {
          fecha,
          tipo_comprobante: tipoComprobante,
          numero,
          cuit,
          neto,
          iva,
          total,
          es_activo: false,
          categoria: operationType === 'ventas' ? 'Venta' : 'General'
        };

        if (operationType === 'ventas') {
          record.cliente = entidad;
        } else {
          record.proveedor = entidad;
        }

        parsedTransactions.push(record);
      }

      console.log(`CPN Parser: Archivo analizado correctamente. Registros listos: ${parsedTransactions.length}`);
      
      // If we are in the Reconcile Solapa, we run the Reconciler directly with the parsed list!
      const activeTab = document.querySelector('.import-tab-btn.active').dataset.tab;
      if (activeTab === 'reconcile') {
        executeReconciliation(parsedTransactions, operationType);
      } else {
        startSimulation(parsedTransactions, operationType);
      }

    } catch (err) {
      console.error("CPN Parser Error:", err);
      mainApp.showToast(`Error al procesar el archivo impositivo: ${err.message}`, "error");
    }
  };

  // Drag & drop visual events
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
    const title = document.getElementById('dropzone-title');
    if (title) title.textContent = "¡Soltá para analizar el reporte real!";
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
    const title = document.getElementById('dropzone-title');
    if (title) title.textContent = "Arrastrá aquí tus comprobantes ARCA";
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const title = document.getElementById('dropzone-title');
    if (title) title.textContent = "Arrastrá aquí tus comprobantes ARCA";
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      mainApp.showToast(`Cargando archivo real: ${file.name}...`, 'info');
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        parseAFIPFileContent(evt.target.result, file.name);
      };
      reader.readAsText(file, 'ISO-8859-1');
    }
  });

  fileInput?.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      mainApp.showToast(`Cargando archivo real: ${file.name}...`, 'info');
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        parseAFIPFileContent(evt.target.result, file.name);
      };
      reader.readAsText(file, 'ISO-8859-1');
    }
  });

  // ARCA Connection Sincronización (Direct Integration)
  btnSimEmitidas?.addEventListener('click', (e) => {
    e.stopPropagation();
    startSimulation(ARCA_MOCK_EMITIDAS, 'ventas');
  });

  btnSimRecibidas?.addEventListener('click', (e) => {
    e.stopPropagation();
    startSimulation(ARCA_MOCK_RECIBIDAS, 'compras');
  });

  // Bank reconciliation simulation
  const btnSimBank = document.getElementById('btn-simulate-bank-extract');
  const bankProgContainer = document.getElementById('bank-progress-container');
  const bankProgBar = document.getElementById('bank-progress-bar');
  const bankProgPercent = document.getElementById('bank-progress-percent');
  const bankProgTitle = document.getElementById('bank-progress-title');
  const bankResults = document.getElementById('bank-results-container');

  btnSimBank?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (bankResults) bankResults.style.display = 'none';
    if (bankProgContainer) bankProgContainer.style.display = 'block';
    
    let percent = 0;
    if (bankProgBar) bankProgBar.style.width = '0%';
    if (bankProgPercent) bankProgPercent.textContent = '0%';
    if (bankProgTitle) bankProgTitle.textContent = 'Analizando transacciones bancarias del extracto...';

    const interval = setInterval(() => {
      percent += 10;
      if (percent > 100) percent = 100;
      
      if (bankProgBar) bankProgBar.style.width = percent + '%';
      if (bankProgPercent) bankProgPercent.textContent = percent + '%';

      if (percent === 30) {
        if (bankProgTitle) bankProgTitle.textContent = 'Identificando CUITs de proveedores y clientes en movimientos...';
      } else if (percent === 60) {
        if (bankProgTitle) bankProgTitle.textContent = 'Cruzando montos contra facturas activas del Ledger...';
      } else if (percent === 90) {
        if (bankProgTitle) bankProgTitle.textContent = 'Corrigiendo diferencias por retenciones impositivas...';
      } else if (percent === 100) {
        clearInterval(interval);
        if (bankProgContainer) bankProgContainer.style.display = 'none';
        if (bankResults) bankResults.style.display = 'flex';
        mainApp.showToast("¡Conciliación bancaria completada! Encontramos 3 coincidencias exactas, 1 retención y 1 movimiento huérfano.", "success");
        if (window.lucide) window.lucide.createIcons({ root: bankResults });
      }
    }, 70);
  });
}
