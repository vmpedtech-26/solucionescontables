/* -------------------------------------------------------------
   VMP Studio Contable - Libro de Sueldos Digital view Component
   ------------------------------------------------------------- */
import { getActiveCompany } from '../db/mockdb.js';
import { fmt, downloadFile, renderPremiumTeaser } from '../utils.js';

export function renderSueldos() {
  const activeCo = getActiveCompany();
  
  // Contenido principal del módulo
  const mainHTML = `
  <div class="view-header">
    <div>
      <h1 class="view-title">Libro de Sueldos Digital ARCA</h1>
      <p class="view-subtitle">Liquidación de sueldos, cálculo de aportes y exportación en formato oficial ARCA/AFIP.</p>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <span class="badge" style="background: rgba(22, 163, 74, 0.08); color: var(--color-primary); border-color: rgba(22, 163, 74, 0.2); margin: 0; padding: 6px 12px; font-weight: 700;">
        🏢 ${activeCo.razon_social}
      </span>
    </div>
  </div>

  <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;">
    <!-- Calculadora / Formulario de Carga -->
    <div class="card" style="backdrop-filter: blur(10px); background: rgba(255, 255, 255, 0.8);">
      <div class="card-header" style="border-bottom: 1px solid rgba(15, 23, 42, 0.08); padding-bottom: 12px;">
        <h3 style="font-weight: 800; font-size: 16px; display: flex; align-items: center; gap: 8px; color: var(--text-primary); margin: 0;">
          <i data-lucide="calculator" style="color: var(--color-primary); width: 20px; height: 20px;"></i>
          Nueva Liquidación de Haberes
        </h3>
      </div>
      <div class="card-body" style="padding-top: 16px;">
        <form id="sueldo-calc-form" style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">Empleado (Nombre y Apellido)</label>
              <input type="text" id="emp-name" class="form-input" placeholder="Ej: Juan Pérez" required style="font-size: 13px; padding: 10px 12px;">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">CUIL</label>
              <input type="text" id="emp-cuil" class="form-input" placeholder="20-35849201-4" required style="font-size: 13px; padding: 10px 12px; font-family: monospace;">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">Sueldo Bruto *</label>
              <div style="position: relative; display: flex; align-items: center;">
                <span style="position: absolute; left: 12px; font-size: 13px; font-weight: 600; color: var(--text-secondary);">$</span>
                <input type="number" id="emp-bruto" class="form-input" placeholder="0.00" required min="1" step="0.01" style="font-size: 13px; padding: 10px 12px 10px 24px; font-weight: 700;">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">Periodo Liquidado</label>
              <input type="month" id="emp-period" class="form-input" required style="font-size: 13px; padding: 8px 12px;">
            </div>
          </div>

          <div class="form-group" style="background: rgba(15, 23, 42, 0.02); border: 1px solid rgba(15, 23, 42, 0.05); padding: 12px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">Afilación Sindicato SEC</span>
              <span style="font-size: 11px; color: var(--text-secondary);">Aplica deducción adicional del 2.0% (Comercio).</span>
            </div>
            <input type="checkbox" id="emp-sec" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--color-primary);">
          </div>

          <button type="submit" class="btn btn-primary" style="background: var(--color-primary); border-color: var(--color-primary); width: 100%; font-weight: 700; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px;">
            <i data-lucide="plus-circle" style="width: 18px; height: 18px;"></i>
            Guardar y Registrar Liquidación
          </button>
        </form>
      </div>
    </div>

    <!-- Resultados Dinámicos del Cálculo -->
    <div class="card" style="background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(22, 163, 74, 0.03) 100%); backdrop-filter: blur(10px);">
      <div class="card-header" style="border-bottom: 1px solid rgba(15, 23, 42, 0.08); padding-bottom: 12px;">
        <h3 style="font-weight: 800; font-size: 16px; display: flex; align-items: center; gap: 8px; color: var(--text-primary); margin: 0;">
          <i data-lucide="receipt" style="color: var(--color-primary); width: 20px; height: 20px;"></i>
          Simulación en Tiempo Real
        </h3>
      </div>
      <div class="card-body" style="padding-top: 16px; display: flex; flex-direction: column; gap: 16px;">
        
        <!-- Totales Destacados -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="background: #ffffff; border: 1px solid rgba(15, 23, 42, 0.06); padding: 12px; border-radius: 8px; border-left: 4px solid var(--text-secondary);">
            <div style="font-size: 11px; color: var(--text-secondary); font-weight: 700; text-transform: uppercase;">Sueldo Bruto</div>
            <div id="sim-bruto" style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin-top: 4px;">$0,00</div>
          </div>
          <div style="background: #ffffff; border: 1px solid rgba(22, 163, 74, 0.15); padding: 12px; border-radius: 8px; border-left: 4px solid var(--color-primary);">
            <div style="font-size: 11px; color: var(--color-primary); font-weight: 700; text-transform: uppercase;">Neto a Liquidar</div>
            <div id="sim-neto" style="font-size: 20px; font-weight: 800; color: var(--color-primary); margin-top: 4px;">$0,00</div>
          </div>
        </div>

        <!-- Detalle de Deducciones del Empleado -->
        <div style="background: #ffffff; border: 1px solid rgba(15, 23, 42, 0.06); border-radius: 8px; padding: 12px;">
          <div style="font-size: 12px; font-weight: 800; color: var(--text-primary); border-bottom: 1px solid rgba(15, 23, 42, 0.06); padding-bottom: 8px; margin-bottom: 8px; display: flex; justify-content: space-between;">
            <span>Aportes del Empleado (Deducciones)</span>
            <span id="sim-deduc-total" style="color: #ef4444; font-weight: 700;">-$0,00</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-secondary);">
            <div style="display: flex; justify-content: space-between;">
              <span>Jubilación (11.0%)</span>
              <span id="sim-deduc-jub" style="font-weight: 600;">$0,00</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Ley 19032 PAMI (3.0%)</span>
              <span id="sim-deduc-pami" style="font-weight: 600;">$0,00</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Obra Social OSECAC (3.0%)</span>
              <span id="sim-deduc-os" style="font-weight: 600;">$0,00</span>
            </div>
            <div id="sim-sec-row" style="display: flex; justify-content: space-between; display: none;">
              <span>Cuota Sindical SEC (2.0%)</span>
              <span id="sim-deduc-sec" style="font-weight: 600;">$0,00</span>
            </div>
          </div>
        </div>

        <!-- Detalle de Contribuciones Patronales -->
        <div style="background: rgba(15, 23, 42, 0.01); border: 1px dashed rgba(15, 23, 42, 0.12); border-radius: 8px; padding: 12px;">
          <div style="font-size: 11.5px; font-weight: 800; color: var(--text-secondary); border-bottom: 1px solid rgba(15, 23, 42, 0.06); padding-bottom: 6px; margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span>Carga Social Patronal (Información de Costo)</span>
            <span id="sim-patr-total" style="color: var(--text-secondary); font-weight: 700;">+$0,00</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--text-secondary);">
            <div style="display: flex; justify-content: space-between;">
              <span>Jubilación Patronal (10.17%)</span>
              <span id="sim-patr-jub">$0,00</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Obra Social Patronal (6.00%)</span>
              <span id="sim-patr-os">$0,00</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Ley 19032 / Asignaciones / Empleo (7.00%)</span>
              <span id="sim-patr-otros">$0,00</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- Historial de Liquidaciones -->
  <div class="card" style="margin-bottom: 32px;">
    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(15, 23, 42, 0.08); padding: 16px 20px;">
      <h3 style="font-weight: 800; font-size: 16px; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px;">
        <i data-lucide="table" style="color: var(--color-primary); width: 20px; height: 20px;"></i>
        Historial de Liquidaciones del Período
      </h3>
      <button class="btn btn-outline" id="btn-export-arca" style="border-color: var(--color-primary); color: var(--color-primary); font-weight: 700; padding: 8px 16px; border-radius: 6px; display: flex; align-items: center; gap: 8px;">
        <i data-lucide="download" style="width: 16px; height: 16px;"></i> Exportar Libro ARCA (.txt)
      </button>
    </div>
    <div class="card-body p-0">
      <div class="table-responsive">
        <table class="table" style="width: 100%;">
          <thead>
            <tr>
              <th style="padding: 12px 20px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700;">Empleado</th>
              <th style="padding: 12px 20px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700;">CUIL</th>
              <th style="padding: 12px 20px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; text-align: center;">Periodo</th>
              <th style="padding: 12px 20px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; text-align: right;">Sueldo Bruto</th>
              <th style="padding: 12px 20px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; text-align: right;">Deducciones</th>
              <th style="padding: 12px 20px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; text-align: right;">Sueldo Neto</th>
              <th style="padding: 12px 20px; font-size: 11px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; text-align: center; width: 80px;">Acción</th>
            </tr>
          </thead>
          <tbody id="liquidaciones-list">
            <!-- Cargado dinámicamente -->
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;

  // Renderizar a través de renderPremiumTeaser para venta cruzada / administración segura
  return renderPremiumTeaser(
    mainHTML,
    "Módulo Libro de Sueldos Digital ARCA",
    "Automatizá la liquidación de haberes mensuales, generá las deducciones obligatorias de ley de forma interactiva y exportá el archivo de texto estructurado de ancho fijo compatible con el importador oficial de Libro de Sueldos de AFIP/ARCA."
  );
}

export function initSueldos(mainApp) {
  const isUnlocked = localStorage.getItem('vmp_premium_unlocked') === 'true';
  if (!isUnlocked) return;

  if (window.lucide) window.lucide.createIcons();

  const activeCo = getActiveCompany();
  const form = document.getElementById('sueldo-calc-form');
  const inputBruto = document.getElementById('emp-bruto');
  const inputSec = document.getElementById('emp-sec');
  const inputPeriod = document.getElementById('emp-period');
  const inputCuil = document.getElementById('emp-cuil');
  const inputName = document.getElementById('emp-name');

  // Elementos de simulación en tiempo real
  const simBruto = document.getElementById('sim-bruto');
  const simNeto = document.getElementById('sim-neto');
  const simDeducTotal = document.getElementById('sim-deduc-total');
  const simDeducJub = document.getElementById('sim-deduc-jub');
  const simDeducPami = document.getElementById('sim-deduc-pami');
  const simDeducOs = document.getElementById('sim-deduc-os');
  const simSecRow = document.getElementById('sim-sec-row');
  const simDeducSec = document.getElementById('sim-deduc-sec');
  const simPatrTotal = document.getElementById('sim-patr-total');
  const simPatrJub = document.getElementById('sim-patr-jub');
  const simPatrOs = document.getElementById('sim-patr-os');
  const simPatrOtros = document.getElementById('sim-patr-otros');

  // Poner el mes actual por defecto en el selector
  if (inputPeriod) {
    const d = new Date();
    const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    inputPeriod.value = currentMonth;
  }

  // Función para realizar cálculos impositivos de liquidación
  const calculateLiquidacion = (brutoVal, isSec) => {
    const jub = brutoVal * 0.11;
    const pami = brutoVal * 0.03;
    const os = brutoVal * 0.03;
    const sec = isSec ? brutoVal * 0.02 : 0;
    const totalDeduc = jub + pami + os + sec;
    const neto = brutoVal - totalDeduc;

    // Contribuciones patronales
    const pJub = brutoVal * 0.1017;
    const pOs = brutoVal * 0.06;
    const pOtros = brutoVal * 0.07;
    const totalPatr = pJub + pOs + pOtros;

    return {
      bruto: brutoVal,
      jub,
      pami,
      os,
      sec,
      totalDeduc,
      neto,
      pJub,
      pOs,
      pOtros,
      totalPatr
    };
  };

  // Escuchar inputs para simulación en vivo
  const updateSimulation = () => {
    const brutoVal = parseFloat(inputBruto?.value) || 0;
    const isSec = inputSec?.checked || false;

    if (brutoVal <= 0) {
      if (simBruto) simBruto.innerText = `$0,00`;
      if (simNeto) simNeto.innerText = `$0,00`;
      if (simDeducTotal) simDeducTotal.innerText = `-$0,00`;
      if (simDeducJub) simDeducJub.innerText = `$0,00`;
      if (simDeducPami) simDeducPami.innerText = `$0,00`;
      if (simDeducOs) simDeducOs.innerText = `$0,00`;
      if (simSecRow) simSecRow.style.display = 'none';
      if (simPatrTotal) simPatrTotal.innerText = `+$0,00`;
      if (simPatrJub) simPatrJub.innerText = `$0,00`;
      if (simPatrOs) simPatrOs.innerText = `$0,00`;
      if (simPatrOtros) simPatrOtros.innerText = `$0,00`;
      return;
    }

    const res = calculateLiquidacion(brutoVal, isSec);

    if (simBruto) simBruto.innerText = `$${fmt(res.bruto)}`;
    if (simNeto) simNeto.innerText = `$${fmt(res.neto)}`;
    if (simDeducTotal) simDeducTotal.innerText = `-$${fmt(res.totalDeduc)}`;
    if (simDeducJub) simDeducJub.innerText = `$${fmt(res.jub)}`;
    if (simDeducPami) simDeducPami.innerText = `$${fmt(res.pami)}`;
    if (simDeducOs) simDeducOs.innerText = `$${fmt(res.os)}`;

    if (simSecRow) {
      if (isSec) {
        simSecRow.style.display = 'flex';
        if (simDeducSec) simDeducSec.innerText = `$${fmt(res.sec)}`;
      } else {
        simSecRow.style.display = 'none';
      }
    }

    if (simPatrTotal) simPatrTotal.innerText = `+$${fmt(res.totalPatr)}`;
    if (simPatrJub) simPatrJub.innerText = `$${fmt(res.pJub)}`;
    if (simPatrOs) simPatrOs.innerText = `$${fmt(res.pOs)}`;
    if (simPatrOtros) simPatrOtros.innerText = `$${fmt(res.pOtros)}`;
  };

  inputBruto?.addEventListener('input', updateSimulation);
  inputSec?.addEventListener('change', updateSimulation);

  // Renderizar la tabla de liquidaciones del histórico
  const renderLiquidacionesTable = () => {
    const listContainer = document.getElementById('liquidaciones-list');
    if (!listContainer) return;

    let liqs = [];
    try {
      liqs = JSON.parse(localStorage.getItem('vmp_sueldos_liquidaciones')) || [];
    } catch (e) {
      liqs = [];
    }

    // Filtrar por la empresa activa
    const filtered = liqs.filter(l => l.company_id === activeCo.id);

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 32px; text-align: center; color: var(--text-secondary);">
            <i data-lucide="inbox" style="width: 32px; height: 32px; color: #cbd5e1; margin-bottom: 8px; display: block; margin-left: auto; margin-right: auto;"></i>
            No hay liquidaciones registradas en este período para la empresa activa.
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    listContainer.innerHTML = filtered.map(l => `
      <tr style="border-bottom: 1px solid rgba(15, 23, 42, 0.04);">
        <td style="padding: 12px 20px; font-weight: 700; color: var(--text-primary); font-size: 13px;">${l.name}</td>
        <td style="padding: 12px 20px; font-family: monospace; font-size: 12.5px; color: var(--text-secondary);">${l.cuil}</td>
        <td style="padding: 12px 20px; text-align: center; font-size: 12.5px; font-weight: 600; color: var(--text-secondary);">${l.periodo.split('-').reverse().join('/')}</td>
        <td style="padding: 12px 20px; text-align: right; font-weight: 700; color: var(--text-primary); font-size: 13px;">$${fmt(l.bruto)}</td>
        <td style="padding: 12px 20px; text-align: right; font-weight: 600; color: #ef4444; font-size: 13px;">-$${fmt(l.totalDeduc)}</td>
        <td style="padding: 12px 20px; text-align: right; font-weight: 800; color: var(--color-primary); font-size: 13px;">$${fmt(l.neto)}</td>
        <td style="padding: 12px 20px; text-align: center;">
          <button class="btn-icon-sm btn-delete-liq" data-id="${l.id}" title="Eliminar registro" style="background: rgba(239, 68, 68, 0.05); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.15); width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();

    // Agregar manejadores de eliminación
    document.querySelectorAll('.btn-delete-liq').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        deleteLiquidacion(id);
      });
    });
  };

  const deleteLiquidacion = (id) => {
    if (!confirm("¿Está seguro de que desea eliminar este registro de liquidación?")) return;
    
    let liqs = [];
    try {
      liqs = JSON.parse(localStorage.getItem('vmp_sueldos_liquidaciones')) || [];
    } catch (e) {
      liqs = [];
    }

    const filtered = liqs.filter(l => l.id !== id);
    localStorage.setItem('vmp_sueldos_liquidaciones', JSON.stringify(filtered));
    mainApp.showToast("Liquidación eliminada correctamente.", "success");
    renderLiquidacionesTable();
  };

  // Enviar formulario para registrar nueva liquidación
  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = inputName?.value.trim() || '';
    const cuil = inputCuil?.value.trim() || '';
    const bruto = parseFloat(inputBruto?.value) || 0;
    const period = inputPeriod?.value || '';
    const isSec = inputSec?.checked || false;

    if (bruto <= 0) {
      mainApp.showToast("El sueldo bruto debe ser mayor a cero.", "error");
      return;
    }

    // Validar formato básico de CUIL (XX-XXXXXXXX-X o XXXXXXXXXXX)
    const cuilClean = cuil.replace(/-/g, '');
    if (cuilClean.length !== 11 || isNaN(cuilClean)) {
      mainApp.showToast("Por favor, ingrese un CUIL válido de 11 dígitos.", "error");
      return;
    }

    const res = calculateLiquidacion(bruto, isSec);
    
    const newLiq = {
      id: "liq-" + Date.now(),
      company_id: activeCo.id,
      name,
      cuil,
      periodo: period,
      bruto: res.bruto,
      jub: res.jub,
      pami: res.pami,
      os: res.os,
      sec: res.sec,
      totalDeduc: res.totalDeduc,
      neto: res.neto
    };

    let liqs = [];
    try {
      liqs = JSON.parse(localStorage.getItem('vmp_sueldos_liquidaciones')) || [];
    } catch (err) {
      liqs = [];
    }

    liqs.unshift(newLiq);
    localStorage.setItem('vmp_sueldos_liquidaciones', JSON.stringify(liqs));

    mainApp.showToast(`Liquidación de ${name} guardada correctamente.`, "success");
    
    // Resetear formulario y simulación
    form.reset();
    if (inputPeriod) {
      const d = new Date();
      inputPeriod.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    updateSimulation();
    renderLiquidacionesTable();
  });

  // Exportar en formato de ancho fijo ARCA / AFIP
  const btnExport = document.getElementById('btn-export-arca');
  btnExport?.addEventListener('click', () => {
    let liqs = [];
    try {
      liqs = JSON.parse(localStorage.getItem('vmp_sueldos_liquidaciones')) || [];
    } catch (e) {
      liqs = [];
    }

    const filtered = liqs.filter(l => l.company_id === activeCo.id);

    if (filtered.length === 0) {
      mainApp.showToast("No hay registros cargados para exportar en esta empresa.", "error");
      return;
    }

    // Layout Oficial de AFIP / Libro de Sueldos Digital (Fixed Width 150)
    // -------------------------------------------------------------
    // Campos:
    // 1. CUIL (11)
    // 2. Periodo (6) - Formato YYYYMM
    // 3. Sueldo Bruto (15) - Decimales implícitos, sin comas. Ej. 150000.50 -> 000000015000050
    // 4. Jubilacion (15)
    // 5. Ley 19032 (15)
    // 6. Obra Social (15)
    // 7. SEC Sindicato (15)
    // 8. Sueldo Neto (15)
    // 9. Nombre Empleado (43)
    // Total: 150 caracteres.
    // -------------------------------------------------------------
    let txtContent = "";
    
    filtered.forEach(l => {
      const cuilField = l.cuil.replace(/-/g, '').padEnd(11, ' ');
      const periodField = l.periodo.replace('-', '').padEnd(6, ' ');
      
      const formatAmount = (val) => {
        const cents = Math.round(val * 100);
        return String(cents).padStart(15, '0');
      };
      
      const brutoField = formatAmount(l.bruto);
      const jubField = formatAmount(l.jub);
      const pamiField = formatAmount(l.pami);
      const osField = formatAmount(l.os);
      const secField = formatAmount(l.sec);
      const netoField = formatAmount(l.neto);
      
      // Remover caracteres especiales del nombre
      const cleanName = l.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 43);
      const nameField = cleanName.padEnd(43, ' ');
      
      const line = `${cuilField}${periodField}${brutoField}${jubField}${pamiField}${osField}${secField}${netoField}${nameField}`;
      txtContent += line + "\r\n";
    });

    const safeFilename = `libro_sueldos_arca_${activeCo.razon_social.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.txt`;
    downloadFile(safeFilename, txtContent, 'text/plain');
    mainApp.showToast(`Libro de Sueldos Digital exportado exitosamente como "${safeFilename}".`, "success");
  });

  // Inicializar tabla al entrar
  renderLiquidacionesTable();
}
