/* -------------------------------------------------------------
   VMP Studio Contable - Empresas Clientes View Component
   ------------------------------------------------------------- */
import { getCompanies, saveCompany } from '../db/mockdb.js';

export function renderEmpresas() {
  const companies = getCompanies();

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Empresas Clientes</h1>
      <p class="view-subtitle">Administrá la cartera de clientes de tu estudio contable.</p>
    </div>
    <button class="btn btn-primary" id="btn-show-add-company">
      <i data-lucide="plus"></i> Nueva Empresa
    </button>
  </div>

  <!-- Add Company Form (Collapsible/Hidden by default) -->
  <div class="card id-form-card" id="add-company-form-container" style="display: none; margin-bottom: 32px;">
    <div class="card-header">
      <h3><i data-lucide="building"></i> Registrar Nueva Empresa Cliente</h3>
      <button class="btn-icon-sm" id="btn-cancel-add-company" title="Cancelar"><i data-lucide="x"></i></button>
    </div>
    <div class="card-body">
      <form id="add-company-form" class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Razón Social *</label>
          <input type="text" id="co-name" class="form-input" placeholder="Nombre completo de la empresa / titular" required>
        </div>
        <div class="form-group">
          <label class="form-label">CUIT *</label>
          <input type="text" id="co-cuit" class="form-input" placeholder="30-12345678-9" required>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Entidad</label>
          <select id="co-type" class="form-select">
            <option value="SRL">S.R.L. (Soc. Responsabilidad Limitada)</option>
            <option value="SA">S.A. (Sociedad Anónima)</option>
            <option value="Monotributo">Monotributista Independiente</option>
            <option value="Unipersonal">Empresa Unipersonal</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Condición frente al IVA *</label>
          <select id="co-iva" class="form-select">
            <option value="Responsable Inscripto">Responsable Inscripto</option>
            <option value="Monotributo">Monotributo</option>
            <option value="Exento">Exento</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Actividad Principal</label>
          <input type="text" id="co-activity" class="form-input" placeholder="Ej: Venta de artículos informáticos">
        </div>
        <div class="form-group">
          <label class="form-label">Inicio de Actividades</label>
          <input type="date" id="co-start" class="form-input" value="2026-01-01">
        </div>
        <div class="form-group">
          <label class="form-label">Color de Marca / Panel</label>
          <input type="color" id="co-color" class="form-input" style="height: 45px; padding: 4px; cursor: pointer;" value="#0d9488">
        </div>
        
        <div style="grid-column: span 2; display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px;">
          <button type="button" class="btn btn-outline" id="btn-form-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar Empresa</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Companies Table -->
  <div class="card">
    <div class="card-body p-0">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>CUIT</th>
              <th>Régimen Fiscal</th>
              <th>Actividad Principal</th>
              <th>Inicio Actividades</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${companies.map(c => `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="company-avatar" style="background: ${c.color}; width: 36px; height: 36px; border-radius: 10px; font-weight: 800; font-size: 15px;">
                      ${c.razon_social[0]}
                    </div>
                    <div>
                      <div style="font-weight: 700; font-size: 14px;">${c.razon_social}</div>
                      <div style="font-size: 11px; color: var(--text-secondary);">${c.tipo}</div>
                    </div>
                  </div>
                </td>
                <td class="font-mono" style="font-weight: 500;">${c.cuit}</td>
                <td>
                  <span class="badge" style="margin: 0; padding: 4px 12px; font-size: 11px; white-space: nowrap; display: inline-block; color: ${c.condicion_iva.includes('Inscripto') ? 'var(--color-teal-light)' : '#818cf8'}; border-color: ${c.condicion_iva.includes('Inscripto') ? 'rgba(13, 148, 136, 0.3)' : 'rgba(99, 102, 241, 0.3)'}; background: ${c.condicion_iva.includes('Inscripto') ? 'rgba(13, 148, 136, 0.08)' : 'rgba(99, 102, 241, 0.08)'}">
                    ${c.condicion_iva}
                  </span>
                </td>
                <td style="color: var(--text-secondary); font-size: 13px;">${c.actividad || 'No especificada'}</td>
                <td class="font-mono text-sm">${c.inicio_actividades.split('-').reverse().join('/')}</td>
                <td>
                  <span class="badge-status active">Activo</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}

export function initEmpresas(mainApp) {
  if (window.lucide) window.lucide.createIcons();

  const btnShowAdd = document.getElementById('btn-show-add-company');
  const btnCancelAdd = document.getElementById('btn-cancel-add-company');
  const btnFormCancel = document.getElementById('btn-form-cancel');
  const container = document.getElementById('add-company-form-container');
  const form = document.getElementById('add-company-form');

  // Mostrar Formulario
  btnShowAdd?.addEventListener('click', () => {
    container.style.display = 'block';
    btnShowAdd.style.display = 'none';
    document.getElementById('co-name').focus();
  });

  // Ocultar Formulario
  const hideForm = () => {
    container.style.display = 'none';
    btnShowAdd.style.display = 'flex';
    form.reset();
  };

  btnCancelAdd?.addEventListener('click', hideForm);
  btnFormCancel?.addEventListener('click', hideForm);

  // Procesar Formulario
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('co-name').value;
    const cuit = document.getElementById('co-cuit').value;
    const type = document.getElementById('co-type').value;
    const iva = document.getElementById('co-iva').value;
    const activity = document.getElementById('co-activity').value;
    const start = document.getElementById('co-start').value;
    const color = document.getElementById('co-color').value;

    const newCompany = {
      razon_social: name,
      cuit,
      tipo: type,
      condicion_iva: iva,
      actividad: activity,
      inicio_actividades: start,
      color
    };

    saveCompany(newCompany);
    mainApp.showToast(`¡Empresa "${name}" registrada con éxito!`, 'success');
    
    // Ocultar formulario y refrescar la vista
    hideForm();
    mainApp.router();
  });
}
