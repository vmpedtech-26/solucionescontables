/* -------------------------------------------------------------
   VMP Studio Contable - Empresas Clientes View Component
   ------------------------------------------------------------- */
import { getCompaniesAsync, saveCompanyAsync, deleteCompanyAsync } from '../db/mockdb.js';
import { supabase, isSupabaseConfigured } from '../db/supabase.js';
import { sanitizeInput as esc, validarCUIT } from '../utils.js';
import { arca } from '../arca.js';
import { abrirAccesosPortal, crearInvitacion } from './portal_accesos.js';

export async function renderEmpresas() {
  const companies = await getCompaniesAsync();

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
      <h3 id="company-form-title"><i data-lucide="building"></i> Registrar Nueva Empresa Cliente</h3>
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
          <div style="display:flex;gap:8px;">
            <input type="text" id="co-cuit" class="form-input" placeholder="30-12345678-9" required style="flex:1;">
            ${isSupabaseConfigured ? '<button type="button" class="btn btn-outline btn-sm" id="co-padron" title="Trae los datos del padrón de ARCA">Completar desde ARCA</button>' : ''}
          </div>
          <div id="co-padron-info" style="font-size:11.5px;margin-top:4px;"></div>
          <input type="hidden" id="co-domicilio">
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Entidad</label>
          <select id="co-type" class="form-select">
            <option value="SRL">S.R.L. (Soc. Responsabilidad Limitada)</option>
            <option value="SA">S.A. (Sociedad Anónima)</option>
            <option value="SAS">S.A.S. (Soc. por Acciones Simplificada)</option>
            <option value="Unipersonal">Empresa Unipersonal / Monotributista</option>
            <option value="Sucesion Indivisa">Sucesión Indivisa</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Condición frente al IVA *</label>
          <select id="co-iva" class="form-select">
            <option value="Responsable Inscripto">Responsable Inscripto</option>
            <optgroup label="Monotributo">
              <option value="Monotributo - Cat A">Monotributo - Categoría A</option>
              <option value="Monotributo - Cat B">Monotributo - Categoría B</option>
              <option value="Monotributo - Cat C">Monotributo - Categoría C</option>
              <option value="Monotributo - Cat D">Monotributo - Categoría D</option>
              <option value="Monotributo - Cat E">Monotributo - Categoría E</option>
              <option value="Monotributo - Cat F">Monotributo - Categoría F</option>
              <option value="Monotributo - Cat G">Monotributo - Categoría G</option>
              <option value="Monotributo - Cat H">Monotributo - Categoría H</option>
              <option value="Monotributo - Cat I">Monotributo - Categoría I</option>
              <option value="Monotributo - Cat J">Monotributo - Categoría J</option>
              <option value="Monotributo - Cat K">Monotributo - Categoría K</option>
            </optgroup>
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
          <button type="submit" class="btn btn-primary" id="company-form-submit">Registrar Empresa</button>
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
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${companies.map(c => `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="company-avatar" style="background: ${c.color}; width: 36px; height: 36px; border-radius: 10px; font-weight: 800; font-size: 15px;">
                      ${esc(c.razon_social[0])}
                    </div>
                    <div>
                      <div style="font-weight: 700; font-size: 14px;">${esc(c.razon_social)}</div>
                      <div style="font-size: 11px; color: var(--text-secondary);">${esc(c.tipo)}</div>
                    </div>
                  </div>
                </td>
                <td class="font-mono" style="font-weight: 500;">${esc(c.cuit)}</td>
                <td>
                  <span class="badge" style="margin: 0; padding: 4px 12px; font-size: 11px; white-space: nowrap; display: inline-block; color: ${c.condicion_iva.includes('Inscripto') ? 'var(--color-teal-light)' : 'var(--color-accent-light)'}; border-color: ${c.condicion_iva.includes('Inscripto') ? 'rgba(13, 148, 136, 0.3)' : 'rgba(22, 163, 74, 0.3)'}; background: ${c.condicion_iva.includes('Inscripto') ? 'rgba(13, 148, 136, 0.08)' : 'rgba(22, 163, 74, 0.08)'}">
                    ${esc(c.condicion_iva)}
                  </span>
                </td>
                <td style="color: var(--text-secondary); font-size: 13px;">${esc(c.actividad || 'No especificada')}</td>
                <td class="font-mono text-sm">${c.inicio_actividades.split('-').reverse().join('/')}</td>
                <td>
                  <span class="badge-status active">Activo</span>
                </td>
                <td>
                  <div style="display:flex; gap:6px; justify-content:flex-end; flex-wrap:wrap;">
                    <button class="btn btn-outline btn-sm btn-edit-company" data-id="${esc(c.id)}" style="font-size: 11px; padding: 4px 10px;" title="Editar datos"><i data-lucide="pencil" style="width: 12px; height: 12px;"></i> Editar</button>
                    ${isSupabaseConfigured ? `<button class="btn btn-outline btn-sm btn-clients-company" data-id="${esc(c.id)}" data-name="${esc(c.razon_social)}" style="font-size: 11px; padding: 4px 10px;" title="Clientes con acceso al portal"><i data-lucide="users" style="width: 12px; height: 12px;"></i> Portal</button>` : ''}
<button class="btn btn-outline btn-sm btn-invite-client" data-id="${esc(c.id)}" data-name="${esc(c.razon_social)}" style="font-size: 11px; padding: 4px 10px; white-space: nowrap;">
                    <i data-lucide="user-plus" style="width: 12px; height: 12px;"></i> Invitar cliente
                  </button>
                    <button class="btn btn-outline btn-sm btn-delete-company" data-id="${esc(c.id)}" data-name="${esc(c.razon_social)}" style="font-size: 11px; padding: 4px 10px; color:#ef4444; border-color: rgba(239,68,68,0.3);" title="Eliminar empresa"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i></button>
                  </div>
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

export async function initEmpresas(mainApp) {
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
    delete form.dataset.editId;
    document.getElementById('company-form-title').innerHTML = '<i data-lucide="building"></i> Registrar Nueva Empresa Cliente';
    document.getElementById('company-form-submit').textContent = 'Registrar Empresa';
    if (window.lucide) window.lucide.createIcons();
  };

  const companiesActuales = await getCompaniesAsync();

  // Editar: reutiliza el formulario de alta con los datos cargados
  document.querySelectorAll('.btn-edit-company').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = companiesActuales.find((x) => x.id === btn.dataset.id);
      if (!c) return;
      form.dataset.editId = c.id;
      document.getElementById('co-name').value = c.razon_social || '';
      document.getElementById('co-cuit').value = c.cuit || '';
      document.getElementById('co-type').value = c.tipo || 'SRL';
      document.getElementById('co-iva').value = c.condicion_iva || 'Responsable Inscripto';
      document.getElementById('co-activity').value = c.actividad || '';
      document.getElementById('co-start').value = c.inicio_actividades || '';
      document.getElementById('co-color').value = c.color || '#0d9488';
      const dom = document.getElementById('co-domicilio');
      if (dom) dom.value = c.domicilio || '';
      document.getElementById('company-form-title').innerHTML = '<i data-lucide="pencil"></i> Editar empresa';
      document.getElementById('company-form-submit').textContent = 'Guardar cambios';
      container.style.display = 'block';
      btnShowAdd.style.display = 'none';
      if (window.lucide) window.lucide.createIcons();
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Accesos al portal: clientes, invitaciones y permiso para facturar
  document.querySelectorAll('.btn-clients-company').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = companiesActuales.find((x) => x.id === btn.dataset.id);
      if (c) abrirAccesosPortal(c, mainApp);
    });
  });

  // Eliminar: borra la empresa y todos sus registros (confirmacion escrita)
  document.querySelectorAll('.btn-delete-company').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nombre = btn.dataset.name;
      const r = window.prompt(`Vas a eliminar "${nombre}" y TODOS sus registros: comprobantes, libros, retenciones, sueldos y accesos de sus clientes al portal. No se puede deshacer.\n\nPara confirmar, escribí ELIMINAR:`);
      if (r === null) return;
      if (r.trim() !== 'ELIMINAR') { mainApp.showToast('Confirmación incorrecta: no se eliminó nada.', 'info'); return; }
      try {
        await deleteCompanyAsync(btn.dataset.id);
        mainApp.showToast(`"${nombre}" fue eliminada.`, 'success');
      } catch (err) {
        mainApp.showToast(`No se pudo eliminar: ${err.message || err}`, 'error');
      }
    });
  });

  btnCancelAdd?.addEventListener('click', hideForm);
  btnFormCancel?.addEventListener('click', hideForm);

  // Datos desde el padron de ARCA (requiere certificado del estudio)
  document.getElementById('co-padron')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const info = document.getElementById('co-padron-info');
    const cuit = document.getElementById('co-cuit').value;
    if (!validarCUIT(cuit)) { info.innerHTML = '<span style="color:#b91c1c;">Ingresá un CUIT válido.</span>'; return; }
    btn.disabled = true; btn.textContent = 'Consultando…';
    try {
      const p = await arca('padron', { cuit });
      if (p.nombre) document.getElementById('co-name').value = p.nombre;
      const sel = document.getElementById('co-iva');
      if ([...sel.options].some((o) => o.value === p.condicionIva)) sel.value = p.condicionIva;
      const dom = [p.domicilio.direccion, p.domicilio.localidad, p.domicilio.provincia].filter(Boolean).join(', ');
      document.getElementById('co-domicilio').value = dom;
      if (p.actividades[0]) document.getElementById('co-activity').value = p.actividades[0].descripcion || '';
      info.innerHTML = `<span style="color:${p.estadoClave === 'ACTIVO' ? '#15803d' : '#b91c1c'};">Clave fiscal ${esc(p.estadoClave || '—')}</span> · ${esc(p.condicionIva)}${dom ? ' · ' + esc(dom) : ''}${p.ambiente === 'homologacion' ? ' <em>(datos de homologación)</em>' : ''}${p.errores.length ? '<br><span style="color:#b45309;">' + esc(p.errores.join(' | ')) + '</span>' : ''}`;
    } catch (err) {
      info.innerHTML = `<span style="color:#b91c1c;">${esc(err.message)}</span>`;
    } finally {
      btn.disabled = false; btn.textContent = 'Completar desde ARCA';
    }
  });

  // Procesar Formulario
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('co-name').value;
    const cuit = document.getElementById('co-cuit').value;
    const type = document.getElementById('co-type').value;
    const iva = document.getElementById('co-iva').value;
    const activity = document.getElementById('co-activity').value;
    const start = document.getElementById('co-start').value;
    const color = document.getElementById('co-color').value;
    const domicilio = document.getElementById('co-domicilio')?.value || '';

    const editId = form.dataset.editId || null;
    const previa = editId ? (companiesActuales.find((x) => x.id === editId) || {}) : {};
    const newCompany = {
      ...previa,
      razon_social: name,
      cuit,
      tipo: type,
      condicion_iva: iva,
      actividad: activity,
      inicio_actividades: start,
      color,
      domicilio
    };

    try {
      await saveCompanyAsync(newCompany);
      mainApp.showToast(editId ? `Cambios guardados en "${name}".` : `¡Empresa "${name}" registrada con éxito!`, 'success');
      hideForm();
      // No hace falta un mainApp.router() explícito acá: saveCompanyAsync ya
      // dispara "vmp_db_updated", que main.js escucha para re-renderizar.
    } catch (err) {
      mainApp.showToast(`Error al guardar la empresa: ${err.message || err}`, 'error');
    }
  });

  // Generar invitación de Portal del Cliente para una empresa puntual
  document.querySelectorAll('.btn-invite-client').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!isSupabaseConfigured || !supabase) {
        mainApp.showToast('Invitar clientes requiere una base de datos configurada.', 'error');
        return;
      }
      const empresaId = btn.dataset.id;
      const empresaName = btn.dataset.name;
      try {
        const link = await crearInvitacion(empresaId);
        await navigator.clipboard.writeText(link);
        mainApp.showToast(`¡Link de invitación para "${empresaName}" copiado al portapapeles!`, 'success');
      } catch (err) {
        mainApp.showToast(`Error al generar la invitación: ${err.message || err}`, 'error');
      }
    });
  });
}
