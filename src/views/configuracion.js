/* -------------------------------------------------------------
   VMP Studio Contable - Configuración ARCA View Component
   ------------------------------------------------------------- */
import { getCompanies, getActiveCompany } from '../db/mockdb.js';

export function renderConfiguracion() {
  const activeCompany = getActiveCompany();
  const companies = getCompanies();

  // Load configuration settings from localStorage
  const modelType = localStorage.getItem('vmp_arca_model_type') || 'hybrid';
  const certUploaded = localStorage.getItem('vmp_arca_cert_uploaded') === 'true';
  const certName = localStorage.getItem('vmp_arca_cert_name') || 'estudio_comahue_arca.crt';

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Configuración ARCA</h1>
      <p class="view-subtitle">Vinculación de firmas digitales y certificados para facturación y Libro de IVA.</p>
    </div>
    <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: var(--color-accent);">
      Canal Seguro de Enlace Encriptado
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 32px; align-items: start;">
    
    <!-- Left Column: Settings and certificate upload -->
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Model selector card -->
      <div class="card">
        <div class="card-header">
          <h3><i data-lucide="git-fork" style="color: var(--color-accent);"></i> Modelo de Vinculación ARCA</h3>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="font-size: 13.5px; margin-bottom: 20px;">
            Seleccioná cómo querés gestionar los certificados de firma digital (delegación de servicios) para operar con ARCA.
          </p>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Hybrid option -->
            <label class="trial-action-btn" style="border-color: ${modelType === 'hybrid' ? 'var(--color-accent)' : 'var(--border-color)'}; background: ${modelType === 'hybrid' ? 'rgba(22, 163, 74, 0.01)' : '#fff'}; display: flex; align-items: flex-start; gap: 14px; text-align: left; cursor: pointer;">
              <input type="radio" name="arca-model-type" value="hybrid" ${modelType === 'hybrid' ? 'checked' : ''} style="margin-top: 4px; accent-color: var(--color-accent);">
              <div>
                <h5 style="font-size: 13.5px; font-weight: 700; margin-bottom: 2px; color: var(--color-primary);">Modelo Híbrido Delegado (Recomendado)</h5>
                <p style="font-size: 11px; color: var(--text-secondary); white-space: normal; line-height: 1.4;">
                  El estudio contable carga su certificado único de CUIT. Tus clientes delegan el servicio "Libro de IVA Digital" en ARCA a tu CUIT. <strong>No requiere configurar nada por cada cliente nuevo.</strong>
                </p>
              </div>
            </label>

            <!-- Individual option -->
            <label class="trial-action-btn" style="border-color: ${modelType === 'individual' ? 'var(--color-accent)' : 'var(--border-color)'}; background: ${modelType === 'individual' ? 'rgba(22, 163, 74, 0.01)' : '#fff'}; display: flex; align-items: flex-start; gap: 14px; text-align: left; cursor: pointer;">
              <input type="radio" name="arca-model-type" value="individual" ${modelType === 'individual' ? 'checked' : ''} style="margin-top: 4px; accent-color: var(--color-accent);">
              <div>
                <h5 style="font-size: 13.5px; font-weight: 700; margin-bottom: 2px; color: var(--color-primary);">Modelo Certificados Individuales</h5>
                <p style="font-size: 11px; color: var(--text-secondary); white-space: normal; line-height: 1.4;">
                  Cada empresa cliente del estudio genera y carga de manera autónoma sus propios certificados y claves privadas (.key y .crt) en su panel de configuración.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Certificate Upload Card -->
      <div class="card" id="cert-upload-panel">
        <div class="card-header">
          <h3><i data-lucide="shield-check" style="color: var(--color-accent);"></i> Firma Digital del Estudio</h3>
          <span class="badge" style="margin: 0; font-size: 10px; color: var(--color-accent); border-color: rgba(34, 197, 94, 0.3); background: rgba(34, 197, 94, 0.05);">CUIT: 30-71938495-2</span>
        </div>
        <div class="card-body">
          ${certUploaded ? `
            <!-- Uploaded active state -->
            <div style="background: rgba(34, 197, 94, 0.02); border: 1px solid rgba(34, 197, 94, 0.15); border-radius: var(--radius-md); padding: 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 14px;">
                <div style="background: rgba(34, 197, 94, 0.08); color: var(--color-accent); width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <i data-lucide="lock" style="width: 20px; height: 20px;"></i>
                </div>
                <div>
                  <h4 style="font-size: 13.5px; font-weight: 700; color: var(--color-primary);">${certName}</h4>
                  <p style="font-size: 10.5px; color: var(--text-secondary); margin-top: 2px;">Válido hasta: <span style="font-weight: 600; color: var(--color-accent);">24 Mayo 2028</span> (Emisor: AC ARCA)</p>
                </div>
              </div>
              <button class="btn btn-outline btn-sm" id="btn-delete-cert" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.2); padding: 6px 12px; font-size: 12px;">Eliminar</button>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-secondary); padding: 0 4px;">
              <i data-lucide="check-circle" style="width: 14px; height: 14px; color: var(--color-accent);"></i> Certificado encriptado en servidor seguro y enlazado con WSAA.
            </div>
          ` : `
            <!-- Empty state / upload area -->
            <p class="text-secondary" style="font-size: 13px; margin-bottom: 20px;">
              Arrastrá los archivos generados en el portal de ARCA para activar el canal seguro automatizado.
            </p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              
              <!-- CRT Upload Box -->
              <div class="import-area" id="crt-dropzone" style="padding: 20px; margin-bottom: 0; cursor: pointer;">
                <i data-lucide="file-badge" style="width: 28px; height: 28px; color: var(--color-accent); margin-bottom: 8px;"></i>
                <h5 style="font-size: 12px; font-weight: 700;">Subir Certificado (.crt)</h5>
                <p style="font-size: 9.5px; color: var(--text-secondary); margin-top: 4px;">Archivo de Certificado ARCA</p>
                <input type="file" id="crt-file-input" style="display: none;" accept=".crt,.pem">
              </div>

              <!-- KEY Upload Box -->
              <div class="import-area" id="key-dropzone" style="padding: 20px; margin-bottom: 0; cursor: pointer;">
                <i data-lucide="key" style="width: 28px; height: 28px; color: var(--color-accent); margin-bottom: 8px;"></i>
                <h5 style="font-size: 12px; font-weight: 700;">Subir Clave Privada (.key)</h5>
                <p style="font-size: 9.5px; color: var(--text-secondary); margin-top: 4px;">Clave privada generada en CSR</p>
                <input type="file" id="key-file-input" style="display: none;" accept=".key">
              </div>

            </div>
            
            <div style="text-align: center;">
              <button class="btn btn-primary" id="btn-simulate-upload-cert" style="background: var(--color-accent); border-color: var(--color-accent); font-size: 12.5px; padding: 8px 16px;">
                <i data-lucide="shield-check"></i> Enlazar y Homologar Firma Digital
              </button>
            </div>
          `}
        </div>
      </div>

      <!-- Gemini API Key configuration card for the Studio -->
      <div class="card" style="border-color: rgba(22, 163, 74, 0.3); background: rgba(22, 163, 74, 0.01);">
        <div class="card-header" style="border-bottom-color: rgba(22, 163, 74, 0.1);">
          <h3><i data-lucide="key" style="color: var(--color-accent);"></i> Motor IA del Estudio (Gemini OCR Centralizado)</h3>
          <span class="badge" style="margin: 0; font-size: 10px; background: rgba(22, 163, 74, 0.08); color: var(--color-accent-light); border-color: rgba(22, 163, 74, 0.2);">Estudio Contable</span>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="font-size: 13px; line-height: 1.5; margin-bottom: 16px;">
            Ingresá tu clave API de Gemini. Tus clientes **no tendrán que configurar nada**; heredarán automáticamente tu credencial para digitalizar tickets y facturas desde su celular.
          </p>
          <div style="display: flex; gap: 12px; align-items: flex-end;">
            <div style="flex: 1;">
              <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 6px;">Gemini API Key del Estudio</label>
              <input type="password" id="gemini-api-key-input" class="form-input" style="width: 100%; padding: 8px 12px; font-size: 12.5px; background: #fff;" placeholder="Pega tu API Key de Google Gemini..." value="${localStorage.getItem('vmp_gemini_api_key') || ''}">
            </div>
            <button id="btn-save-gemini-key" class="btn btn-primary" style="background: var(--color-accent); border-color: var(--color-accent); height: 38px;">
              Guardar Clave
            </button>
          </div>
          <div style="margin-top: 12px; display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary);">
            <i data-lucide="info" style="width: 13px; height: 13px; color: var(--color-accent-light);"></i>
            <span>¿No tenés una clave? Podés obtener una gratis en <a href="https://aistudio.google.com/" target="_blank" style="color: var(--color-accent-light); text-decoration: underline; font-weight: 600;">Google AI Studio</a>.</span>
          </div>
        </div>
      </div>

      <!-- Supabase Sync configuration card -->
      <div class="card" style="border-color: rgba(34, 197, 94, 0.3); background: rgba(34, 197, 94, 0.01);">
        <div class="card-header" style="border-bottom-color: rgba(34, 197, 94, 0.1);">
          <h3><i data-lucide="database" style="color: var(--color-accent);"></i> Base de Datos Cloud (Supabase Sync)</h3>
          <span class="badge" style="margin: 0; font-size: 10px; background: rgba(34, 197, 94, 0.08); color: var(--color-accent); border-color: rgba(34, 197, 94, 0.2);">SaaS Cloud</span>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="font-size: 13px; line-height: 1.5; margin-bottom: 16px;">
            Conectá la aplicación a tu base de datos de producción en Supabase para sincronizar todas las transacciones, empresas y auditorías de forma real y segura en la nube.
          </p>
          <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
            <div>
              <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 6px;">Supabase URL</label>
              <input type="text" id="supabase-url-input" class="form-input" style="width: 100%; padding: 8px 12px; font-size: 12.5px; background: #fff;" placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co" value="${localStorage.getItem('vmp_supabase_url') || ''}">
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 600; display: block; margin-bottom: 6px;">Supabase Anon Key (API Key)</label>
              <input type="password" id="supabase-anon-key-input" class="form-input" style="width: 100%; padding: 8px 12px; font-size: 12.5px; background: #fff;" placeholder="Pega tu Anon Key..." value="${localStorage.getItem('vmp_supabase_anon_key') || ''}">
            </div>
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <button id="btn-save-supabase" class="btn btn-primary" style="background: var(--color-accent); border-color: var(--color-accent); flex: 1; font-weight: 700; height: 38px;">
              Guardar y Conectar
            </button>
          </div>
          <div style="margin-top: 12px; display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary);">
            <i data-lucide="info" style="width: 13px; height: 13px; color: var(--color-accent);"></i>
            <span>Para configurar las tablas y políticas en tu base de datos, ejecutá el script <a href="file:///Users/matias/Desktop/SISTEMAS%20&%20APPS/SolucionesContables/vmp-studio/supabase_schema.sql" target="_blank" style="color: var(--color-accent); text-decoration: underline; font-weight: 600;">supabase_schema.sql</a> en la consola SQL de Supabase.</span>
          </div>
        </div>
      </div>

    </div>

    <!-- Right Column: Delegated CUITs status & instructions -->
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Delegated status panel -->
      <div class="card">
        <div class="card-header">
          <h3><i data-lucide="users" style="color: var(--color-accent);"></i> Control de CUITs Delegados</h3>
          <span class="badge" style="margin: 0; font-size: 10px;">${companies.length} Empresas</span>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Razón Social</th>
                  <th>CUIT</th>
                  <th>Delegación</th>
                </tr>
              </thead>
              <tbody id="delegation-list-body">
                ${companies.map(c => {
                  const delegationActive = localStorage.getItem(`vmp_delegation_active_${c.id}`) === 'true';
                  return `
                  <tr>
                    <td style="font-weight: 600; font-size: 12.5px;">${c.razon_social}</td>
                    <td class="font-mono text-xs">${c.cuit}</td>
                    <td id="cell-delegation-${c.id}">
                      ${delegationActive ? `
                        <span style="font-size: 10px; font-weight: 700; color: var(--color-accent); display: flex; align-items: center; gap: 4px;">
                          <i data-lucide="check-circle-2" style="width: 12px; height: 12px;"></i> Activa
                        </span>
                      ` : `
                        <button class="btn-check-delegation btn-outline" data-id="${c.id}" style="padding: 2px 8px; font-size: 10px; border-radius: 4px;">
                          Verificar
                        </button>
                      `}
                    </td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- RPA Robot Console Card [NEW MODULE] -->
      <div class="card" style="border-color: rgba(34, 197, 94, 0.25);">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3><i data-lucide="bot" style="color: var(--color-accent);"></i> Consola de Robots RPA Cloud</h3>
          <span class="badge" style="margin: 0; background: rgba(34, 197, 94, 0.08); color: var(--color-accent); border-color: rgba(34, 197, 94, 0.25);">Orquestador Activo</span>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="font-size: 12.5px; margin-bottom: 18px; line-height: 1.4;">
            Monitoreá y configurá los rastreadores automáticos que recopilan información impositiva de ARCA y Rentas provinciales 24/7 sin intervención humana.
          </p>

          <!-- Grid of 4 Scraper bots -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div style="background: rgba(248, 250, 252, 0.6); border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11.5px; font-weight: 750; color: var(--color-primary);">RPA ARCA Comprobantes</span>
                <span style="background: rgba(34, 197, 94, 0.1); color: var(--color-accent-light); font-size: 8.5px; font-weight: 800; padding: 1px 6px; border-radius: 10px;">IDLE</span>
              </div>
              <span style="font-size: 9.5px; color: var(--text-secondary);">Sincronizado hace 4 hs · Diario</span>
            </div>
            
            <div style="background: rgba(248, 250, 252, 0.6); border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11.5px; font-weight: 750; color: var(--color-primary);">RPA Rentas (ARBA/AGIP)</span>
                <span style="background: rgba(34, 197, 94, 0.1); color: var(--color-accent-light); font-size: 8.5px; font-weight: 800; padding: 1px 6px; border-radius: 10px;">IDLE</span>
              </div>
              <span style="font-size: 9.5px; color: var(--text-secondary);">Sincronizado hace 6 hs · Diario</span>
            </div>
            
            <div style="background: rgba(248, 250, 252, 0.6); border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11.5px; font-weight: 750; color: var(--color-primary);">RPA SICORE Retenciones</span>
                <span style="background: rgba(34, 197, 94, 0.1); color: var(--color-accent-light); font-size: 8.5px; font-weight: 800; padding: 1px 6px; border-radius: 10px;">IDLE</span>
              </div>
              <span style="font-size: 9.5px; color: var(--text-secondary);">Sincronizado hace 6 hs · Cada 12h</span>
            </div>
            
            <div style="background: rgba(248, 250, 252, 0.6); border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11.5px; font-weight: 750; color: var(--color-primary);">RPA SIRCREB (Bancos)</span>
                <span style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; font-size: 8.5px; font-weight: 800; padding: 1px 6px; border-radius: 10px;">PENDING</span>
              </div>
              <span style="font-size: 9.5px; color: var(--text-secondary);">Sincronizado hace 12 hs · Cada 12h</span>
            </div>
          </div>

          <!-- Scheduler configuration -->
          <div style="background: rgba(245, 158, 11, 0.03); border: 1px solid rgba(245, 158, 11, 0.12); padding: 12px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="clock" style="width: 16px; height: 16px; color: #f59e0b;"></i>
              <span style="font-size: 11.5px; color: var(--text-secondary); font-weight: 600;">Frecuencia de Sincronización:</span>
            </div>
            <select id="rpa-sync-frequency" style="padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 4px; border: 1px solid var(--border-color); background: #fff; color: var(--color-primary); outline: none;">
              <option value="4h">Cada 4 horas</option>
              <option value="12h" selected>Cada 12 horas</option>
              <option value="24h">Diario a las 02:00 AM</option>
              <option value="manual">Manual únicamente</option>
            </select>
          </div>

          <button class="btn btn-primary w-full" id="btn-run-rpa" style="background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-light) 100%); border:none; font-weight:800; font-size:12.5px; height:38px; display:flex; align-items:center; justify-content:center; gap:6px;">
            <i data-lucide="play" style="width:14px; height:14px;"></i> Sincronizar Robots RPA Ahora
          </button>

          <!-- Immersive RPA Scraper Terminal Console -->
          <div id="rpa-terminal-container" style="display: none; margin-top: 16px; background: var(--text-primary); border: 1px solid #1e293b; border-radius: var(--radius-sm); padding: 12px; box-shadow: var(--shadow-sm);">
            <div style="display:flex; justify-content:space-between; font-size:9.5px; font-weight:700; color:var(--text-secondary); font-family:var(--font-mono); border-bottom:1px solid #1e293b; padding-bottom:6px; margin-bottom:8px;">
              <span>RPA SCRAPER CRAWLER LOGS</span>
              <span id="rpa-terminal-status" style="color:#fbbf24; animation: pulse 1s infinite;">● PROCESANDO</span>
            </div>
            <div id="rpa-terminal" style="font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: var(--text-muted); height: 160px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; line-height: 1.4;">
              <!-- RPA Bot logs printed here -->
            </div>
          </div>
        </div>
      </div>

      <!-- ARCA Delegation Instructions -->
      <div class="card">
        <div class="card-header" style="border-bottom-color: rgba(22, 163, 74, 0.1); background: rgba(22,163,74,0.01);">
          <h3 style="color:var(--color-accent-light);"><i data-lucide="help-circle"></i> ¿Cómo delega el cliente en ARCA?</h3>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="font-size: 12px; line-height: 1.4; margin-bottom: 14px;">
            Para que funcione el modelo híbrido delegado, tu cliente debe realizar este trámite por única vez en la web de ARCA:
          </p>
          <ul style="list-style-type: decimal; padding-left: 16px; font-size: 11.5px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 8px;">
            <li>Ingresa con su Clave Fiscal a la web de ARCA.</li>
            <li>Accede al servicio de <strong>Administrador de Relaciones de Clave Fiscal</strong>.</li>
            <li>Hace clic en <strong>Nueva Relación</strong> -> Buscar Servicio -> <strong>ARCA</strong> -> WebServices.</li>
            <li>Selecciona el servicio: <code>"Reg. Único Tributario (RUT)"</code> o <code>"Libro de IVA Digital"</code>.</li>
            <li>En Representante, ingresa el **CUIT de tu Estudio Contable** (el CUIT que diste de alta con la firma).</li>
            <li>Confirma con su Clave Fiscal y ¡listo! El SaaS empezará a sincronizar sus facturas al instante.</li>
          </ul>
        </div>
      </div>

    </div>

  </div>
  `;
}

export function initConfiguracion(mainApp) {
  if (window.lucide) window.lucide.createIcons();

  const activeCompany = getActiveCompany();
  const delegationBody = document.getElementById('delegation-list-body');

  // Handle Model Radio Toggle
  document.querySelectorAll('input[name="arca-model-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const selected = e.target.value;
      localStorage.setItem('vmp_arca_model_type', selected);
      mainApp.showToast(`Modelo de vinculación cambiado a: ${selected === 'hybrid' ? 'Híbrido Delegado' : 'Certificados Individuales'}`, 'info');
      mainApp.router();
    });
  });

  // Sincronizar y Enlazar Certificado ARCA
  const btnSimUpload = document.getElementById('btn-simulate-upload-cert');
  btnSimUpload?.addEventListener('click', (e) => {
    e.stopPropagation();
    mainApp.showToast("Iniciando handshake criptográfico con WSAA de ARCA...", "info");
    
    setTimeout(() => {
      mainApp.showToast("Verificando cadena de confianza con AC ARCA...", "info");
      
      setTimeout(() => {
        localStorage.setItem('vmp_arca_cert_uploaded', 'true');
        localStorage.setItem('vmp_arca_cert_name', 'estudio_comahue_arca_2026.crt');
        mainApp.showToast("¡Firma digital vinculada y autorizada por ARCA en producción!", "success");
        mainApp.router();
      }, 1200);
    }, 1000);
  });

  // Delete Certificate
  const btnDeleteCert = document.getElementById('btn-delete-cert');
  btnDeleteCert?.addEventListener('click', (e) => {
    e.stopPropagation();
    localStorage.removeItem('vmp_arca_cert_uploaded');
    localStorage.removeItem('vmp_arca_cert_name');
    mainApp.showToast("Certificado eliminado del servidor contable.", "info");
    mainApp.router();
  });

  // Verify Delegated CUITs
  document.querySelectorAll('.btn-check-delegation').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const coId = btn.dataset.id;
      const cell = document.getElementById(`cell-delegation-${coId}`);
      
      btn.textContent = "Verificando...";
      btn.disabled = true;

      setTimeout(() => {
        localStorage.setItem(`vmp_delegation_active_${coId}`, 'true');
        cell.innerHTML = `
          <span style="font-size: 10px; font-weight: 700; color: var(--color-accent); display: flex; align-items: center; gap: 4px; animation: fadeIn 0.3s ease;">
            <i data-lucide="check-circle-2" style="width: 12px; height: 12px;"></i> Activa
          </span>
        `;
        if (window.lucide) window.lucide.createIcons({ root: cell });
        mainApp.showToast("¡Delegación impositiva validada con éxito en ARCA!", "success");
      }, 1500);
    });
  });

  // Drag and drop file handlers
  const crtDrop = document.getElementById('crt-dropzone');
  const keyDrop = document.getElementById('key-dropzone');
  
  const processFileDrop = (name) => {
    mainApp.showToast(`Archivo "${name}" cargado y procesado. Cifrando claves...`, "info");
  };

  crtDrop?.addEventListener('click', () => {
    processFileDrop("estudio_comahue.crt");
  });
  
  keyDrop?.addEventListener('click', () => {
    processFileDrop("estudio_comahue.key");
  });

  // Save Gemini Key from Studio Configuration
  const btnSaveGeminiKey = document.getElementById('btn-save-gemini-key');
  const geminiInput = document.getElementById('gemini-api-key-input');
  btnSaveGeminiKey?.addEventListener('click', () => {
    const key = geminiInput?.value.trim();
    if (key) {
      localStorage.setItem('vmp_gemini_api_key', key);
      mainApp.showToast("¡Clave de Gemini guardada! Agente IA activo para todos tus clientes.", "success");
    } else {
      localStorage.removeItem('vmp_gemini_api_key');
      mainApp.showToast("Clave de Gemini eliminada. Tus clientes operarán en modo de carga manual offline.", "info");
    }
  });

  // -------------------------------------------------------------
  // RPA ROBOTS EXECUTION & SCHEDULER SYSTEM (NEW MODULE)
  // -------------------------------------------------------------
  const btnRunRpa = document.getElementById('btn-run-rpa');
  const rpaContainer = document.getElementById('rpa-terminal-container');
  const rpaTerminal = document.getElementById('rpa-terminal');
  const rpaStatus = document.getElementById('rpa-terminal-status');

  btnRunRpa?.addEventListener('click', (e) => {
    e.stopPropagation();

    // Disable button and prepare terminal
    btnRunRpa.disabled = true;
    btnRunRpa.innerHTML = `<span class="spinner" style="width: 14px; height: 14px; border-left-color: #fff; display: inline-block; vertical-align: middle; margin-right: 6px;"></span> Procesando Robots RPA...`;
    
    rpaContainer.style.display = 'block';
    rpaTerminal.innerHTML = '';
    rpaStatus.textContent = '● PROCESANDO';
    rpaStatus.style.color = '#fbbf24';
    rpaStatus.style.animation = 'pulse 1s infinite';

    const cuitEstudio = activeCompany.cuit || "30-71938495-2";

    const logLines = [
      { t: 0, text: `[RPA BOT] Sincronizador de base tributaria RPA iniciado... v2.6.4-stable`, color: 'var(--color-accent)' },
      { t: 600, text: `[RPA BOT] Configurando sandbox Chromium Headless seguro...`, color: 'var(--text-muted)' },
      { t: 1200, text: `[RPA BOT] Enrutando a pasarela de autenticación: https://auth.afip.gob.ar/`, color: '#38bdf8' },
      { t: 2000, text: `[RPA BOT] Ejecutando bypass CAPTCHA matemático de ARCA... [OK] (Score: 0.99)`, color: 'var(--color-accent-light)' },
      { t: 2800, text: `[RPA BOT] Autenticando con credenciales seguras de CUIT ${cuitEstudio}... Acceso Otorgado.`, color: 'var(--color-accent-light)' },
      { t: 3600, text: `[RPA BOT] Accediendo a servicio 'Domicilio Fiscal Electrónico (DFE)'...`, color: '#a78bfa' },
      { t: 4200, text: `[RPA BOT] DFE Check: 0 notificaciones nuevas / 0 alertas pendientes de lectura.`, color: '#f472b6' },
      { t: 5000, text: `[RPA BOT] Accediendo a 'Mis Comprobantes' (Ventas/Compras)...`, color: '#a78bfa' },
      { t: 5700, text: `[RPA BOT] Sincronizando compras del período actual para ${activeCompany.razon_social}...`, color: 'var(--text-muted)' },
      { t: 6400, text: `[RPA BOT] Descargando y parseando archivo oficial .CSV desde ARCA...`, color: 'var(--text-muted)' },
      { t: 7100, text: `[RPA BOT] Cruce contable finalizado: 12 compras coincidentes importadas en el ledger contable.`, color: 'var(--color-accent-light)' },
      { t: 7800, text: `[RPA BOT] Sincronización exitosa. Base de datos del estudio contable al día.`, color: 'var(--color-accent-light)' },
      { t: 8400, text: `[RPA BOT] Instancia Chromium cerrada. Proceso finalizado.`, color: 'var(--color-accent)' }
    ];

    logLines.forEach(line => {
      setTimeout(() => {
        const span = document.createElement('span');
        span.style.color = line.color;
        span.textContent = line.text + '\n';
        rpaTerminal.appendChild(span);
        rpaTerminal.scrollTop = rpaTerminal.scrollHeight;

        // Finish execution at the last line
        if (line.t === 8400) {
          btnRunRpa.disabled = false;
          btnRunRpa.innerHTML = `<i data-lucide="play" style="width:14px; height:14px; display:inline; vertical-align:middle; margin-right:4px;"></i> Ejecutar Robots RPA Ahora`;
          if (window.lucide) window.lucide.createIcons({ root: btnRunRpa });
          
          rpaStatus.textContent = '● COMPLETADO';
          rpaStatus.style.color = 'var(--color-accent-light)';
          rpaStatus.style.animation = 'none';

          mainApp.showToast("¡Robots RPA sincronizaron y conciliaron con éxito el DFE y Mis Comprobantes!", "success");
        }
      }, line.t);
    });
  });

  // Save Supabase Credentials
  const btnSaveSupabase = document.getElementById('btn-save-supabase');
  const supabaseUrlInput = document.getElementById('supabase-url-input');
  const supabaseAnonKeyInput = document.getElementById('supabase-anon-key-input');
  
  btnSaveSupabase?.addEventListener('click', () => {
    const url = supabaseUrlInput?.value.trim() || '';
    const anonKey = supabaseAnonKeyInput?.value.trim() || '';
    
    if (url && anonKey) {
      localStorage.setItem('vmp_supabase_url', url);
      localStorage.setItem('vmp_supabase_anon_key', anonKey);
      mainApp.showToast("¡Base de Datos Supabase vinculada con éxito! Conectando...", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      localStorage.removeItem('vmp_supabase_url');
      localStorage.removeItem('vmp_supabase_anon_key');
      mainApp.showToast("Conexión Supabase removida. Volviendo a almacenamiento local (localStorage).", "info");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  });
}
