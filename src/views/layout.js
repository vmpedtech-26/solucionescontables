/* -------------------------------------------------------------
   VMP Studio Contable - Dashboard Layout Component
   ------------------------------------------------------------- */
import { getCompanies, getActiveCompany, getSyncStatus } from '../db/mockdb.js';

export function renderDashboardLayout(childHTML, activeRoute) {
  const activeCompany = getActiveCompany();
  const companies = getCompanies();
  const isAdminUnlocked = localStorage.getItem('vmp_premium_unlocked') === 'true';

  // Calcular estado inicial de sincronización
  const syncStatus = getSyncStatus();
  let syncPillHTML = '';
  
  if (syncStatus === 'offline') {
    syncPillHTML = `
      <div id="topbar-sync-status-indicator" style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.2); transition: all 0.25s ease;">
        <span class="sync-dot" style="background:#ef4444; box-shadow:0 0 8px #ef4444; width:8px; height:8px; border-radius:50%; display:inline-block;"></span>
        <span style="color:#ef4444;">Sin Conexión</span>
      </div>
    `;
  } else if (syncStatus === 'syncing') {
    syncPillHTML = `
      <div id="topbar-sync-status-indicator" style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.2); transition: all 0.25s ease;">
        <span class="sync-dot" style="border:1.5px solid #fbbf24; border-top:1.5px solid transparent; width:8px; height:8px; border-radius:50%; display:inline-block; animation: spin 0.8s linear infinite;"></span>
        <span style="color:#fbbf24; margin-left: 4px;">Sincronizando...</span>
      </div>
    `;
  } else if (syncStatus === 'error') {
    syncPillHTML = `
      <div id="topbar-sync-status-indicator" style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; background: rgba(220, 38, 38, 0.06); border: 1px solid rgba(220, 38, 38, 0.2); transition: all 0.25s ease;">
        <span class="sync-dot" style="background:#dc2626; box-shadow:0 0 8px #dc2626; width:8px; height:8px; border-radius:50%; display:inline-block;"></span>
        <span style="color:#dc2626;">Error Sync</span>
      </div>
    `;
  } else if (syncStatus === 'pending') {
    syncPillHTML = `
      <div id="topbar-sync-status-indicator" style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; background: rgba(245, 158, 11, 0.04); border: 1px solid rgba(245, 158, 11, 0.15); transition: all 0.25s ease;">
        <span class="sync-dot" style="background:#fbbf24; box-shadow:0 0 8px #fbbf24; width:8px; height:8px; border-radius:50%; display:inline-block;"></span>
        <span style="color:#fbbf24;">Sync Pendiente</span>
      </div>
    `;
  } else {
    syncPillHTML = `
      <div id="topbar-sync-status-indicator" style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; background: rgba(47, 122, 89, 0.06); border: 1px solid rgba(47, 122, 89, 0.2); transition: all 0.25s ease;">
        <span class="sync-dot" style="background:var(--color-accent-light); box-shadow:0 0 8px var(--color-accent-light); width:8px; height:8px; border-radius:50%; display:inline-block;"></span>
        <span style="color:var(--color-accent-light);">Sincronizado</span>
      </div>
    `;
  }

  return `
  <div class="db-wrapper" id="db-wrapper-root">
    <!-- Sidebar -->
    <aside class="db-sidebar">
      <div class="db-sidebar-header">
        <a href="#/studio" class="db-sidebar-logo" style="display: flex; align-items: center; gap: 10px;">
          <img src="/SolucionesContables_Logo.png" alt="SolucionesContables Logo" style="height: 32px; width: 32px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(15, 23, 42, 0.15);" />
          <div class="db-sidebar-logo-text" style="font-size: 13.5px; font-weight: 800; letter-spacing: 0.02em; color: var(--color-primary);">
            SOLUCIONES CONTABLES
          </div>
        </a>
        <button class="btn-icon-sm" id="sidebar-collapse-btn" title="Colapsar menú">
          <i data-lucide="chevrons-left"></i>
        </button>
      </div>

      <div class="db-sidebar-nav">
        <!-- Active Client Scoping Context Card -->
        <div class="sidebar-active-client-card" style="background: rgba(13, 148, 136, 0.04); border: 1px solid rgba(13, 148, 136, 0.15); border-radius: var(--radius-md); padding: 12px; margin: 4px 8px 16px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="background: ${activeCompany.color}; width: 8px; height: 8px; border-radius: 50%;"></div>
            <span style="font-size: 9.5px; font-weight: 700; color: var(--color-teal-light); text-transform: uppercase; letter-spacing: 0.05em;">Cliente Seleccionado</span>
          </div>
          <div>
            <div style="font-size: 13.5px; font-weight: 700; color: var(--color-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px;" title="${activeCompany.razon_social}">
              ${activeCompany.razon_social}
            </div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-secondary); margin-top: 2px;">
              CUIT: ${activeCompany.cuit}
            </div>
          </div>
        </div>

        <div class="db-nav-label">Estudio</div>
        <a href="#/studio" class="db-nav-item ${activeRoute === 'studio' ? 'active' : ''}" data-route="studio">
          <i data-lucide="layout-dashboard"></i>
          <span>Dashboard General</span>
        </a>
        <a href="#/studio/empresas" class="db-nav-item ${activeRoute === 'empresas' ? 'active' : ''}" data-route="empresas">
          <i data-lucide="building-2"></i>
          <span>Mis Clientes (CUITs)</span>
        </a>
        <a href="#/studio/configuracion" class="db-nav-item ${activeRoute === 'configuracion' ? 'active' : ''}" data-route="configuracion">
          <i data-lucide="cpu"></i>
          <span>Robots RPA & Scheduler</span>
        </a>
        <a href="#/studio/migrador" class="db-nav-item ${activeRoute === 'migrador' ? 'active' : ''}" data-route="migrador">
          <i data-lucide="upload-cloud"></i>
          <span>Migrador de Sistemas</span>
        </a>

        <div class="db-nav-label">Operaciones</div>
        <a href="#/studio/ventas" class="db-nav-item ${activeRoute === 'ventas' ? 'active' : ''}" data-route="ventas">
          <i data-lucide="file-text"></i>
          <span>Comprobantes (Ledger)</span>
        </a>
        <a href="#/studio/importacion" class="db-nav-item ${activeRoute === 'importacion' ? 'active' : ''}" data-route="importacion">
          <i data-lucide="refresh-cw"></i>
          <span>Conciliador "Mis Comprobantes"</span>
        </a>
        <a href="#/studio/portal" class="db-nav-item ${activeRoute === 'portal' ? 'active' : ''}" data-route="portal">
          <i data-lucide="users"></i>
          <span>Portal del Cliente & Factura</span>
        </a>
        <a href="#/studio/whatsapp" class="db-nav-item ${activeRoute === 'whatsapp' ? 'active' : ''}" data-route="whatsapp">
          <i data-lucide="message-square"></i>
          <span>Inbox de WhatsApp</span>
        </a>

        <div class="db-nav-label">Fiscal & Contable</div>
        <a href="#/studio/iva" class="db-nav-item ${activeRoute === 'iva' ? 'active' : ''}" data-route="iva">
          <i data-lucide="book-open"></i>
          <span>Libro IVA Digital</span>
        </a>
        <a href="#/studio/iva-simple" class="db-nav-item ${activeRoute === 'iva-simple' ? 'active' : ''}" data-route="iva-simple">
          <i data-lucide="file-check"></i>
          <span>IVA Simple & Monotributo</span>
        </a>
        <a href="#/studio/retenciones" class="db-nav-item ${activeRoute === 'retenciones' ? 'active' : ''}" data-route="retenciones">
          <i data-lucide="percent"></i>
          <span>Retenciones y Percepciones</span>
          ${!isAdminUnlocked ? '<i data-lucide="lock" style="width: 12px; height: 12px; margin-left: auto; color: var(--color-accent-light);" title="Módulo Premium"></i>' : ''}
        </a>
        <a href="#/studio/rt54" class="db-nav-item ${activeRoute === 'rt54' ? 'active' : ''}" data-route="rt54">
          <i data-lucide="calculator"></i>
          <span>Ajuste por Inflación (RT 54)</span>
        </a>
        <a href="#/studio/sueldos" class="db-nav-item ${activeRoute === 'sueldos' ? 'active' : ''}" data-route="sueldos">
          <i data-lucide="user-check"></i>
          <span>Sueldos y ARCA</span>
          ${!isAdminUnlocked ? '<i data-lucide="lock" style="width: 12px; height: 12px; margin-left: auto; color: var(--color-accent-light);" title="Módulo Premium"></i>' : ''}
        </a>

        <div class="db-nav-label">Soporte</div>
        <a href="#/studio/ayuda" class="db-nav-item ${activeRoute === 'ayuda' ? 'active' : ''}" data-route="ayuda">
          <i data-lucide="help-circle"></i>
          <span>Instructivo & Onboarding</span>
        </a>

        <div class="db-nav-label">Salida</div>
        <a href="#/" class="db-nav-item">
          <i data-lucide="arrow-left-circle"></i>
          <span>Volver a la Web</span>
        </a>
      </div>

      <div class="db-sidebar-footer">
        <div class="user-info">
          <span class="user-name">Estudio Contable Comahue</span>
          <span class="user-role" style="display: flex; align-items: center; gap: 4px;">
            Administrador
            ${isAdminUnlocked ? `
              <span id="vmp-admin-lock-btn" title="Re-bloquear funciones Premium (Volver a Modo Demo)" style="cursor: pointer; color: #f59e0b; display: inline-flex; align-items: center; margin-left: 4px;">
                <i data-lucide="unlock" style="width: 12px; height: 12px;"></i>
              </span>
            ` : ''}
          </span>
        </div>
        <button class="btn-icon-sm" id="logout-studio-btn" title="Cerrar sesión">
          <i data-lucide="log-out"></i>
        </button>
      </div>
    </aside>

    <!-- Main Section -->
    <div class="db-main">
      <header class="db-topbar">
        <div class="topbar-left" style="display: flex; align-items: center; gap: 12px;">
          <!-- Botones de Retroceso / Avance de Historial de Navegación -->
          <div class="history-navigation-buttons" style="display: flex; align-items: center; gap: 6px;">
            <button class="history-nav-btn" id="nav-history-back-btn" title="Retroceder (Alt + Flecha Izquierda)">
              <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i>
            </button>
            <button class="history-nav-btn" id="nav-history-forward-btn" title="Avanzar (Alt + Flecha Derecha)">
              <i data-lucide="arrow-right" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
          <div class="db-breadcrumb" id="db-breadcrumb-title" style="margin-left: 4px;">Cargando...</div>
        </div>

        <div style="display: flex; align-items: center; gap: 16px;">
          <!-- GLOBAL SYNC STATUS PILL -->
          ${syncPillHTML}

          <!-- Global Fiscal Period Selector -->
          <div style="display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 6px 12px; box-shadow: var(--shadow-sm);">
            <i data-lucide="calendar" style="width: 14px; height: 14px; color: var(--text-secondary);"></i>
            <span style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Período Fiscal:</span>
            <select id="global-fiscal-period" style="border: none; background: transparent; font-size: 13px; font-weight: 700; color: var(--text-primary); cursor: pointer; outline: none; padding: 0 4px; font-family: inherit;">
              <option value="2026-05" ${localStorage.getItem('vmp_active_period') === '2026-05' || !localStorage.getItem('vmp_active_period') ? 'selected' : ''}>Mayo 2026</option>
              <option value="2026-04" ${localStorage.getItem('vmp_active_period') === '2026-04' ? 'selected' : ''}>Abril 2026</option>
              <option value="2026-03" ${localStorage.getItem('vmp_active_period') === '2026-03' ? 'selected' : ''}>Marzo 2026</option>
              <option value="2026-02" ${localStorage.getItem('vmp_active_period') === '2026-02' ? 'selected' : ''}>Febrero 2026</option>
              <option value="2026-01" ${localStorage.getItem('vmp_active_period') === '2026-01' ? 'selected' : ''}>Enero 2026</option>
              <option value="2025-12" ${localStorage.getItem('vmp_active_period') === '2025-12' ? 'selected' : ''}>Diciembre 2025</option>
            </select>
          </div>

          <!-- Dynamic Company Selector Pill -->
          <div style="position: relative;">
            <div class="company-selector-container" id="topbar-company-selector" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 5px 12px; display: flex; align-items: center; gap: 8px; background: #fff; box-shadow: var(--shadow-sm); cursor: pointer; transition: border-color 0.2s;">
              <div class="company-avatar" style="background: ${activeCompany.color}; width: 22px; height: 22px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
                ${activeCompany.razon_social[0]}
              </div>
              <div class="company-select-text" style="display: flex; flex-direction: column; text-align: left;">
                <span class="c-sel-name" style="font-size: 12.5px; font-weight: 700; color: var(--color-primary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${activeCompany.razon_social}</span>
                <span class="c-sel-cuit" style="font-size: 9.5px; color: var(--text-secondary); font-family: 'JetBrains Mono', monospace; line-height: 1;">CUIT: ${activeCompany.cuit}</span>
              </div>
              <i data-lucide="chevron-down" style="width: 14px; height: 14px; margin-left: 4px; color: var(--text-secondary);"></i>
            </div>

            <!-- Selector Dropdown -->
            <div class="company-dropdown" id="company-selector-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); right: 0; background: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 100; min-width: 240px; padding: 6px 0;">
              <div style="padding: 6px 12px; font-size: 9.5px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border-color); margin-bottom: 4px;">Cambiar Empresa</div>
              <div style="max-height: 250px; overflow-y: auto;">
                ${companies.map(c => `
                  <div class="dropdown-item ${c.id === activeCompany.id ? 'active' : ''}" data-id="${c.id}" style="padding: 8px 12px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: background 0.15s;">
                    <div class="company-avatar" style="background: ${c.color}; width: 22px; height: 22px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
                      ${c.razon_social[0]}
                    </div>
                    <div class="company-select-text" style="display: flex; flex-direction: column; text-align: left;">
                      <span class="c-sel-name" style="font-size: 12px; font-weight: 600; color: var(--text-primary); max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.razon_social}</span>
                      <span class="c-sel-cuit" style="font-size: 9.5px; color: var(--text-secondary); font-family: 'JetBrains Mono', monospace;">${c.cuit}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div class="db-view-container">
        ${childHTML}
      </div>

      <!-- Mobile Bottom Navigation Bar -->
      <nav class="mobile-bottom-nav">
        <a href="#/studio" class="mb-nav-item ${activeRoute === 'studio' ? 'active' : ''}">
          <i data-lucide="layout-dashboard"></i>
          <span>Inicio</span>
        </a>
        <a href="#/studio/ventas" class="mb-nav-item ${activeRoute === 'ventas' ? 'active' : ''}">
          <i data-lucide="file-text"></i>
          <span>Comprobantes</span>
        </a>
        <a href="#/studio/iva" class="mb-nav-item ${activeRoute === 'iva' ? 'active' : ''}">
          <i data-lucide="book-open"></i>
          <span>Libro IVA</span>
        </a>
        <a href="#/studio/ayuda" class="mb-nav-item ${activeRoute === 'ayuda' ? 'active' : ''}">
          <i data-lucide="help-circle"></i>
          <span>Ayuda</span>
        </a>
      </nav>
    </div>
  </div>
  `;
}

export function initDashboardLayout(mainApp) {
  // Inyectar keyframes CSS dinámicos para spin del cargador impositivo
  if (!document.getElementById('vmp-sync-keyframes')) {
    const style = document.createElement('style');
    style.id = 'vmp-sync-keyframes';
    style.innerHTML = `
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .company-selector-container { cursor: pointer; transition: all 0.2s; }
      .company-selector-container:hover { border-color: var(--color-accent-light) !important; }
      .dropdown-item { transition: background 0.15s; }
      .dropdown-item:hover { background: rgba(31, 92, 67, 0.04); }
      .dropdown-item.active { background: rgba(13, 148, 136, 0.05); }
      .company-dropdown.show { display: block !important; }
    `;
    document.head.appendChild(style);
  }

  // Toggle sidebar collapse
  document.getElementById('sidebar-collapse-btn')?.addEventListener('click', () => {
    document.getElementById('db-wrapper-root').classList.toggle('sidebar-collapsed');
    const icon = document.querySelector('#sidebar-collapse-btn i');
    if (icon) {
      const isCollapsed = document.getElementById('db-wrapper-root').classList.contains('sidebar-collapsed');
      icon.setAttribute('data-lucide', isCollapsed ? 'chevrons-right' : 'chevrons-left');
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Toggle company selector dropdown
  const selector = document.getElementById('topbar-company-selector');
  const dropdown = document.getElementById('company-selector-dropdown');
  
  selector?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    dropdown?.classList.remove('show');
  });

  // Handle active company change
  document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const coId = item.dataset.id;
      mainApp.setActiveCompany(coId);
      dropdown.classList.remove('show');
      mainApp.showToast(`Cambiando a: ${item.querySelector('.c-sel-name').textContent}`, 'info');
    });
  });

  // Global Fiscal Period Selector listener
  const periodSelector = document.getElementById('global-fiscal-period');
  periodSelector?.addEventListener('change', (e) => {
    const newPeriod = e.target.value;
    localStorage.setItem('vmp_active_period', newPeriod);
    
    const periodNames = {
      '2026-05': 'Mayo 2026',
      '2026-04': 'Abril 2026',
      '2026-03': 'Marzo 2026',
      '2026-02': 'Febrero 2026',
      '2026-01': 'Enero 2026',
      '2025-12': 'Diciembre 2025'
    };
    
    mainApp.showToast(`Cambiando período fiscal a: ${periodNames[newPeriod] || newPeriod}`, 'success');
    mainApp.router(); 
  });

  // Explicit handlers for mobile bottom navigation to prevent dead taps or clicks on cell phones
  document.querySelectorAll('.mb-nav-item').forEach(item => {
    const handleNavigation = (e) => {
      e.preventDefault();
      const href = item.getAttribute('href');
      if (href) {
        window.location.hash = href;
      }
    };
    item.addEventListener('click', handleNavigation);
    item.addEventListener('touchstart', handleNavigation, { passive: false });
  });

  // Logout studio
  document.getElementById('logout-studio-btn')?.addEventListener('click', () => {
    localStorage.removeItem('vmp_premium_unlocked');
    window.location.hash = '#/';
  });

  // Re-bloquear funciones Premium
  document.getElementById('vmp-admin-lock-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    localStorage.removeItem('vmp_premium_unlocked');
    mainApp.showToast('Funciones premium bloqueadas (Modo Demo)', 'info');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  });

  // Navigation history back and forward
  document.getElementById('nav-history-back-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.history.back();
  });

  document.getElementById('nav-history-forward-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.history.forward();
  });

  // Global Keyboard Shortcuts for Navigation History: Alt + ArrowLeft / Alt + ArrowRight
  const handleNavKeyboard = (e) => {
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      window.history.back();
    } else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      window.history.forward();
    }
  };
  
  window.removeEventListener('keydown', window._vmp_nav_shortcut_fn);
  window._vmp_nav_shortcut_fn = handleNavKeyboard;
  window.addEventListener('keydown', handleNavKeyboard);

  // -------------------------------------------------------------
  // ACTUALIZACIÓN DINÁMICA DEL PILL DE SINCRONIZACIÓN (SYNC INDICATOR)
  // -------------------------------------------------------------
  const syncIndicator = document.getElementById('topbar-sync-status-indicator');
  const updateSyncUI = (status) => {
    if (!syncIndicator) return;
    
    if (status === 'offline') {
      syncIndicator.style.background = 'rgba(239, 68, 68, 0.06)';
      syncIndicator.style.border = '1px solid rgba(239, 68, 68, 0.2)';
      syncIndicator.innerHTML = `
        <span class="sync-dot" style="background:#ef4444; box-shadow:0 0 8px #ef4444; width:8px; height:8px; border-radius:50%; display:inline-block;"></span> 
        <span style="color:#ef4444; font-size:11px; font-weight:700; margin-left:2px;">Sin Conexión</span>
      `;
    } else if (status === 'syncing') {
      syncIndicator.style.background = 'rgba(245, 158, 11, 0.06)';
      syncIndicator.style.border = '1px solid rgba(245, 158, 11, 0.2)';
      syncIndicator.innerHTML = `
        <span class="sync-dot" style="border:1.5px solid #fbbf24; border-top:1.5px solid transparent; width:8px; height:8px; border-radius:50%; display:inline-block; animation: spin 0.8s linear infinite;"></span> 
        <span style="color:#fbbf24; font-size:11px; font-weight:700; margin-left:4px;">Sincronizando...</span>
      `;
    } else if (status === 'error') {
      syncIndicator.style.background = 'rgba(220, 38, 38, 0.06)';
      syncIndicator.style.border = '1px solid rgba(220, 38, 38, 0.2)';
      syncIndicator.innerHTML = `
        <span class="sync-dot" style="background:#dc2626; box-shadow:0 0 8px #dc2626; width:8px; height:8px; border-radius:50%; display:inline-block;"></span> 
        <span style="color:#dc2626; font-size:11px; font-weight:700; margin-left:2px;">Error Sync</span>
      `;
    } else if (status === 'pending') {
      syncIndicator.style.background = 'rgba(245, 158, 11, 0.04)';
      syncIndicator.style.border = '1px solid rgba(245, 158, 11, 0.15)';
      syncIndicator.innerHTML = `
        <span class="sync-dot" style="background:#fbbf24; box-shadow:0 0 8px #fbbf24; width:8px; height:8px; border-radius:50%; display:inline-block;"></span> 
        <span style="color:#fbbf24; font-size:11px; font-weight:700; margin-left:2px;">Sync Pendiente</span>
      `;
    } else {
      syncIndicator.style.background = 'rgba(47, 122, 89, 0.06)';
      syncIndicator.style.border = '1px solid rgba(47, 122, 89, 0.2)';
      syncIndicator.innerHTML = `
        <span class="sync-dot" style="background:var(--color-accent-light); box-shadow:0 0 8px var(--color-accent-light); width:8px; height:8px; border-radius:50%; display:inline-block;"></span> 
        <span style="color:var(--color-accent-light); font-size:11px; font-weight:700; margin-left:2px;">Sincronizado</span>
      `;
    }
  };

  // Escuchar a los cambios dinámicos del background engine
  window.addEventListener('vmp_sync_status_change', (e) => {
    updateSyncUI(e.detail);
  });
  
  // Establecer valor inicial
  updateSyncUI(getSyncStatus());
}
