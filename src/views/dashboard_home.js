/* -------------------------------------------------------------
   VMP Studio Contable - Dashboard Home View (Charts & KPI)
   ------------------------------------------------------------- */
import { getActiveCompany, getTransactions, getCompanies } from '../db/mockdb.js';

export function renderDashboardHome() {
  const activeCompany = getActiveCompany();
  const txs = getTransactions(activeCompany.id);
  const activePeriod = localStorage.getItem('vmp_active_period') || '2026-05';
  const companies = getCompanies();

  // Helper dynamic dates generator by CUIT & Condition
  const getVencimientoDates = (cuit, cond) => {
    const clean = cuit.replace(/-/g, '').trim();
    const lastChar = clean.slice(-1);
    const lastDigit = isNaN(lastChar) ? 0 : parseInt(lastChar);
    
    // IVA
    let ivaDate = '—';
    if (!cond.toLowerCase().includes('monotributo')) {
      if (lastDigit === 0 || lastDigit === 1) ivaDate = '18/06/2026';
      else if (lastDigit === 2 || lastDigit === 3) ivaDate = '19/06/2026';
      else if (lastDigit === 4 || lastDigit === 5) ivaDate = '20/06/2026';
      else if (lastDigit === 6 || lastDigit === 7) ivaDate = '21/06/2026';
      else ivaDate = '22/06/2026';
    }

    // SUSS F.931
    let sussDate = '—';
    if (!cond.toLowerCase().includes('monotributo')) {
      if (lastDigit >= 0 && lastDigit <= 3) sussDate = '09/06/2026';
      else if (lastDigit >= 4 && lastDigit <= 6) sussDate = '10/06/2026';
      else sussDate = '11/06/2026';
    }

    // Monotributo / Autónomos
    let monoDate = '—';
    if (cond.toLowerCase().includes('monotributo')) {
      monoDate = '20/06/2026';
    } else {
      if (lastDigit === 0 || lastDigit === 1) monoDate = '05/06/2026';
      else if (lastDigit === 2 || lastDigit === 3) monoDate = '05/06/2026';
      else if (lastDigit === 4 || lastDigit === 5) monoDate = '06/06/2026';
      else if (lastDigit === 6 || lastDigit === 7) monoDate = '06/06/2026';
      else monoDate = '07/06/2026';
    }

    return { ivaDate, sussDate, monoDate };
  };

  const getTaxStatus = (coId, taxName) => {
    return localStorage.getItem(`vmp_venc_status_${coId}_${taxName}`) || 'Pendiente';
  };

  const getStatusClass = (status) => {
    if (status === 'Presentado') return 'active'; // green
    if (status === 'Pendiente') return 'pending'; // amber
    if (status === 'Vencido') return 'inactive'; // red
    return 'inactive';
  };

  const periodNames = {
    '2026-05': 'Mayo 2026',
    '2026-04': 'Abril 2026',
    '2026-03': 'Marzo 2026',
    '2026-02': 'Febrero 2026',
    '2026-01': 'Enero 2026',
    '2025-12': 'Diciembre 2025'
  };

  // Filtrar transacciones por período fiscal activo
  const filteredVentas = txs.ventas.filter(v => v.fecha.startsWith(activePeriod));
  const filteredCompras = txs.compras.filter(c => c.fecha.startsWith(activePeriod));

  // Calcular KPIs
  const totalNetSales = filteredVentas.reduce((sum, v) => sum + v.neto, 0);
  const totalIvaSales = filteredVentas.reduce((sum, v) => sum + v.iva, 0);
  const totalSales = filteredVentas.reduce((sum, v) => sum + v.total, 0);

  const totalNetPurchases = filteredCompras.reduce((sum, c) => sum + c.neto, 0);
  const totalIvaPurchases = filteredCompras.reduce((sum, c) => sum + c.iva, 0);
  const totalPurchases = filteredCompras.reduce((sum, c) => sum + c.total, 0);

  const profit = totalSales - totalPurchases;
  
  // Impuesto estimado (Diferencia de IVA Débito - Crédito)
  const ivaDiferencia = totalIvaSales - totalIvaPurchases;

  // Combinar y ordenar transacciones recientes del período
  const allTxs = [
    ...filteredVentas.map(v => ({ ...v, tipo: 'Venta', sign: '+', colorClass: 'text-emerald' })),
    ...filteredCompras.map(c => ({ ...c, tipo: 'Compra', sign: '-', colorClass: 'text-red' }))
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);

  const isMonotributo = activeCompany.condicion_iva.includes('Monotributo');
  // Para demostración, si es Monotributista acumulado anual
  const accumMonotributoSales = activeCompany.id === 'co-2' ? 29800000 + totalSales : totalSales;
  const maxCategoryLimit = 35000000; // Cat H límite legal
  const consumptionPercent = Math.round((accumMonotributoSales / maxCategoryLimit) * 100);

  // Generar alertas del Centro de Control Preventivo (AI Guard) [Pilar 4]
  let aiGuardHTML = '';
  if (activeCompany.id === 'co-1') {
    aiGuardHTML = `
      <div style="background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #92400e; display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%;">
        <div style="display:flex; align-items:center; gap:8px;">
          <i data-lucide="alert-triangle" style="width:16px; height:16px; flex-shrink:0;"></i>
          <span><strong>Diferencia SIRCREB (Bancos):</strong> Detectamos 2 percepciones bancarias en el extracto no conciliadas con el Libro Diario.</span>
        </div>
        <a href="#/studio/retenciones?filter=sircreb" class="btn btn-outline btn-sm" style="font-size:10.5px; padding: 3px 10px; border-color: rgba(245,158,11,0.3); color: #d97706; background:#fff; text-decoration:none;">Conciliar</a>
      </div>
    `;
  } else if (activeCompany.id === 'co-2') {
    aiGuardHTML = `
      <div style="background: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #991b1b; display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%;">
        <div style="display:flex; align-items:center; gap:8px;">
          <i data-lucide="alert-octagon" style="width:16px; height:16px; flex-shrink:0;"></i>
          <span><strong>Límite Monotributo Cat H:</strong> Facturación del período actual consume el 85% de la banda de exclusión legal.</span>
        </div>
        <a href="#/studio/iva-simple" class="btn btn-outline btn-sm" style="font-size:10.5px; padding: 3px 10px; border-color: rgba(239,68,68,0.3); color: #dc2626; background:#fff; text-decoration:none;">Planificar Exclusión</a>
      </div>
    `;
  } else if (activeCompany.id === 'co-3') {
    aiGuardHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        <div style="background: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #991b1b; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <i data-lucide="alert-octagon" style="width:16px; height:16px; flex-shrink:0;"></i>
            <span><strong>Alerta Proveedor Apócrifo:</strong> Se detectaron facturas de compras del proveedor 'Sinergia SRL' listado como apócrifo por ARCA.</span>
          </div>
          <a href="#/studio/iva" class="btn btn-outline btn-sm" style="font-size:10.5px; padding: 3px 10px; border-color: rgba(239,68,68,0.3); color: #dc2626; background:#fff; text-decoration:none;">Auditar LID</a>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #92400e; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <i data-lucide="alert-triangle" style="width:16px; height:16px; flex-shrink:0;"></i>
            <span><strong>Inconsistencia Fiscal (F.2051):</strong> Diferencia impositiva de $4.850 entre actividades AFIP y facturación de ventas.</span>
          </div>
          <a href="#/studio/iva" class="btn btn-outline btn-sm" style="font-size:10.5px; padding: 3px 10px; border-color: rgba(245,158,11,0.3); color: #d97706; background:#fff; text-decoration:none;">Validar</a>
        </div>
      </div>
    `;
  } else if (activeCompany.id === 'co-catedral') {
    aiGuardHTML = `
      <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-left: 4px solid var(--color-accent-light); padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #065f46; display: flex; align-items: center; gap: 8px; width:100%;">
        <i data-lucide="shield-check" style="width:16px; height:16px; flex-shrink:0;"></i>
        <span><strong>Cumplimiento Fiscal al 100%:</strong> La auditoría de IA no detectó inconsistencias de CUIT, montos ni facturas apócrifas en Catedral Constructora.</span>
      </div>
    `;
  } else {
    aiGuardHTML = `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #64748b; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #334155; display: flex; align-items: center; gap: 8px; width:100%;">
        <i data-lucide="info" style="width:16px; height:16px; flex-shrink:0;"></i>
        <span>Sin anomalías impositivas activas para auditar en este cliente.</span>
      </div>
    `;
  }

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Dashboard General</h1>
      <p class="view-subtitle">Resumen contable y fiscal para la empresa activa.</p>
    </div>
    <div style="background: rgba(13, 148, 136, 0.08); border: 1px solid rgba(13, 148, 136, 0.2); padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600;">
      Régimen: <span style="color: var(--color-teal-light)">${activeCompany.condicion_iva}</span>
    </div>
  </div>

  <!-- Consola de Enlace ARCA Live -->
  <div style="background: linear-gradient(135deg, rgba(13, 148, 136, 0.04) 0%, rgba(31, 92, 67, 0.04) 100%); border: 1px solid rgba(13, 148, 136, 0.2); border-radius: var(--radius-md); padding: 18px 24px; margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="background: rgba(13, 148, 136, 0.08); border: 1px solid rgba(13, 148, 136, 0.2); width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--color-accent); flex-shrink: 0;">
          <i data-lucide="activity" style="width: 20px; height: 20px;"></i>
        </div>
        <div>
          <h4 style="font-size: 14.5px; font-weight: 800; color: var(--color-primary); margin: 0 0 3px 0; display: flex; align-items: center; gap: 8px;">
            Consola de Enlace ARCA (ex-AFIP) 
            <span style="background: rgba(47, 122, 89, 0.12); color: var(--color-accent); font-size: 9.5px; font-weight: 800; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(47, 122, 89, 0.2);">LIVE</span>
          </h4>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4;">
            Conectado de forma segura mediante firma digital criptográfica del estudio contable.
          </p>
        </div>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-outline btn-sm" onclick="alert('Estudio Contable Comahue\\n\\nSaaS VMP Studio v3.2.0-prod\\nFirma Activa: estudio_comahue_arca_2026.crt\\nEnlace: Homologado y Encriptado')" style="font-size: 11px; padding: 6px 12px; display: flex; align-items: center; gap: 4px; border-color: rgba(31,92,67,0.25);">
          <i data-lucide="shield-check" style="width: 13px; height: 13px;"></i> Auditoría de Canal
        </button>
      </div>
    </div>

    <!-- Mini KPI status grid -->
    <div class="grid-resp-4" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; border-top: 1px solid rgba(13, 148, 136, 0.1); padding-top: 16px;">
      
      <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 6px;">
        <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">WSAA Autenticación</span>
        <span style="font-size: 12px; font-weight: 750; color: var(--color-accent); display: flex; align-items: center; gap: 6px;">
          <span style="background: var(--color-accent-light); width: 6px; height: 6px; border-radius: 50%; display: inline-block;"></span>
          Token de Acceso Activo
        </span>
      </div>

      <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 6px;">
        <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">Latencia de API</span>
        <span style="font-size: 12px; font-weight: 750; color: var(--color-primary); display: flex; align-items: center; gap: 6px;">
          <i data-lucide="gauge" style="width: 14px; height: 14px; color: var(--text-secondary);"></i>
          42ms (Estable)
        </span>
      </div>

      <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 6px;">
        <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">Certificado SSL</span>
        <span style="font-size: 12px; font-weight: 750; color: var(--color-primary); display: flex; align-items: center; gap: 6px;">
          <i data-lucide="lock" style="width: 14px; height: 14px; color: var(--color-accent-light);"></i>
          TLS 1.3 AES-256
        </span>
      </div>

      <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 6px;">
        <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">Delegación de CUIT</span>
        <span style="font-size: 12px; font-weight: 750; color: var(--color-accent); display: flex; align-items: center; gap: 6px;">
          <i data-lucide="link" style="width: 14px; height: 14px; color: var(--color-accent);"></i>
          Sincronizado
        </span>
      </div>

    </div>
  </div>

  <!-- Centro de Control Preventivo (AI Guard Hub) [NEW PILAR 4] -->
  <div class="card" style="margin-bottom: 28px; border-color: rgba(129, 140, 248, 0.25); background: linear-gradient(135deg, rgba(31, 92, 67, 0.01) 0%, rgba(13, 148, 136, 0.01) 100%);">
    <div class="card-header" style="border-bottom-color: rgba(31, 92, 67, 0.1); display:flex; justify-content:space-between; align-items:center;">
      <h3 style="color:var(--color-accent-light); display:flex; align-items:center; gap:8px;"><i data-lucide="shield-alert"></i> Centro de Control Preventivo (AI Guard)</h3>
      <span class="badge" style="margin: 0; background: rgba(31, 92, 67, 0.08); color: var(--color-accent-light); border-color: rgba(31, 92, 67, 0.2); font-weight:700;">Auditoría Activa 24/7</span>
    </div>
    <div class="card-body" style="display:flex; flex-direction:column; gap:10px; padding: 16px 20px;">
      ${aiGuardHTML}
    </div>
  </div>

  ${isMonotributo ? `
  <!-- Monotributo Exclusion Alert Card -->
  <div class="card" style="margin-bottom: 28px; border-color: ${consumptionPercent >= 80 ? '#fbbf24' : 'var(--border-color)'}; background: #fff;">
    <div class="card-body" style="padding: 20px 24px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
        <div>
          <span class="badge" style="background: rgba(31, 92, 67, 0.05); color: var(--color-accent); border-color: rgba(31, 92, 67, 0.15); font-weight: 700; margin: 0; padding: 4px 10px; font-size: 10.5px;">MONOTRIBUTO SAFE-GUARD</span>
          <h3 style="font-size: 15px; font-weight: 750; color: var(--color-primary); margin-top: 8px; margin-bottom: 4px;">Alerta de Control de Categoría H (Servicios)</h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 0;">Límite anual acumulado antes de la exclusión automática de oficio de ARCA.</p>
        </div>
        <div style="text-align: right;">
          <span class="font-mono" style="font-size: 17px; font-weight: 800; color: ${consumptionPercent >= 85 ? '#dc2626' : '#d97706'}">${consumptionPercent}% Consumido</span>
          <span style="font-size: 11px; color: var(--text-muted); display: block; margin-top: 2px;">Límite: $ ${maxCategoryLimit.toLocaleString('es-AR')}</span>
        </div>
      </div>

      <!-- Progress Bar -->
      <div style="background: var(--border-color); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
        <div style="width: ${consumptionPercent}%; height: 100%; background: ${consumptionPercent >= 85 ? '#dc2626' : '#fbbf24'}; border-radius: 4px; transition: width 0.4s ease;"></div>
      </div>

      <div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: ${consumptionPercent >= 85 ? '#fef2f2' : '#fffbeb'}; border: 1px solid ${consumptionPercent >= 85 ? '#fee2e2' : '#fef3c7'}; border-radius: 4px; font-size: 12px; color: ${consumptionPercent >= 85 ? '#991b1b' : '#92400e'};">
        <i data-lucide="alert-triangle" style="width: 16px; height: 16px; flex-shrink: 0; display: inline-block; vertical-align: middle;"></i>
        <span>
          <strong>Riesgo Contable de Exclusión:</strong> El cliente ha facturado acumulado <strong>$ ${accumMonotributoSales.toLocaleString('es-AR')}</strong> en los últimos 12 meses. Se sugiere fuertemente iniciar la planificación preventiva del pase al Régimen General (IVA/Ganancias) para evitar reclamos retroactivos.
        </span>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- Interactive Studio Modules Guide -->
  <div class="card production-modules-card" style="margin-bottom: 28px; background: linear-gradient(135deg, rgba(31, 92, 67, 0.01) 0%, rgba(31, 92, 67, 0.01) 100%); border-color: rgba(31, 92, 67, 0.12);">
    <div class="card-body" style="padding: 20px 24px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span class="badge" style="background: rgba(31, 92, 67, 0.08); color: var(--color-accent); border-color: rgba(31, 92, 67, 0.2); font-weight: 700; margin: 0; padding: 4px 10px; font-size: 11px;">MÓDULOS DE PRODUCCIÓN STUDIO</span>
          <h4 style="font-size: 13px; color: var(--text-secondary); font-weight: 600; margin: 0;">Acceso directo a las herramientas fiscales de tu Suite Profesional</h4>
        </div>
        <a href="#/studio/ayuda" class="btn btn-primary btn-sm" style="font-size: 11px; padding: 6px 12px; background: var(--color-accent); border-color: var(--color-accent); display: flex; align-items: center; gap: 4px; box-shadow: var(--shadow-sm); text-decoration: none; color: white;">
          <i data-lucide="book-open" style="width: 12px; height: 12px;"></i> Guía de Onboarding Completa
        </a>
      </div>
      <div class="trial-actions-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
        
        <a href="#/studio/ventas" class="trial-action-btn">
          <div class="ta-btn-icon" style="background: rgba(31, 92, 67, 0.08); color: var(--color-accent);">
            <i data-lucide="file-text"></i>
          </div>
          <div class="ta-btn-content">
            <h5>1. Libro de Comprobantes</h5>
            <p>Carga y conciliación de facturas</p>
          </div>
          <div class="ta-btn-arrow"><i data-lucide="chevron-right"></i></div>
        </a>

        <a href="#/studio/iva" class="trial-action-btn">
          <div class="ta-btn-icon" style="background: rgba(245, 158, 11, 0.08); color: #f59e0b;">
            <i data-lucide="book-open"></i>
          </div>
          <div class="ta-btn-content">
            <h5>2. Libro IVA Digital</h5>
            <p>Auditoría e informes de DDJJ</p>
          </div>
          <div class="ta-btn-arrow"><i data-lucide="chevron-right"></i></div>
        </a>

        <a href="#/studio/configuracion" class="trial-action-btn">
          <div class="ta-btn-icon" style="background: rgba(47, 122, 89, 0.08); color: var(--color-accent-light);">
            <i data-lucide="link"></i>
          </div>
          <div class="ta-btn-content">
            <h5>3. Enlace ARCA</h5>
            <p>Certificados y CUITs delegados</p>
          </div>
          <div class="ta-btn-arrow"><i data-lucide="chevron-right"></i></div>
        </a>

        <a href="#/studio/ayuda" class="trial-action-btn">
          <div class="ta-btn-icon" style="background: rgba(14, 165, 233, 0.08); color: #0ea5e9;">
            <i data-lucide="help-circle"></i>
          </div>
          <div class="ta-btn-content">
            <h5>4. Guías & Onboarding</h5>
            <p>Documentación técnica completa</p>
          </div>
          <div class="ta-btn-arrow"><i data-lucide="chevron-right"></i></div>
        </a>

      </div>
    </div>
  </div>

  <!-- KPI Grid -->
  <div class="kpi-grid">
    <div class="kpi-card sales">
      <div class="kpi-header">
        <span>VENTAS TOTALES (NETO)</span>
        <div class="kpi-icon"><i data-lucide="trending-up"></i></div>
      </div>
      <div class="kpi-val">$ ${totalNetSales.toLocaleString('es-AR')}</div>
      <div class="kpi-trend up">
        <i data-lucide="arrow-up-right"></i> +14.2% <span style="color: var(--text-muted)">este mes</span>
      </div>
    </div>

    <div class="kpi-card purchases">
      <div class="kpi-header">
        <span>COMPRAS TOTALES (NETO)</span>
        <div class="kpi-icon"><i data-lucide="shopping-bag"></i></div>
      </div>
      <div class="kpi-val">$ ${totalNetPurchases.toLocaleString('es-AR')}</div>
      <div class="kpi-trend down">
        <i data-lucide="arrow-down-right"></i> -3.8% <span style="color: var(--text-muted)">este mes</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-header">
        <span>RESULTADO NETO</span>
        <div class="kpi-icon"><i data-lucide="wallet"></i></div>
      </div>
      <div class="kpi-val" style="color: ${profit >= 0 ? 'var(--color-emerald-light)' : '#f87171'}">
        $ ${profit.toLocaleString('es-AR')}
      </div>
      <div class="kpi-trend neutral">
        <i data-lucide="minus"></i> Saldo Operativo
      </div>
    </div>

    <div class="kpi-card tax">
      <div class="kpi-header">
        <span>SALDO TÉCNICO IVA</span>
        <div class="kpi-icon"><i data-lucide="file-check"></i></div>
      </div>
      <div class="kpi-val" style="color: ${ivaDiferencia >= 0 ? '#fbbf24' : 'var(--color-teal-light)'}">
        $ ${Math.abs(ivaDiferencia).toLocaleString('es-AR')}
      </div>
      <div class="kpi-trend ${ivaDiferencia >= 0 ? 'up' : 'down'}" style="color: ${ivaDiferencia >= 0 ? '#fbbf24' : 'var(--color-emerald-light)'}">
        <i data-lucide="${ivaDiferencia >= 0 ? 'arrow-up-right' : 'arrow-down-right'}"></i>
        ${ivaDiferencia >= 0 ? 'A Pagar (Saldo a Favor Fisco)' : 'Saldo Técnico a Favor'}
      </div>
    </div>
  </div>

  <!-- Analytics Grid -->
  <div class="analytics-grid">
    <div class="card">
      <div class="card-header">
        <h3><i data-lucide="bar-chart-3"></i> Evolución de Ventas vs Compras</h3>
        <span class="badge" style="margin: 0; font-size: 11px;">${periodNames[activePeriod]}</span>
      </div>
      <div class="card-body" style="height: 320px; display: flex; align-items: center; justify-content: center; position: relative;">
        <canvas id="dashboard-main-chart" style="max-height: 100%; max-width: 100%;"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3><i data-lucide="clock"></i> Actividad Reciente</h3>
        <a href="#/studio/ventas" class="btn btn-outline" style="padding: 6px 12px; font-size: 12px; border-radius: var(--radius-sm);">Ver Todo</a>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Cliente/Prov.</th>
                <th class="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${allTxs.length === 0 ? `
                <tr>
                  <td colspan="4" class="text-center text-muted" style="padding: 24px;">No hay movimientos recientes en esta empresa.</td>
                </tr>
              ` : allTxs.map(tx => `
                <tr>
                  <td class="font-mono text-sm">${tx.fecha.split('-').reverse().join('/')}</td>
                  <td>
                    <span class="badge-status ${tx.tipo === 'Venta' ? 'active' : 'pending'}" style="font-size: 11px; padding: 2px 8px;">
                      ${tx.tipo}
                    </span>
                  </td>
                  <td style="font-weight: 500; font-size: 13px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${tx.cliente || tx.proveedor}
                  </td>
                  <td class="font-mono text-right ${tx.colorClass}" style="font-weight: 600;">
                    ${tx.sign} $ ${tx.total.toLocaleString('es-AR')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- ── CONSOLA DE VENCIMIENTOS MULTI-CLIENTE INTERCONECTADA (NEW MODULE) ── -->
  <div class="card" style="margin-top: 28px; border-color: rgba(31, 92, 67, 0.25);">
    <div class="card-header" style="border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
      <h3><i data-lucide="calendar" style="color: var(--color-accent);"></i> Agenda de Vencimientos Impositivos Multi-Cliente</h3>
      <span class="badge" style="margin: 0; background: rgba(31, 92, 67, 0.08); color: var(--color-accent-light); border-color: rgba(31, 92, 67, 0.25);">Control de Plazos CUIT</span>
    </div>
    <div class="card-body">
      <p class="text-secondary" style="font-size: 13px; margin-bottom: 16px;">
        Esta agenda inteligente calcula matemáticamente los plazos de vencimiento del período para cada cliente registrado, basándose en la **resolución de último dígito de CUIT impositivo de la ARCA**. Hacé clic sobre el estado para conmutar su presentación.
      </p>

      <div class="table-responsive">
        <table class="table table-sm" style="font-size: 12px;">
          <thead>
            <tr>
              <th>Razón Social / Cliente</th>
              <th>CUIT / Condición</th>
              <th class="text-center">Vto Libro IVA Digital</th>
              <th class="text-center">Vto SUSS Cargas F.931</th>
              <th class="text-center">Vto Monotributo / Autónomos</th>
            </tr>
          </thead>
          <tbody>
            ${companies.map(co => {
              const { ivaDate, sussDate, monoDate } = getVencimientoDates(co.cuit, co.condicion_iva);
              
              const ivaStatus = getTaxStatus(co.id, 'iva');
              const sussStatus = getTaxStatus(co.id, 'suss');
              const monoStatus = getTaxStatus(co.id, 'mono');
              
              return `
                <tr>
                  <td style="font-weight: 700; color: var(--color-primary);">${co.razon_social}</td>
                  <td>
                    <span class="font-mono" style="font-size: 11px; color: var(--text-secondary);">${co.cuit}</span><br>
                    <span style="font-size: 9.5px; font-weight:600; color: var(--text-muted);">${co.condicion_iva}</span>
                  </td>
                  
                  <!-- IVA Column -->
                  <td class="text-center">
                    ${ivaDate !== '—' ? `
                      <div class="font-mono" style="margin-bottom: 4px; font-weight:600;">${ivaDate}</div>
                      <span class="badge-status ${getStatusClass(ivaStatus)} btn-toggle-venc" data-co="${co.id}" data-tax="iva" style="font-size: 9.5px; padding: 2px 8px; cursor: pointer; user-select: none;">
                        ${ivaStatus}
                      </span>
                    ` : `
                      <span class="badge-status" style="font-size: 9.5px; padding: 2px 8px; background: rgba(255,255,255,0.02); border-color: var(--border-color); color: var(--text-muted);">
                        N/A
                      </span>
                    `}
                  </td>

                  <!-- SUSS Column -->
                  <td class="text-center">
                    ${sussDate !== '—' ? `
                      <div class="font-mono" style="margin-bottom: 4px; font-weight:600;">${sussDate}</div>
                      <span class="badge-status ${getStatusClass(sussStatus)} btn-toggle-venc" data-co="${co.id}" data-tax="suss" style="font-size: 9.5px; padding: 2px 8px; cursor: pointer; user-select: none;">
                        ${sussStatus}
                      </span>
                    ` : `
                      <span class="badge-status" style="font-size: 9.5px; padding: 2px 8px; background: rgba(255,255,255,0.02); border-color: var(--border-color); color: var(--text-muted);">
                        N/A
                      </span>
                    `}
                  </td>

                  <!-- Monotributo / Autónomos Column -->
                  <td class="text-center">
                    ${monoDate !== '—' ? `
                      <div class="font-mono" style="margin-bottom: 4px; font-weight:600;">${monoDate}</div>
                      <span class="badge-status ${getStatusClass(monoStatus)} btn-toggle-venc" data-co="${co.id}" data-tax="mono" style="font-size: 9.5px; padding: 2px 8px; cursor: pointer; user-select: none;">
                        ${monoStatus}
                      </span>
                    ` : `
                      <span class="badge-status" style="font-size: 9.5px; padding: 2px 8px; background: rgba(255,255,255,0.02); border-color: var(--border-color); color: var(--text-muted);">
                        N/A
                      </span>
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
  `;
}

export function initDashboardHome(mainApp) {
  // Inicializar Lucide Icons
  if (window.lucide) window.lucide.createIcons();

  // Inicializar Gráficos dinámicos con Chart.js
  const canvas = document.getElementById('dashboard-main-chart');
  if (!canvas) return;

  const activeCompany = getActiveCompany();
  const txs = getTransactions(activeCompany.id);

  // Agrupar Ventas y Compras de los últimos meses o por días
  // Como demo estática pero reactiva, mapeamos días ficticios de Mayo
  const dates = ["05 May", "10 May", "15 May", "20 May", "25 May"];
  
  // Distribuir el total neto aproximado para hacerlo ver realista
  const totalSales = txs.ventas.reduce((sum, v) => sum + v.neto, 0);
  const totalPurchases = txs.compras.reduce((sum, c) => sum + c.neto, 0);

  const salesData = [totalSales * 0.1, totalSales * 0.2, totalSales * 0.35, totalSales * 0.2, totalSales * 0.15];
  const purchasesData = [totalPurchases * 0.15, totalPurchases * 0.3, totalPurchases * 0.25, totalPurchases * 0.1, totalPurchases * 0.2];

  // Si Chart está cargado de forma global en window.Chart
  if (window.Chart) {
    // Destruir gráfico previo si existe para evitar superposiciones
    if (mainApp.activeChart) {
      mainApp.activeChart.destroy();
    }

    mainApp.activeChart = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Ventas (Neto)',
            data: salesData,
            backgroundColor: 'var(--color-accent-light)',
            borderRadius: 6,
            borderWidth: 0
          },
          {
            label: 'Compras (Neto)',
            data: purchasesData,
            backgroundColor: 'var(--color-accent)',
            borderRadius: 6,
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#9ca3af',
              font: { family: 'Plus Jakarta Sans', weight: '600' }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#9ca3af',
              font: { family: 'JetBrains Mono' },
              callback: function(value) {
                return '$' + value.toLocaleString('es-AR');
              }
            }
          }
        }
      }
    });
  } else {
    // Fallback si Chart.js no se ha cargado todavía
    console.log("Chart.js no disponible.");
  }

  // -------------------------------------------------------------
  // INTERACTIVE CHECKLIST FOR MULTI-COMPANY TAX DEADLINES (NEW)
  // -------------------------------------------------------------
  document.querySelectorAll('.btn-toggle-venc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const coId = btn.dataset.co;
      const taxName = btn.dataset.tax;

      const current = localStorage.getItem(`vmp_venc_status_${coId}_${taxName}`) || 'Pendiente';
      
      // Cycle: Pendiente -> Presentado -> Vencido -> Pendiente
      let next = 'Presentado';
      if (current === 'Presentado') next = 'Vencido';
      else if (current === 'Vencido') next = 'Pendiente';

      localStorage.setItem(`vmp_venc_status_${coId}_${taxName}`, next);

      // Re-trigger layout router to update views in real time!
      mainApp.showToast(`¡Vencimiento: CUIT cliente actualizado a [${next}]!`, 'success');
      mainApp.router();
    });
  });
}
