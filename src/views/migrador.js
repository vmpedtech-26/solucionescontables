/* -------------------------------------------------------------
   VMP Studio Contable - Legacy System Migrator View
   Pilar 5: Migrador de Sistemas Legados (Tango, Bejerman, Excel)
   ------------------------------------------------------------- */
import { getCompanies, saveCompany, addTransaction } from '../db/mockdb.js';

let migrationState = 'idle'; // 'idle' | 'uploaded' | 'migrating' | 'success'
let selectedSystem = 'tango'; // 'tango' | 'bejerman' | 'excel'
let uploadFileName = '';
let migrationLogs = [];

export function renderMigrador() {
  const systems = [
    { id: 'tango', name: 'Tango Gestión', desc: 'Sistemas ERP Tango (.xlsx / .csv)', icon: 'settings' },
    { id: 'bejerman', name: 'Bejerman Contable', desc: 'Mapeo de archivos planos Bejerman (.txt / .xlsx)', icon: 'layout' },
    { id: 'excel', name: 'Excel / CSV Genérico', desc: 'Planillas estructuradas de cualquier formato', icon: 'file-spreadsheet' }
  ];

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Migrador Universal de Sistemas</h1>
      <p class="view-subtitle">Pilar 5: Cero-Fricción. Migrá datos históricos completos de tus clientes en menos de 60 segundos.</p>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 320px 1fr; gap: 24px; align-items: start;">
    
    <!-- Left Panel: Legacy selector -->
    <div class="card" style="background: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px;">
      <h3 style="font-size: 14.5px; font-weight: 800; color: var(--color-primary); margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
        <i data-lucide="upload-cloud" style="color:var(--color-accent);"></i> 1. Origen de Datos
      </h3>
      
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${systems.map(sys => `
          <div class="sys-option ${selectedSystem === sys.id ? 'active' : ''}" data-sys="${sys.id}" style="border: 1px solid ${selectedSystem === sys.id ? 'var(--color-accent)' : 'var(--border-color)'}; background: ${selectedSystem === sys.id ? 'rgba(31,92,67,0.02)' : '#fff'}; border-radius: 6px; padding: 12px 14px; cursor: pointer; transition: all 0.2s;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="background: ${selectedSystem === sys.id ? 'var(--color-accent)' : 'var(--bg-secondary)'}; color: ${selectedSystem === sys.id ? '#fff' : 'var(--text-secondary)'}; width: 32px; height: 32px; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink:0;">
                <i data-lucide="${sys.icon}" style="width: 16px; height: 16px;"></i>
              </div>
              <div style="overflow: hidden;">
                <h4 style="font-size: 12.5px; font-weight: 750; color: var(--color-primary); margin: 0 0 2px 0;">${sys.name}</h4>
                <p style="font-size: 10px; color: var(--text-secondary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sys.desc}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div style="background: rgba(31, 92, 67, 0.03); border: 1px solid rgba(31, 92, 67, 0.12); padding: 12px; border-radius: 6px; font-size: 11px; color: var(--text-secondary); margin-top: 20px; line-height: 1.4;">
        💡 <strong>Mapeo Inteligente:</strong> El motor de IA analizará de forma heurística la primera fila del archivo cargado para asociar las cabeceras a la base de datos impositiva.
      </div>
    </div>

    <!-- Right Panel: Interactive Upload / Mapping / Progress -->
    <div class="card" style="background: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 24px; min-height: 420px;">
      ${renderMigrationFlowPanel()}
    </div>

  </div>
  `;
}

function renderMigrationFlowPanel() {
  if (migrationState === 'idle') {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed rgba(31, 92, 67, 0.25); border-radius: 8px; padding: 48px 24px; text-align: center; background: rgba(31,92,67,0.01); min-height: 350px;">
        <i data-lucide="file-up" style="width: 48px; height: 48px; color: var(--color-accent); margin-bottom: 16px;"></i>
        <h4 style="font-size: 15px; font-weight: 800; color: var(--color-primary); margin-bottom: 6px;">Cargar Planilla del Sistema Anterior</h4>
        <p style="font-size: 12px; color: var(--text-secondary); max-width: 420px; line-height: 1.5; margin-bottom: 20px;">
          Arrastra tu archivo Excel, CSV o de Texto exportado desde Tango o Bejerman, o haz clic para simular la importación.
        </p>
        <button class="btn btn-primary" id="btn-simulate-upload" style="background: var(--color-accent); border-color: var(--color-accent); font-weight: 700; padding: 10px 24px; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="plus-circle"></i> Seleccionar Archivo
        </button>
      </div>
    `;
  }

  if (migrationState === 'uploaded') {
    return `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="background: rgba(47, 122, 89, 0.08); color: var(--color-accent-light); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <i data-lucide="file-check"></i>
            </div>
            <div>
              <h4 style="font-size: 13.5px; font-weight: 750; color: var(--color-primary); margin: 0 0 2px 0;">${uploadFileName}</h4>
              <p style="font-size: 11px; color: var(--text-secondary); margin: 0;">14.2 MB · 1,420 filas detectadas · Planilla Excel</p>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-reset-upload" style="font-size: 11px; padding: 6px 12px;">Cambiar Archivo</button>
        </div>

        <h4 style="font-size: 13px; font-weight: 850; color: var(--color-primary); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="cpu" style="color: var(--color-accent);"></i> 2. Mapeador Inteligente de Columnas (AI-Mapping)
        </h4>

        <!-- AI Match Columns Table -->
        <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
          <table class="table" style="margin:0; font-size: 12px;">
            <thead style="background: var(--bg-secondary);">
              <tr>
                <th style="padding: 10px 12px;">Columna en Archivo</th>
                <th style="padding: 10px 12px;">Mapeo Sugerido (AI)</th>
                <th style="padding: 10px 12px;" class="text-right">Confianza</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-family: monospace; font-weight: 700; padding: 10px 12px;">FECHA_CBTE</td>
                <td style="padding: 10px 12px; color: var(--color-primary); font-weight: 600;">➔ Fecha Comprobante</td>
                <td style="padding: 10px 12px;" class="text-right"><span style="background: rgba(47, 122, 89, 0.08); color: var(--color-accent-light); font-size: 9.5px; padding: 2px 6px; border-radius: 10px; font-weight: 700;">100% Match</span></td>
              </tr>
              <tr>
                <td style="font-family: monospace; font-weight: 700; padding: 10px 12px;">RAZON_SOCIAL</td>
                <td style="padding: 10px 12px; color: var(--color-primary); font-weight: 600;">➔ Cliente / Proveedor</td>
                <td style="padding: 10px 12px;" class="text-right"><span style="background: rgba(47, 122, 89, 0.08); color: var(--color-accent-light); font-size: 9.5px; padding: 2px 6px; border-radius: 10px; font-weight: 700;">100% Match</span></td>
              </tr>
              <tr>
                <td style="font-family: monospace; font-weight: 700; padding: 10px 12px;">NRO_CUIT</td>
                <td style="padding: 10px 12px; color: var(--color-primary); font-weight: 600;">➔ CUIT Entidad</td>
                <td style="padding: 10px 12px;" class="text-right"><span style="background: rgba(47, 122, 89, 0.08); color: var(--color-accent-light); font-size: 9.5px; padding: 2px 6px; border-radius: 10px; font-weight: 700;">100% Match</span></td>
              </tr>
              <tr>
                <td style="font-family: monospace; font-weight: 700; padding: 10px 12px;">SUBTOTAL_NETO</td>
                <td style="padding: 10px 12px; color: var(--color-primary); font-weight: 600;">➔ Neto Imponible</td>
                <td style="padding: 10px 12px;" class="text-right"><span style="background: rgba(47, 122, 89, 0.08); color: var(--color-accent-light); font-size: 9.5px; padding: 2px 6px; border-radius: 10px; font-weight: 700;">99.2% Match</span></td>
              </tr>
              <tr>
                <td style="font-family: monospace; font-weight: 700; padding: 10px 12px;">IVA_ALIC_21</td>
                <td style="padding: 10px 12px; color: var(--color-primary); font-weight: 600;">➔ Alícuota IVA (21%)</td>
                <td style="padding: 10px 12px;" class="text-right"><span style="background: rgba(47, 122, 89, 0.08); color: var(--color-accent-light); font-size: 9.5px; padding: 2px 6px; border-radius: 10px; font-weight: 700;">98.8% Match</span></td>
              </tr>
              <tr>
                <td style="font-family: monospace; font-weight: 700; padding: 10px 12px;">TOTAL_CBTE</td>
                <td style="padding: 10px 12px; color: var(--color-primary); font-weight: 600;">➔ Importe Total</td>
                <td style="padding: 10px 12px;" class="text-right"><span style="background: rgba(47, 122, 89, 0.08); color: var(--color-accent-light); font-size: 9.5px; padding: 2px 6px; border-radius: 10px; font-weight: 700;">100% Match</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <button class="btn btn-primary" id="btn-run-migration" style="background: var(--color-accent); border-color: var(--color-accent); font-weight: 700; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px;">
          <i data-lucide="play-circle"></i> 3. Ejecutar Migración Completa a Base de Datos
        </button>
      </div>
    `;
  }

  if (migrationState === 'migrating') {
    return `
      <div style="min-height: 350px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h4 style="font-size: 13.5px; font-weight: 800; color: var(--color-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="loader" class="spin" style="animation: spin 1s linear infinite; color: var(--color-accent);"></i> Migrando Registros Históricos...
          </h4>
          <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 16px;">Por favor, no cierres esta pestaña. Parseando asientos de balance y partidas.</p>
          
          <!-- Progress Bar -->
          <div style="background: var(--border-color); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 20px;">
            <div class="migration-progress-bar" style="width: 10%; height: 100%; background: var(--color-accent); border-radius: 3px; transition: width 0.3s ease;"></div>
          </div>
        </div>

        <!-- Terminal Logs -->
        <div style="background: #0f172a; border-radius: 6px; padding: 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.5; color: #38bdf8; height: 200px; overflow-y: auto; text-align: left;">
          ${migrationLogs.map(l => `<div>${l}</div>`).join('')}
        </div>
      </div>
    `;
  }

  if (migrationState === 'success') {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; text-align: center; min-height: 350px;">
        <div style="background: rgba(47, 122, 89, 0.08); border: 1px solid rgba(47, 122, 89, 0.2); width: 56px; height: 56px; border-radius: 50%; color: var(--color-accent-light); display: flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 20px;">
          ✓
        </div>
        <h4 style="font-size: 16px; font-weight: 800; color: var(--color-primary); margin-bottom: 8px;">¡Migración Completada con Éxito!</h4>
        <p style="font-size: 12.5px; color: var(--text-secondary); max-width: 440px; line-height: 1.5; margin-bottom: 24px;">
          Se crearon 154 proveedores/clientes en el padrón y se importaron 1,420 comprobantes. La empresa <strong>Catedral Constructora S.A.</strong> ya figura en tu selector de empresas.
        </p>
        
        <div style="display: flex; gap: 12px; width: 100%; max-width: 380px;">
          <button class="btn btn-outline" id="btn-migrator-restart" style="flex: 1; padding: 10px;">Migrar Otro Cliente</button>
          <button class="btn btn-primary" id="btn-select-new-co" style="flex: 1; background: var(--color-accent); border-color: var(--color-accent); font-weight: 700; padding: 10px;">Seleccionar Empresa</button>
        </div>
      </div>
    `;
  }
}

export function initMigrador(mainApp) {
  // Handle switching source system
  document.querySelectorAll('.sys-option').forEach(item => {
    item.addEventListener('click', () => {
      selectedSystem = item.dataset.sys;
      mainApp.router();
    });
  });

  // Simulate file selection
  document.getElementById('btn-simulate-upload')?.addEventListener('click', () => {
    migrationState = 'uploaded';
    if (selectedSystem === 'tango') uploadFileName = 'TANGO_LIBRO_DIARIO_COMPLETO_2025.xlsx';
    else if (selectedSystem === 'bejerman') uploadFileName = 'BEJERMAN_JOURNAL_EXPORT_COMP.txt';
    else uploadFileName = 'EXCEL_COMPROBANTES_VENTAS_COMPRAS.csv';
    mainApp.router();
  });

  // Reset upload
  document.getElementById('btn-reset-upload')?.addEventListener('click', () => {
    migrationState = 'idle';
    uploadFileName = '';
    mainApp.router();
  });

  // Trigger migration
  document.getElementById('btn-run-migration')?.addEventListener('click', () => {
    migrationState = 'migrating';
    migrationLogs = ['[INFO] Conectando con el motor AI-Mapper de SolucionesContables...', '[INFO] Analizando estructura del archivo...'];
    mainApp.router();

    const steps = [
      { prg: 25, log: '[INFO] Estructura validada. Iniciando mapeo con Gemini AI...' },
      { prg: 40, log: '[INFO] Mapeado de columnas completado. Leyendo 1,420 filas...' },
      { prg: 65, log: '[INFO] CUITs validados. Creando 154 perfiles en base de datos local...' },
      { prg: 85, log: '[INFO] Importando transacciones impositivas de compras y ventas de 2025/2026...' },
      { prg: 95, log: '[INFO] Balance de saldos y consistencia de Libro IVA completado sin errores...' },
      { prg: 100, log: '[SUCCESS] ¡Inyección de empresa Catedral Constructora S.A. exitosa!' }
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        const step = steps[stepIdx];
        migrationLogs.push(step.log);
        
        // Update progress bar width dynamically in the DOM
        const prgBar = document.querySelector('.migration-progress-bar');
        if (prgBar) prgBar.style.width = `${step.prg}%`;

        // Render updated logs list
        const terminal = document.querySelector('.wa-chat-window') || document.querySelector('.card');
        mainApp.router();
        
        stepIdx++;
      } else {
        clearInterval(interval);
        
        // Inyectar Catedral Constructora S.A. en base de datos
        const newCo = {
          id: 'co-catedral',
          razon_social: 'Catedral Constructora S.A.',
          cuit: '30-99887766-5',
          condicion_iva: 'Responsable Inscripto',
          tipo: 'S.A.',
          actividad: 'Construcción y Obras de Ingeniería',
          inicio_actividades: '2019-04-01',
          color: '#fb923c'
        };
        
        // Evitar duplicados de Catedral Constructora en mockdb
        const cos = getCompanies();
        if (!cos.some(c => c.id === newCo.id)) {
          saveCompany(newCo);
          
          // Cargar comprobantes históricos
          addTransaction('co-catedral', 'ventas', { id: 'v-cat-1', fecha: '2026-05-18', cliente: 'Gobierno de la Pampa', cuit: '30-67890123-5', tipo_comprobante: 'Factura A', numero: '0001-00000392', neto: 12000000, iva: 2520000, total: 14520000 });
          addTransaction('co-catedral', 'ventas', { id: 'v-cat-2', fecha: '2026-05-05', cliente: 'Inversiones Sur SRL', cuit: '30-44556677-2', tipo_comprobante: 'Factura A', numero: '0001-00000393', neto: 4500000, iva: 945000, total: 5445000 });
          addTransaction('co-catedral', 'compras', { id: 'c-cat-1', fecha: '2026-05-12', proveedor: 'Hierros Patagónicos S.A.', cuit: '30-11223344-5', tipo_comprobante: 'Factura A', numero: '0012-00038294', neto: 6500000, iva: 1365000, total: 7865000, es_activo: false, categoria: 'Hierros' });
          addTransaction('co-catedral', 'compras', { id: 'c-cat-2', fecha: '2026-05-20', proveedor: 'Excavaciones Neuquén', cuit: '30-55998877-1', tipo_comprobante: 'Factura A', numero: '0002-00000482', neto: 2300000, iva: 483000, total: 2783000, es_activo: false, categoria: 'Servicios de Terceros' });
        }

        migrationState = 'success';
        mainApp.showToast("¡Empresa 'Catedral Constructora S.A.' migrada con éxito!", 'success');
        mainApp.router();
      }
    }, 900);
  });

  // Success button restarts
  document.getElementById('btn-migrator-restart')?.addEventListener('click', () => {
    migrationState = 'idle';
    uploadFileName = '';
    migrationLogs = [];
    mainApp.router();
  });

  // Select Catedral Constructora S.A.
  document.getElementById('btn-select-new-co')?.addEventListener('click', () => {
    mainApp.setActiveCompany('co-catedral');
    migrationState = 'idle';
    uploadFileName = '';
    migrationLogs = [];
    window.location.hash = '#/studio';
  });
}
