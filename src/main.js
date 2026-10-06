/* -------------------------------------------------------------
   VMP Studio Contable - Front Controller & Routing Orchestrator
   ------------------------------------------------------------- */
import { initMockDB, getActiveCompany, setActiveCompanyId, getActiveCompanyAsync, syncClienteCompanyCache } from './db/mockdb.js';
import { supabase, isSupabaseConfigured, getCachedSession, getCachedRole } from './db/supabase.js';
import { initMonitoring } from './monitoring.js';

// Import Views
import { renderLanding, initLanding } from './views/landing.js';
import { renderDashboardLayout, initDashboardLayout } from './views/layout.js';
import { renderDashboardHome, initDashboardHome } from './views/dashboard_home.js';
import { renderEmpresas, initEmpresas } from './views/empresas.js';
import { renderVentas, initVentas } from './views/ventas.js';
import { renderImportacion, initImportacion } from './views/importacion.js';
import { renderIVA, initIVA } from './views/iva.js';
import { renderPortalCliente, initPortalCliente } from './views/portal_cliente.js';
import { renderConfiguracion, initConfiguracion } from './views/configuracion.js';
import { renderIVASimple, initIVASimple } from './views/iva_simple.js';
import { renderRetenciones, initRetenciones } from './views/retenciones.js';
import { renderRT54, initRT54 } from './views/rt54.js';
import { renderAyuda, initAyuda } from './views/ayuda.js';
import { renderWhatsApp, initWhatsApp } from './views/whatsapp.js';
import { renderMigrador, initMigrador } from './views/migrador.js';
import { renderSueldos, initSueldos } from './views/sueldos.js';

class Application {
  constructor() {
    this.activeChart = null;
    this.init();
  }

  async init() {
    console.log("Initializing VMP Studio Contable App...");
    
    // 1. Initialize Mock Database (localStorage)
    initMockDB();

    // 1b. Si una sesión real de Supabase se cierra o vence, sacar al usuario
    // del studio de inmediato en vez de recién en la próxima navegación manual.
    if (isSupabaseConfigured && supabase) {
      supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT' && window.location.hash.startsWith('#/studio')) {
          window.location.hash = '#/';
        }
      });
    }

    // 1c. Candado "premium" del sandbox (sin backend). Con Supabase configurado
    // el acceso lo da la sesion real del estudio, asi que no hay clave ni prompt.
    if (!isSupabaseConfigured) {
      document.addEventListener('click', (e) => {
        if (!e.target.closest('[data-premium-unlock]')) return;
        const key = prompt('Ingrese la clave de administrador para desbloquear las funciones premium:');
        if (key && key === (import.meta.env.VITE_ADMIN_DEMO_PASS || 'sc-demo-2026')) {
          localStorage.setItem('vmp_premium_unlocked', 'true');
          window.location.reload();
        } else if (key) {
          alert('Clave incorrecta');
        }
      });
    }

    // 2. Setup Hash Routing Listener
    window.addEventListener('hashchange', () => this.router());

    // 2b. Setup Database Mutation Listener for Reactivity (Pilar 1 - N5 Vision)
    window.addEventListener('vmp_db_updated', () => {
      console.log("DB changed. Reactively redrawing active route...");
      this.router();
    });

    // 3. Trigger initial routing
    await this.router();
  }

  async router() {
    const hash = window.location.hash || '#/';
    console.log("Routing to:", hash);

    const rootEl = document.getElementById('view-root');
    if (!rootEl) return;

    // Clean up active chart if present to avoid memory leak
    if (this.activeChart) {
      this.activeChart.destroy();
      this.activeChart = null;
    }

    // Clean up any body-level modal overlay left open from a previous view
    // (ARCA transmission, CSV export warning, manual expense entry, etc.)
    // so navigating away doesn't leave a stale overlay blocking the new route.
    document.querySelectorAll('.vmp-modal-overlay').forEach(el => el.remove());

    // Landing Page Route
    if (hash === '#/' || hash === '#' || hash === '') {
      if (!rootEl.querySelector('.lp-wrapper')) {
        rootEl.innerHTML = renderLanding();
      }
      initLanding(this);

      // Update breadcrumb or titles if applicable
      document.title = "Soluciones Contables — El integrante virtual que elimina la carga manual de tu estudio.";
    }
    // Registro de cliente final vía link de invitación del estudio (público)
    else if (hash.startsWith('#/registro-cliente')) {
      rootEl.innerHTML = renderLanding();
      initLanding(this);
      document.title = "Registro de Cliente — Soluciones Contables";
    }
    // Studio Professional Routes
    else if (hash.startsWith('#/studio')) {
      // Gate real de acceso: si Supabase está configurado, exige una sesión
      // real (getCachedSession, con caché mantenida vía onAuthStateChange).
      // Si NO está configurado, se mantiene el sandbox de siempre (?key=<VITE_ADMIN_DEMO_PASS>)
      // para que la demo sin backend siga funcionando sin cambios.
      if (isSupabaseConfigured) {
        const session = await getCachedSession();
        if (!session) {
          window.location.hash = '#/';
          return;
        }

        // Gate por rol: un cliente final solo puede ver el Portal del
        // Cliente; una cuenta real sin vínculo (ni estudio ni cliente) es
        // huérfana y se cierra su sesión en vez de dejarla en un limbo.
        const role = await getCachedRole();
        const subRoutePreview = hash.substring(8).split('?')[0];
        if (role === 'cliente') {
          if (subRoutePreview !== '/portal') {
            window.location.hash = '#/studio/portal';
            return;
          }
        } else if (role !== 'estudio') {
          await supabase.auth.signOut();
          window.location.hash = '#/';
          return;
        }
      } else {
        // REQ-19: la clave de acceso sandbox se lee desde variable de
        // entorno (nunca hardcodeada), mismo patrón que ADMIN_PASS en landing.js.
        const SANDBOX_KEY = import.meta.env.VITE_ADMIN_DEMO_PASS || 'sc-demo-2026';
        let isUnlocked = localStorage.getItem('vmp_premium_unlocked') === 'true';
        if (!isUnlocked) {
          if (hash.includes(`key=${SANDBOX_KEY}`)) {
            localStorage.setItem('vmp_premium_unlocked', 'true');
            isUnlocked = true;
            // Strip the query key from the hash to keep it clean
            const cleanHash = hash.split('?')[0];
            window.location.hash = cleanHash;
            return;
          } else {
            // Silently redirect to landing page
            window.location.hash = '#/';
            return;
          }
        }
      }

      try {
        const subRoute = hash.substring(8).split('?')[0]; // View route after '#/studio'

        if (subRoute === '' || subRoute === '/') {
          await this.safeRoute(renderDashboardHome, initDashboardHome, 'studio', "Dashboard General");
        }
        else if (subRoute === '/empresas') {
          await this.safeRoute(renderEmpresas, initEmpresas, 'empresas', "Gestión de Empresas Clientes");
        }
        else if (subRoute === '/ventas') {
          await this.safeRoute(renderVentas, initVentas, 'ventas', "Libro de Comprobantes");
        }
        else if (subRoute === '/importacion') {
          await this.safeRoute(renderImportacion, initImportacion, 'importacion', "Importación ARCA");
        }
        else if (subRoute === '/iva') {
          await this.safeRoute(renderIVA, initIVA, 'iva', "Libro IVA Digital Digitalizado");
        }
        else if (subRoute === '/portal') {
          await this.safeRoute(renderPortalCliente, initPortalCliente, 'portal', "Portal del Cliente");
        }
        else if (subRoute === '/configuracion') {
          await this.safeRoute(renderConfiguracion, initConfiguracion, 'configuracion', "Configuración de Enlace ARCA");
        }
        else if (subRoute === '/iva-simple') {
          await this.safeRoute(renderIVASimple, initIVASimple, 'iva-simple', "IVA Simple — F.2051");
        }
        else if (subRoute === '/retenciones') {
          await this.safeRoute(renderRetenciones, initRetenciones, 'retenciones', "Retenciones y Percepciones");
        }
        else if (subRoute === '/rt54') {
          await this.safeRoute(renderRT54, initRT54, 'rt54', "RT 54 · Panel Contable");
        }
        else if (subRoute === '/sueldos') {
          await this.safeRoute(renderSueldos, initSueldos, 'sueldos', "Libro de Sueldos Digital");
        }
        else if (subRoute === '/whatsapp') {
          await this.safeRoute(renderWhatsApp, initWhatsApp, 'whatsapp', "Omnicanal · WhatsApp Inbox");
        }
        else if (subRoute === '/migrador') {
          await this.safeRoute(renderMigrador, initMigrador, 'migrador', "Migrador de Sistemas Legados");
        }
        else if (subRoute === '/ayuda') {
          await this.safeRoute(renderAyuda, initAyuda, 'ayuda', "Instructivo & Onboarding");
        }
        else {
          // Fallback to studio home
          window.location.hash = '#/studio';
        }
      } catch (err) {
        console.error("Dashboard error caught in orchestrator:", err);
        
        // Render a safe, premium error fallback inside rootEl
        rootEl.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif; padding: 24px; text-align: center;">
            <div style="background: #fee2e2; border: 1px solid #fecaca; color: #dc2626; padding: 16px; border-radius: 8px; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; font-size: 32px; font-weight: 700;">
              ⚠️
            </div>
            <h1 style="font-size: 24px; font-weight: 800; color: var(--text-primary); margin-bottom: 12px;">Se detectó una discrepancia de inicio</h1>
            <p style="font-size: 14px; color: var(--text-secondary); max-width: 500px; line-height: 1.6; margin-bottom: 24px;">
              El sistema encontró una inconsistencia al procesar los datos locales. Esto puede suceder por una sesión anterior no finalizada.
            </p>
            <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-secondary); max-width: 600px; overflow-x: auto; margin-bottom: 24px; border-left: 4px solid #dc2626; text-align: left; white-space: pre-wrap;"><strong>Error técnico:</strong> ${err.message}</div>
            <div style="display: flex; gap: 16px; justify-content: center;">
              <button onclick="window.location.reload()" style="background: var(--color-accent); color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s;">
                Recargar Sistema
              </button>
              <button onclick="localStorage.clear(); window.location.hash='#/'; window.location.reload();" style="background: transparent; color: var(--text-secondary); border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                Restablecer Sesión (Limpiar Caché)
              </button>
            </div>
          </div>
        `;

        if (this.showToast) {
          this.showToast("Inconsistencia temporal detectada. Intentá restablecer la sesión.", "error");
        }
      }
    } 
    // Fallback to Landing
    else {
      window.location.hash = '#/';
    }

    // Re-create icons for any newly injected html
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  updateBreadcrumb(title) {
    const el = document.getElementById('db-breadcrumb-title');
    if (el) el.textContent = title;
  }

  async safeRoute(renderViewFn, initViewFn, activeRouteKey, breadcrumbTitle) {
    const rootEl = document.getElementById('view-root');
    if (!rootEl) return;

    // 0. Con backend real, el layout (que lee el cache local de forma sincrona)
    // tiene que reflejar SOLO datos reales de esta sesion, segun el rol.
    let role = null;
    if (isSupabaseConfigured && supabase) {
      role = await getCachedRole();
      if (role === 'cliente') await syncClienteCompanyCache();
      else if (role === 'estudio') await getActiveCompanyAsync();
    }

    // 1. Get active company
    let activeCompany;
    try {
      activeCompany = getActiveCompany();
    } catch (dbErr) {
      console.error("Database access failed inside router:", dbErr);
      throw dbErr;
    }

    document.title = `Dashboard — ${activeCompany.razon_social} | Soluciones Contables`;

    // 2. Render sub-view HTML
    let viewHTML = '';
    let viewFailed = false;
    let renderError = null;
    try {
      viewHTML = await renderViewFn();
    } catch (err) {
      console.error(`Error rendering sub-view for ${activeRouteKey}:`, err);
      viewFailed = true;
      renderError = err;
      viewHTML = `
        <div class="card" style="padding: 24px; text-align: center; border-left: 4px solid #ef4444; background: #fff; border-radius: 8px; box-shadow: var(--shadow-sm); margin: 20px;">
          <div style="background: #fee2e2; color: #ef4444; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 20px;">⚠️</div>
          <h3 style="color: #1e293b; font-size: 16px; font-weight: 700; margin-bottom: 8px;">Error al cargar la sección</h3>
          <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">Ocurrió un problema al procesar los datos de esta pantalla. Esto puede deberse a la interferencia de extensiones externas del navegador o problemas de consistencia local.</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-secondary); text-align: left; overflow-x: auto; margin-bottom: 16px; border-left: 3px solid #ef4444; white-space: pre-wrap;">${err.stack || err.message || err}</div>
          <button class="btn btn-primary" onclick="window.location.reload()" style="background: var(--color-accent); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">Recargar Sección</button>
        </div>
      `;
    }

    // 3. Render and inject Layout
    let layoutHTML = '';
    try {
      layoutHTML = renderDashboardLayout(viewHTML, activeRouteKey, role);
    } catch (layoutErr) {
      console.error("Layout rendering failed:", layoutErr);
      throw layoutErr;
    }

    // Assign to DOM (safeguarded against synchronous DOM listeners throwing errors)
    try {
      rootEl.innerHTML = layoutHTML;
    } catch (domErr) {
      console.error("DOM assignment failed, attempting resilient recovery:", domErr);
      try {
        rootEl.innerHTML = renderDashboardLayout(`
          <div class="card" style="padding: 24px; text-align: center; border-left: 4px solid #ef4444; background: #fff; margin: 20px;">
            <div style="background: #fee2e2; color: #ef4444; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 20px;">⚠️</div>
            <h3 style="color: #ef4444; margin-bottom: 8px;">Interferencia de Extensión Detectada</h3>
            <p style="color: var(--text-secondary); margin-bottom: 16px;">Una extensión de su navegador (como Autofirma, un gestor de contraseñas o un asistente impositivo) impidió cargar el contenido de forma normal.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-secondary); text-align: left; overflow-x: auto; margin-bottom: 16px; white-space: pre-wrap;">
              ${domErr.stack || domErr.message || domErr}
            </div>
            <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">Sugerencia: Intente desactivar temporalmente extensiones impositivas de AFIP/ARCA o firmas digitales en este navegador para esta URL.</p>
            <button class="btn btn-primary" onclick="window.location.reload()" style="background: var(--color-accent); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">Recargar</button>
          </div>
        `, activeRouteKey);
      } catch (fatalErr) {
        throw domErr;
      }
    }

    // 4. Initialize Layout
    try {
      initDashboardLayout(this);
    } catch (layoutInitErr) {
      console.error("Layout initialization failed:", layoutInitErr);
    }

    // 5. Update Breadcrumb
    try {
      this.updateBreadcrumb(breadcrumbTitle);
    } catch (bcErr) {
      console.error("Failed to update breadcrumb:", bcErr);
    }

    // 6. Initialize View (only if render didn't fail and layout didn't trigger simplified fallback)
    if (!viewFailed && initViewFn) {
      const container = document.querySelector('.db-view-container');
      if (container) {
        try {
          await initViewFn(this);
        } catch (viewInitErr) {
          console.error(`Error initializing sub-view for ${activeRouteKey}:`, viewInitErr);
          
          container.innerHTML = `
            <div class="card" style="padding: 24px; text-align: center; border-left: 4px solid #ef4444; background: #fff; border-radius: 8px; box-shadow: var(--shadow-sm); margin: 20px;">
              <div style="background: #fee2e2; color: #ef4444; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 20px;">⚠️</div>
              <h3 style="color: #1e293b; font-size: 16px; font-weight: 700; margin-bottom: 8px;">Error de Inicialización</h3>
              <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">La sección se cargó visualmente pero falló al inicializar sus controles interactivos.</p>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-secondary); text-align: left; overflow-x: auto; margin-bottom: 16px; border-left: 3px solid #ef4444; white-space: pre-wrap;">${viewInitErr.stack || viewInitErr.message || viewInitErr}</div>
              <button class="btn btn-primary" onclick="window.location.reload()" style="background: var(--color-accent); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">Recargar Sección</button>
            </div>
          `;
        }
      }
    }
  }

  setActiveCompany(companyId) {
    setActiveCompanyId(companyId);
    // Reload active dashboard route instantly
    this.router();
  }

  // -------------------------------------------------------------
  // Toast System Implementation
  // -------------------------------------------------------------
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconMap = {
      success: 'check-circle-2',
      error: 'alert-circle',
      warning: 'alert-triangle',
      info: 'info'
    };
    
    // El mensaje suele incluir nombres de empresa/proveedor ingresados por
    // usuarios: se inserta como texto, nunca como HTML.
    toast.innerHTML = `
      <i data-lucide="${iconMap[type] || 'info'}" style="width: 20px; height: 20px;"></i>
      <span style="font-weight: 500;"></span>
    `;
    toast.querySelector('span').textContent = message;
    
    container.appendChild(toast);

    if (window.lucide) {
      window.lucide.createIcons({ root: toast });
    }

    // Smooth entry
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    // Auto removal (con fallback por si transitionend no dispara, ej. pestaña en segundo plano)
    setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      setTimeout(() => toast.remove(), 500);
    }, 3500);
  }
}

// Bootstrap the app
initMonitoring();
const mainApp = new Application();
export default mainApp;
