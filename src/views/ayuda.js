/* -------------------------------------------------------------
   VMP Studio Contable — Centro de Ayuda e Instructivo de Onboarding
   Guía interactiva para la configuración y uso del sistema
   ------------------------------------------------------------- */
import { getCompaniesAsync, getEstudioAsync, updateEstudioFieldsAsync } from '../db/mockdb.js';
import { isSupabaseConfigured, supabase } from '../db/supabase.js';

function getDelegationActive(company) {
  if (isSupabaseConfigured && supabase) return !!company.delegation_active;
  return localStorage.getItem(`vmp_delegation_active_${company.id}`) === 'true';
}

export async function renderAyuda() {
  const companies = (await getCompaniesAsync()) || [];
  const estudio = await getEstudioAsync();

  // Onboarding Tasks Status: real (Supabase, columna por columna en "estudios")
  // o sandbox (localStorage), según corresponda.
  const t1 = estudio ? estudio.onboarding_task_estudio : (localStorage.getItem('vmp_task_estudio') === 'true');
  const t2 = estudio ? estudio.arca_cert_uploaded : (localStorage.getItem('vmp_arca_cert_uploaded') === 'true'); // Share with config
  const t3 = companies.length > 2; // Simulates user adding their own client (default is 3, if added then > 3)
  const t4 = companies.some(getDelegationActive);
  const t5 = estudio ? estudio.onboarding_import_simulado : (localStorage.getItem('vmp_import_simulated') === 'true');
  const t6 = estudio ? estudio.onboarding_iva_validado : (localStorage.getItem('vmp_iva_validated_Logistica') === 'true' || localStorage.getItem('vmp_iva_validated_Software') === 'true');

  const completedCount = [t1, t2, t3, t4, t5, t6].filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 6) * 100);

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Instructivo & Onboarding</h1>
      <p class="view-subtitle">Guía paso a paso para configurar el sistema y capacitar a tus clientes.</p>
    </div>
    <div style="background: rgba(22, 163, 74, 0.08); border: 1px solid rgba(22, 163, 74, 0.2); padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: #4f46e5;">
      💡 Asistente de Configuración 2026
    </div>
  </div>

  <!-- Onboarding Progress Tracker -->
  <div class="card" style="margin-bottom: 24px; background: linear-gradient(135deg, rgba(22, 163, 74, 0.02) 0%, rgba(13, 148, 136, 0.02) 100%); border-color: rgba(22, 163, 74, 0.15);">
    <div class="card-body">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <h3 style="font-size: 15px; font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">Tu Progreso de Configuración</h3>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin: 0;">Completá los siguientes pasos obligatorios para dejar el SaaS operando al 100%.</p>
        </div>
        <div style="text-align: right;">
          <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 18px; color: var(--color-accent);">${progressPercent}%</span>
          <span style="font-size: 11px; color: var(--text-muted); display: block;">${completedCount} de 6 tareas</span>
        </div>
      </div>

      <!-- Progress Bar -->
      <div style="background: var(--border-color); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 20px;">
        <div id="onboarding-progress-bar" style="width: ${progressPercent}%; height: 100%; background: linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-light) 100%); border-radius: 4px; transition: width 0.4s ease;"></div>
      </div>

      <!-- Interactive Checklist Grid -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;" class="trial-actions-grid">
        
        <!-- Task 1 -->
        <label class="trial-action-btn" style="border-color: ${t1 ? 'var(--color-accent)' : 'var(--border-color)'}; display: flex; align-items: flex-start; gap: 10px; cursor: pointer; background: #fff; text-align: left;">
          <input type="checkbox" id="chk-task-estudio" ${t1 ? 'checked' : ''} style="margin-top: 3px; accent-color: var(--color-accent); width: 16px; height: 16px;">
          <div>
            <h5 style="font-size: 12.5px; font-weight: 700; color: ${t1 ? 'var(--color-accent)' : 'var(--color-primary)'}; margin-bottom: 2px;">1. Alta del Estudio</h5>
            <p style="font-size: 10px; color: var(--text-secondary); line-height: 1.3;">Registrar datos del Estudio Contable.</p>
          </div>
        </label>

        <!-- Task 2 -->
         <a href="#/studio/configuracion" class="trial-action-btn" style="border-color: ${t2 ? 'var(--color-accent)' : 'var(--border-color)'}; display: flex; align-items: flex-start; gap: 10px; background: #fff; text-align: left; text-decoration: none; color: inherit;">
          <div style="margin-top: 3px;">
            <i data-lucide="${t2 ? 'check-circle-2' : 'circle'}" style="width: 16px; height: 16px; color: ${t2 ? 'var(--color-accent)' : 'var(--text-muted)'};"></i>
          </div>
          <div>
            <h5 style="font-size: 12.5px; font-weight: 700; color: ${t2 ? 'var(--color-accent)' : 'var(--color-primary)'}; margin-bottom: 2px;">2. Firma Digital ARCA</h5>
            <p style="font-size: 10px; color: var(--text-secondary); line-height: 1.3;">Subir certificado digital <code>.crt</code> and <code>.key</code>.</p>
          </div>
        </a>

        <!-- Task 3 -->
        <a href="#/studio/empresas" class="trial-action-btn" style="border-color: ${t3 ? 'var(--color-accent)' : 'var(--border-color)'}; display: flex; align-items: flex-start; gap: 10px; background: #fff; text-align: left; text-decoration: none; color: inherit;">
          <div style="margin-top: 3px;">
            <i data-lucide="${t3 ? 'check-circle-2' : 'circle'}" style="width: 16px; height: 16px; color: ${t3 ? 'var(--color-accent)' : 'var(--text-muted)'};"></i>
          </div>
          <div>
            <h5 style="font-size: 12.5px; font-weight: 700; color: ${t3 ? 'var(--color-accent)' : 'var(--color-primary)'}; margin-bottom: 2px;">3. Cargar Empresas</h5>
            <p style="font-size: 10px; color: var(--text-secondary); line-height: 1.3;">Crear tus clientes en el panel.</p>
          </div>
        </a>

        <!-- Task 4 -->
        <a href="#/studio/configuracion" class="trial-action-btn" style="border-color: ${t4 ? 'var(--color-accent)' : 'var(--border-color)'}; display: flex; align-items: flex-start; gap: 10px; background: #fff; text-align: left; text-decoration: none; color: inherit;">
          <div style="margin-top: 3px;">
            <i data-lucide="${t4 ? 'check-circle-2' : 'circle'}" style="width: 16px; height: 16px; color: ${t4 ? 'var(--color-accent)' : 'var(--text-muted)'};"></i>
          </div>
          <div>
            <h5 style="font-size: 12.5px; font-weight: 700; color: ${t4 ? 'var(--color-accent)' : 'var(--color-primary)'}; margin-bottom: 2px;">4. Delegar en ARCA</h5>
            <p style="font-size: 10px; color: var(--text-secondary); line-height: 1.3;">Verificar que el CUIT del cliente esté enlazado.</p>
          </div>
        </a>

        <!-- Task 5 -->
        <a href="#/studio/importacion" class="trial-action-btn" style="border-color: ${t5 ? 'var(--color-accent)' : 'var(--border-color)'}; display: flex; align-items: flex-start; gap: 10px; background: #fff; text-align: left; text-decoration: none; color: inherit;">
          <div style="margin-top: 3px;">
            <i data-lucide="${t5 ? 'check-circle-2' : 'circle'}" style="width: 16px; height: 16px; color: ${t5 ? 'var(--color-accent)' : 'var(--text-muted)'};"></i>
          </div>
          <div>
            <h5 style="font-size: 12.5px; font-weight: 700; color: ${t5 ? 'var(--color-accent)' : 'var(--color-primary)'}; margin-bottom: 2px;">5. Primera Importación</h5>
            <p style="font-size: 10px; color: var(--text-secondary); line-height: 1.3;">Probar la carga de comprobantes vía ARCA.</p>
          </div>
        </a>

        <!-- Task 6 -->
        <a href="#/studio/iva-simple" class="trial-action-btn" style="border-color: ${t6 ? 'var(--color-accent)' : 'var(--border-color)'}; display: flex; align-items: flex-start; gap: 10px; background: #fff; text-align: left; text-decoration: none; color: inherit;">
          <div style="margin-top: 3px;">
            <i data-lucide="${t6 ? 'check-circle-2' : 'circle'}" style="width: 16px; height: 16px; color: ${t6 ? 'var(--color-accent)' : 'var(--text-muted)'};"></i>
          </div>
          <div>
            <h5 style="font-size: 12.5px; font-weight: 700; color: ${t6 ? 'var(--color-accent)' : 'var(--color-primary)'}; margin-bottom: 2px;">6. Liquidar IVA F.2051</h5>
            <p style="font-size: 10px; color: var(--text-secondary); line-height: 1.3;">Cerrar e imprimir tu primera DDJJ del mes.</p>
          </div>
        </a>

      </div>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 240px 1fr; gap: 32px; align-items: start;">
    
    <!-- Left Column: Navigation Tabs -->
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <button class="btn btn-outline help-tab-btn active" data-tab="general" style="text-align: left; display: flex; align-items: center; gap: 8px; justify-content: flex-start; width: 100%;">
        <i data-lucide="book-open" style="width: 16px; height: 16px;"></i> Guía General
      </button>
      <button class="btn btn-outline help-tab-btn" data-tab="arca" style="text-align: left; display: flex; align-items: center; gap: 8px; justify-content: flex-start; width: 100%;">
        <i data-lucide="shield-check" style="width: 16px; height: 16px;"></i> Delegación ARCA
      </button>
      <button class="btn btn-outline help-tab-btn" data-tab="modulos" style="text-align: left; display: flex; align-items: center; gap: 8px; justify-content: flex-start; width: 100%;">
        <i data-lucide="cpu" style="width: 16px; height: 16px;"></i> Módulos 2026
      </button>
      <button class="btn btn-outline help-tab-btn" data-tab="portal" style="text-align: left; display: flex; align-items: center; gap: 8px; justify-content: flex-start; width: 100%;">
        <i data-lucide="smartphone" style="width: 16px; height: 16px;"></i> Portal de Clientes
      </button>
      <button class="btn btn-outline help-tab-btn" data-tab="faq" style="text-align: left; display: flex; align-items: center; gap: 8px; justify-content: flex-start; width: 100%;">
        <i data-lucide="help-circle" style="width: 16px; height: 16px;"></i> Preguntas Frecuentes
      </button>
      
      <div style="margin-top: 24px; padding: 16px; background: rgba(13, 148, 136, 0.04); border: 1px solid rgba(13, 148, 136, 0.15); border-radius: var(--radius-md); text-align: center;">
        <i data-lucide="phone-call" style="width: 24px; height: 24px; color: var(--color-accent); margin-bottom: 8px;"></i>
        <h6 style="font-size: 12.5px; font-weight: 700; margin-bottom: 4px;">Soporte VIP</h6>
        <p style="font-size: 10px; color: var(--text-secondary); margin-bottom: 10px; line-height: 1.3;">¿Tenés alguna consulta técnica compleja?</p>
        <a href="mailto:soporte@vmp.com.ar" class="btn btn-primary btn-sm" style="font-size: 11px; padding: 4px 10px; width: 100%; display: block; background: var(--color-accent); border-color: var(--color-accent);">Escribir a Soporte</a>
      </div>
    </div>

    <!-- Right Column: Content Box -->
    <div class="card" style="min-height: 480px;">
      
      <!-- TOP Search Bar inside Card Header -->
      <div class="card-header" style="border-bottom-color: rgba(0,0,0,0.06); padding: 16px 20px; display: flex; align-items: center; justify-content: space-between;">
        <h3 id="help-card-title"><i data-lucide="book-open" style="color: var(--color-accent);"></i> Guía General del Sistema</h3>
        <div style="position: relative; width: 240px;">
          <input type="text" id="help-search-input" placeholder="Buscar en la guía..." style="width: 100%; padding: 6px 12px 6px 32px; font-size: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-secondary);">
          <i data-lucide="search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 13px; height: 13px; color: var(--text-muted);"></i>
        </div>
      </div>

      <div class="card-body" id="help-content-container" style="padding: 24px; overflow-y: auto;">
        <!-- CONTENT WILL BE INJECTED HERE DYNAMICALLY BY JAVASCRIPT -->
      </div>
    </div>

  </div>
  `;
}

// Content definitions for each tab
const TabContents = {
  general: `
    <div class="help-section-flow" style="display: flex; flex-direction: column; gap: 20px;">
      <p class="text-primary" style="font-size: 14px; line-height: 1.6; font-weight: 500;">
        ¡Te damos la bienvenida a <strong>Soluciones Contables de VMP</strong>! La plataforma que automatiza y moderniza la relación entre el Estudio Contable y sus clientes.
      </p>

      <div style="background: rgba(13, 148, 136, 0.02); border: 1px solid rgba(13, 148, 136, 0.12); border-radius: var(--radius-md); padding: 16px; display: flex; align-items: flex-start; gap: 12px;">
        <i data-lucide="info" style="color: var(--color-accent); flex-shrink: 0; margin-top: 2px;"></i>
        <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5;">
          <strong>Concepto Clave:</strong> La plataforma tiene dos vistas principales:
          <ul style="margin-top: 6px; padding-left: 16px; display: flex; flex-direction: column; gap: 4px;">
            <li><strong>Panel del Estudio (Contador):</strong> Es este menú que estás navegando, donde se gestionan múltiples empresas, se concilian retenciones, se calcula la RT 54 y se liquidan DDJJs oficiales.</li>
            <li><strong>Portal del Cliente (PyME):</strong> Una vista móvil y web ultra-simplificada para que tus clientes suban sus tickets, saquen fotos a sus facturas o carguen ventas manuales sin complejidad contable.</li>
          </ul>
        </div>
      </div>

      <div>
        <h4 style="font-size: 13.5px; font-weight: 700; margin-bottom: 12px; color: var(--color-primary);">El Circuito de Trabajo en 4 Pasos:</h4>
        <div class="grid-resp-4" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">

          <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; text-align: center;">
            <div style="background: rgba(22, 163, 74, 0.06); color: var(--color-accent); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">1</div>
            <h5 style="font-size: 12px; font-weight: 700; margin-bottom: 4px;">Enlazar ARCA</h5>
            <p style="font-size: 10px; color: var(--text-secondary); line-height: 1.3; margin: 0;">Configurás la firma digital del estudio y el bot conecta ARCA.</p>
          </div>

          <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; text-align: center;">
            <div style="background: rgba(34, 197, 94, 0.06); color: var(--color-accent-light); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">2</div>
            <h5 style="font-size: 12px; font-weight: 700; margin-bottom: 4px;">Co-creación</h5>
            <p style="font-size: 10px; color: var(--text-secondary); line-height: 1.3; margin: 0;">El cliente sube comprobantes por el celular y el bot lee ARCA.</p>
          </div>

          <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; text-align: center;">
            <div style="background: rgba(245, 158, 11, 0.06); color: #f59e0b; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">3</div>
            <h5 style="font-size: 12px; font-weight: 700; margin-bottom: 4px;">Controlador</h5>
            <p style="font-size: 10px; color: var(--text-secondary); line-height: 1.3; margin: 0;">El contador valida consistencia de IVA, retenciones y RT 54.</p>
          </div>

          <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; text-align: center;">
            <div style="background: rgba(14, 165, 233, 0.06); color: #0ea5e9; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">4</div>
            <h5 style="font-size: 12px; font-weight: 700; margin-bottom: 4px;">Cierre y DDJJ</h5>
            <p style="font-size: 10px; color: var(--text-secondary); line-height: 1.3; margin: 0;">Se generan los TXT automáticos y listos para subir a ARCA.</p>
          </div>

        </div>
      </div>

      <div style="margin-top: 8px;">
        <h4 style="font-size: 13.5px; font-weight: 700; margin-bottom: 8px; color: var(--color-primary);">Primeros Pasos Operativos en el Studio:</h4>
        <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
          Te sugerimos iniciar el enlace con este flujo rápido en **5 minutos**:
        </p>
        <ol style="padding-left: 18px; font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 8px; line-height: 1.4;">
          <li>Andá a <strong>Configuración ARCA</strong> y hacé clic en el botón <em>"Enlazar y Homologar Firma Digital"</em> para activar el certificado del estudio.</li>
          <li>En la tabla de la derecha, dale clic a <em>"Verificar"</em> sobre una empresa para validar que el cliente ya te delegó sus permisos.</li>
          <li>Ingresá a <strong>Importación ARCA</strong>, arrastrá uno de los archivos de compras para sincronizar e importar los datos de ARCA.</li>
          <li>Entrá a <strong>IVA Simple F.2051</strong>, analizá el cuadrante de consistencia en tiempo real y dale a <em>"Validar Consistencia"</em> para cerrar el mes impositivo.</li>
        </ol>
      </div>
    </div>
  `,

  arca: `
    <div class="help-section-flow" style="display: flex; flex-direction: column; gap: 20px;">
      <p class="text-primary" style="font-size: 13.5px; line-height: 1.5; font-weight: 500;">
        La automatización segura se basa en delegar servicios de ARCA al CUIT del estudio. Esto evita compartir claves fiscales y mantiene el 100% de cumplimiento legal.
      </p>

      <!-- Steps for Accountant -->
      <div class="card" style="border-color: rgba(22, 163, 74, 0.15);">
        <div class="card-header" style="background: rgba(22, 163, 74, 0.01); padding: 12px 16px;">
          <h4 style="font-size: 13px; font-weight: 700; color: #4f46e5; margin: 0; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="folder-key"></i> Paso 1: Configurar la Firma del Estudio Contable
          </h4>
        </div>
        <div class="card-body" style="padding: 16px; font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
          El estudio genera un certificado digital (CSR) único por su CUIT.
          <ol style="margin-top: 8px; padding-left: 16px; display: flex; flex-direction: column; gap: 6px;">
            <li>En VMP Studio, ingresás a <strong>Configuración ARCA</strong>.</li>
            <li>Subís tu Certificado Homologado (<code>.crt</code>) obtenido de ARCA y tu Clave Privada (<code>.key</code>).</li>
            <li>Con esto, el servidor central de VMP Studio está oficialmente autorizado para comunicarse con ARCA en tu nombre.</li>
          </ol>
        </div>
      </div>

      <!-- Steps for Client -->
      <div class="card" style="border-color: rgba(34, 197, 94, 0.15);">
        <div class="card-header" style="background: rgba(34, 197, 94, 0.01); padding: 12px 16px;">
          <h4 style="font-size: 13px; font-weight: 700; color: var(--color-accent); margin: 0; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="user-check"></i> Paso 2: El cliente realiza la delegación (Copia y enviale esto por Whatsapp)
          </h4>
        </div>
        <div class="card-body" style="padding: 16px; background: #fff;">
          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.5;">
            Copiá este mensaje simple y envíaselo a tus clientes nuevos para explicarles cómo hacer el onboarding:
          </p>
          <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; font-family: 'Outfit', sans-serif; font-size: 11.5px; color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; position: relative;">
<strong style="color: var(--color-teal-light);">Mensaje para enviar al Cliente:</strong>
"Hola! Para poder importar tus facturas y retenciones de forma automática a nuestra nueva plataforma contable, te pido que nos delegues el acceso de lectura en ARCA. Es muy fácil, seguro y se hace por única vez:

1. Entrá con tu CUIT y Clave Fiscal a la web de ARCA.
2. Buscá el servicio <strong>"Administrador de Relaciones de Clave Fiscal"</strong>.
3. Hacé clic en <strong>"Nueva Relación"</strong>.
4. Hacé clic en <strong>"Buscar"</strong> -> seleccioná <strong>"ARCA"</strong> -> <strong>"WebServices"</strong>.
5. Buscá el servicio: <code>"Libro de IVA Digital"</code>.
6. En <strong>"Representante"</strong>, poné nuestro CUIT del Estudio: <strong>[INGRESAR_CUIT_ESTUDIO]</strong>.
7. Confirmá la relación y ¡listo! No hace falta que nos pases tu clave fiscal."
          </div>
          <button class="btn btn-outline btn-sm" id="btn-copy-template" style="margin-top: 10px; font-size: 11px; padding: 4px 10px;">
            <i data-lucide="copy" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i> Copiar Plantilla de Mensaje
          </button>
        </div>
      </div>

    </div>
  `,

  modulos: `
    <div class="help-section-flow" style="display: flex; flex-direction: column; gap: 20px;">
      <p class="text-primary" style="font-size: 13.5px; line-height: 1.5; font-weight: 500;">
        Conocé en detalle cómo operar los módulos normativos premium adaptados a las regulaciones ARCA y FACPCE del 2026:
      </p>

      <!-- Accordion Module 1 -->
      <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
        <div style="padding: 12px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); font-weight: 700; font-size: 13px; color: var(--color-primary); display: flex; justify-content: space-between; align-items: center;">
          <span>1. IVA Simple · Formulario 2051 (ARCA 2026)</span>
          <span class="badge" style="margin:0; background: rgba(22,163,74,0.06); border-color: rgba(22,163,74,0.15); color: var(--color-accent); font-size: 10px;">Normativo</span>
        </div>
        <div style="padding: 16px; font-size: 12px; line-height: 1.5; color: var(--text-secondary);">
          Diseñado para el nuevo régimen unificado de liquidación de IVA.
          <ul style="margin-top: 8px; padding-left: 16px; display: flex; flex-direction: column; gap: 6px;">
            <li><strong>Cuadrante de Consistencia:</strong> El sistema cruza automáticamente los comprobantes del Libro de IVA Digital con las actividades económicas declaradas bajo códigos CLAE en ARCA.</li>
            <li><strong>Validación Preventiva:</strong> Si hay una diferencia contable mayor a $1 entre los débitos calculados y los registrados, el botón <em>"Validar Consistencia"</em> te dará un error detallando la diferencia, evitando fiscalizaciones electrónicas inmediatas.</li>
            <li><strong>Vencimientos Inteligentes:</strong> Se muestran en pantalla de forma dinámica, calculados según el último dígito del CUIT de la empresa activa.</li>
          </ul>
        </div>
      </div>

      <!-- Accordion Module 2 -->
      <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
        <div style="padding: 12px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); font-weight: 700; font-size: 13px; color: var(--color-primary); display: flex; justify-content: space-between; align-items: center;">
          <span>2. Retenciones y Percepciones · Conciliación 3 Fuentes</span>
          <span class="badge" style="margin:0; background: rgba(22,163,74,0.06); border-color: rgba(22,163,74,0.15); color: var(--color-accent); font-size: 10px;">Control Financiero</span>
        </div>
        <div style="padding: 16px; font-size: 12px; line-height: 1.5; color: var(--text-secondary);">
          Evita la pérdida de crédito fiscal por retenciones no computadas.
          <ul style="margin-top: 8px; padding-left: 16px; display: flex; flex-direction: column; gap: 6px;">
            <li>El sistema contrasta: (A) Lo registrado en el **libro diario contable**, (B) Lo informado en el **Régimen de Retenciones ARCA (SIRE)**, y (C) Lo liquidado en los **bancos (SIRCREB/extractos)**.</li>
            <li>La tabla resalta diferencias en rojo. Si detectás una retención bancaria omitida en el libro de compras, podés computarla al instante haciendo clic en el botón de conciliación para no perder el saldo a favor.</li>
          </ul>
        </div>
      </div>

      <!-- Accordion Module 3 -->
      <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
        <div style="padding: 12px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); font-weight: 700; font-size: 13px; color: var(--color-primary); display: flex; justify-content: space-between; align-items: center;">
          <span>3. RT 54 FACPCE · Panel Contable Simplificado</span>
          <span class="badge" style="margin:0; background: rgba(245,158,11,0.06); border-color: rgba(245,158,11,0.15); color: #f59e0b; font-size: 10px;">Balance Express</span>
        </div>
        <div style="padding: 16px; font-size: 12px; line-height: 1.5; color: var(--text-secondary);">
          Implementación de la nueva norma técnica unificada de contabilidad para micro y pequeñas entidades (RT 54).
          <ul style="margin-top: 8px; padding-left: 16px; display: flex; flex-direction: column; gap: 6px;">
            <li>**Existencia Inicial (supuesto de trabajo):** el panel estima la existencia inicial como existencia final × 1,2. Es un supuesto interno que **no surge de la RT 54**: reemplazalo por la existencia inicial real del ejercicio anterior.</li>
            <li>**Fórmula de Costo de Ventas:** Visualización directa y matemática de <code>CV = EI + C - EF</code> (Existencia Inicial + Compras - Existencia Final) para un desglose rápido ante auditorías.</li>
            <li>**Categorización Automática:** El sistema evalúa el tamaño de la empresa en base a sus ingresos y clasifica automáticamente si encuadra en "Micro Entidad" o "Pequeña Entidad" según los umbrales de facturación vigentes de la FACPCE.</li>
          </ul>
        </div>
      </div>

    </div>
  `,

  portal: `
    <div class="help-section-flow" style="display: flex; flex-direction: column; gap: 20px;">
      <p class="text-primary" style="font-size: 13.5px; line-height: 1.5; font-weight: 500;">
        El **Portal del Cliente (Suite Operativa)** es el puente de producción definitivo entre la PyME o contribuyente individual y el estudio contable. Integra en una única herramienta simplificada dos módulos fundamentales que eliminan el papelerío físico y automatizan la gestión impositiva.
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start;">
        
        <!-- Módulo 1 -->
        <div style="background: rgba(22, 163, 74, 0.01); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px;">
          <h4 style="font-size: 14px; font-weight: 800; color: var(--color-accent-light); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="camera" style="width: 18px; height: 18px;"></i>
            1. Digitalización de Comprobantes (OCR con IA)
          </h4>
          <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
            Permite a los clientes enviar fotos de tickets impresos o PDFs de gastos directamente en el momento en que se generan.
          </p>
          <ul style="padding-left: 16px; font-size: 11.5px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px; line-height: 1.4; margin-bottom: 0;">
            <li><strong>Reconocimiento por IA:</strong> Extracción automática de CUIT de emisor, montos neto/IVA, fecha y números usando Gemini 2.5 Flash.</li>
            <li><strong>Detección de Bienes de Uso:</strong> Clasifica de forma inteligente si una compra califica como gasto corriente o como un activo amortizable (Bien de Uso).</li>
            <li><strong>Sincronización en un Clic:</strong> Los gastos aparecen pre-cargados al instante en el módulo contable del estudio para su aprobación formal.</li>
          </ul>
        </div>

        <!-- Módulo 2 -->
        <div style="background: rgba(34, 197, 94, 0.01); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px;">
          <h4 style="font-size: 14px; font-weight: 800; color: var(--color-accent-light); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="zap" style="width: 18px; height: 18px;"></i>
            2. Facturador Directo ARCA (ex-AFIP) Live
          </h4>
          <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
            Una consola de facturación móvil y de escritorio de nivel corporativo que emite comprobantes oficiales directamente en el portal.
          </p>
          <ul style="padding-left: 16px; font-size: 11.5px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px; line-height: 1.4; margin-bottom: 0;">
            <li><strong>Formulario Reactivo Integrado:</strong> Previsualización de la factura en tiempo real en la pantalla (Split Screen) a medida que se completan los campos.</li>
            <li><strong>Validación CUIT Módulo 11:</strong> Algoritmo en vivo que comprueba la validez matemática del dígito verificador impositivo de AFIP antes de enviar la petición.</li>
            <li><strong>Inteligencia de Restricciones Contables:</strong> Configura y restringe automáticamente Facturas A/B (RI) o Factura C (Monotributo) previniendo infracciones técnicas.</li>
            <li><strong>Liquidación y Percepciones de IIBB:</strong> Soporte para liquidación automática de IIBB por jurisdicción provincial y fechas operativas de servicios.</li>
          </ul>
        </div>

      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 24px; border-top: 1px solid var(--border-color); padding-top: 20px; align-items: center;">
        <div>
          <h4 style="font-size: 13.5px; font-weight: 800; margin-bottom: 6px; color: var(--color-primary);">Exportaciones Directas e Intercambio Seguro SOAP</h4>
          <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0;">
            El facturador cuenta con una **Consola de Intercambio SOAP XML** integrada que detalla los logs cifrados de comunicación con las pasarelas WSAA y WSFE de ARCA. Además, los clientes pueden exportar sus lotes en un archivo <strong>.txt adaptado al diseño de registro oficial de AFIP (REGINFO Ventas)</strong>, permitiendo al contador importar los datos de forma inmediata y masiva en la plataforma tributaria nacional.
          </p>
        </div>

        <div style="background: rgba(22, 163, 74, 0.03); border: 1px solid rgba(22, 163, 74, 0.12); border-radius: var(--radius-md); padding: 16px; text-align: center;">
          <h4 style="font-size: 12.5px; font-weight: 700; color: var(--color-accent-light); margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <i data-lucide="smartphone"></i> Acceso a la Experiencia
          </h4>
          <p style="font-size: 11px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 12px;">
            Visualizá de forma transparente el funcionamiento del portal de tus clientes y realizá emisiones reales de prueba.
          </p>
          <a href="#/studio/portal" class="btn btn-primary btn-sm" style="font-size: 11px; background: var(--color-accent); border-color: var(--color-accent); padding: 8px 16px; display: inline-block;">
            <i data-lucide="eye" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i> Abrir Portal del Cliente
          </a>
        </div>
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 16px;">
        <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px; color: var(--color-primary);">Canal Automatizado por WhatsApp RPA</h4>
        <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
          Para contribuyentes que prefieran no utilizar la web, el sistema cuenta con integración de **WhatsApp Contable Broker**. Al enviar la foto del ticket al número de WhatsApp del estudio contable, el bot realiza la extracción inteligente Gemini OCR, clasifica la categoría de gasto y la deposita automáticamente en el registro digital de VMP Studio.
        </p>
      </div>
    </div>
  `,


  faq: `
    <div class="help-section-flow" style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- FAQ 1 -->
      <div class="faq-item" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <h4 style="font-size: 13px; font-weight: 700; color: var(--color-primary); margin-bottom: 6px;">
          ¿Necesitamos pedir el CUIT y Clave Fiscal de TODOS los clientes del estudio contable que nos contrata?
        </h4>
        <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin: 0;">
          <strong>No de forma obligatoria.</strong> Gracias a la delegación de servicios en ARCA, el contador carga **únicamente su propio CUIT y Clave Fiscal** (del Estudio Contable). Con esa única clave, el sistema está legalmente autorizado para descargar masivamente los comprobantes y retenciones de todos los clientes que le hayan delegado permisos.
        </p>
      </div>

      <!-- FAQ 2 -->
      <div class="faq-item" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <h4 style="font-size: 13px; font-weight: 700; color: var(--color-primary); margin-bottom: 6px;">
          ¿Con el CUIT y Clave Fiscal del contador, sabemos todos los datos impositivos de sus clientes?
        </h4>
        <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin: 0;">
          <strong>Sí, pero únicamente si el cliente delegó la representación.</strong> Si el cliente de la PyME no delegó formalmente los servicios (como *Libro de IVA Digital* o *Mis Comprobantes*) al CUIT del contador en ARCA, el bot no podrá ver a esa empresa. La delegación en el Administrador de Relaciones de Clave Fiscal es un requisito técnico indispensable para que ARCA habilite el acceso multi-empresa.
        </p>
      </div>

      <!-- FAQ 3 -->
      <div class="faq-item" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <h4 style="font-size: 13px; font-weight: 700; color: var(--color-primary); margin-bottom: 6px;">
          ¿Qué pasa si un cliente no quiere o no sabe delegar en ARCA?
        </h4>
        <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin: 0;">
          El sistema está preparado para contingencias: el contador (o el cliente) puede descargar los archivos de compras/ventas en formato texto (TXT) o CSV de ARCA y arrastrarlos en nuestra pantalla de **Importación**. La importación de un mes de facturas toma menos de 10 segundos y procesa todos los cálculos al igual que el enlace automatizado.
        </p>
      </div>

      <!-- FAQ 4 -->
      <div class="faq-item" style="padding-bottom: 4px;">
        <h4 style="font-size: 13px; font-weight: 700; color: var(--color-primary); margin-bottom: 6px;">
          ¿Los archivos de firma digital (.crt y .key) del estudio son seguros?
        </h4>
        <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin: 0;">
          <strong>Absolutamente seguros.</strong> El certificado y clave privada cargados por el estudio contable se encriptan bajo estándares bancarios AES-256 en almacenamiento seguro desconectado de internet público. El bot de RPA solo los invoca en el momento exacto de firmar la comunicación con los servidores oficiales de ARCA (WSAA).
        </p>
      </div>

    </div>
  `
};

export async function initAyuda(mainApp) {
  try {
    // Initialize Lucide Icons
    if (window.lucide) window.lucide.createIcons();

    const container = document.getElementById('help-content-container');
    const cardTitle = document.getElementById('help-card-title');
    const searchInput = document.getElementById('help-search-input');

    if (!container) {
      console.warn("Element '#help-content-container' not found in DOM.");
      return;
    }

    // Set default tab content
    let activeTab = 'general';
    
    const updateTabContent = () => {
      if (container) {
        container.innerHTML = TabContents[activeTab] || '';
        if (window.lucide) window.lucide.createIcons({ root: container });
      }
      
      // Bind template copy buttons inside tabs if they exist
      if (activeTab === 'arca') {
        const copyBtn = document.getElementById('btn-copy-template');
        copyBtn?.addEventListener('click', () => {
          const textToCopy = `Hola! Para poder importar tus facturas y retenciones de forma automática a nuestra nueva plataforma contable, te pido que nos delegues el acceso de lectura en ARCA. Es muy fácil, seguro y se hace por única vez:

1. Entrá con tu CUIT y Clave Fiscal a la web de ARCA.
2. Buscá el servicio "Administrador de Relaciones de Clave Fiscal".
3. Hacé clic en "Nueva Relación".
4. Hacé clic en "Buscar" -> seleccioná "ARCA" -> "WebServices".
5. Buscá el servicio: "Libro de IVA Digital".
6. En "Representante", poné nuestro CUIT del Estudio: 30-71938495-2.
7. Confirmá la relación y ¡listo! No hace falta que nos pases tu clave fiscal.`;
          
          navigator.clipboard.writeText(textToCopy).then(() => {
            mainApp.showToast("¡Plantilla copiada al portapapeles!", "success");
          }).catch(err => {
            mainApp.showToast("Error al copiar texto", "error");
          });
        });
      }
    };

    updateTabContent();

    // Handle Tab Switching
    document.querySelectorAll('.help-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.help-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        activeTab = btn.dataset.tab;
        
        const tabIcons = {
          general: 'book-open',
          arca: 'shield-check',
          modulos: 'cpu',
          portal: 'smartphone',
          faq: 'help-circle'
        };

        const tabTitles = {
          general: 'Guía General del Sistema',
          arca: 'Configuración & Enlace ARCA',
          modulos: 'Módulos Normativos 2026',
          portal: 'Portal & Whatsapp Contable',
          faq: 'Preguntas Frecuentes'
        };

        if (cardTitle) {
          cardTitle.innerHTML = `<i data-lucide="${tabIcons[activeTab]}" style="color: var(--color-accent);"></i> ${tabTitles[activeTab]}`;
        }
        updateTabContent();
      });
    });

    // Checklist updates (Supabase o localStorage) & reactive progress
    const chkEstudio = document.getElementById('chk-task-estudio');
    chkEstudio?.addEventListener('change', async (e) => {
      const checked = e.target.checked;
      if (isSupabaseConfigured && supabase) {
        await updateEstudioFieldsAsync({ onboarding_task_estudio: checked });
      } else {
        localStorage.setItem('vmp_task_estudio', checked ? 'true' : 'false');
      }

      // Refresh calculations and update progress bar live
      const companies = (await getCompaniesAsync()) || [];
      const estudio = await getEstudioAsync();
      const t1 = checked;
      const t2 = estudio ? estudio.arca_cert_uploaded : (localStorage.getItem('vmp_arca_cert_uploaded') === 'true');
      const t3 = companies.length > 2;
      const t4 = companies.some(getDelegationActive);
      const t5 = estudio ? estudio.onboarding_import_simulado : (localStorage.getItem('vmp_import_simulated') === 'true');
      const t6 = estudio ? estudio.onboarding_iva_validado : (localStorage.getItem('vmp_iva_validated_Logistica') === 'true' || localStorage.getItem('vmp_iva_validated_Software') === 'true');

      const completed = [t1, t2, t3, t4, t5, t6].filter(Boolean).length;
      const percent = Math.round((completed / 6) * 100);

      const progressBar = document.getElementById('onboarding-progress-bar');
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
      
      // Update number texts
      const textPercent = document.querySelector("span[style*='font-size: 18px']");
      if (textPercent) textPercent.textContent = `${percent}%`;
      
      const textCount = document.querySelector("span[style*='font-size: 11px']");
      if (textCount) textCount.textContent = `${completed} de 6 tareas`;

      // Dynamic style update for the checkbox item borders
      const parentBtn = chkEstudio.closest('.trial-action-btn');
      if (parentBtn) {
        parentBtn.style.borderColor = t1 ? 'var(--color-accent)' : 'var(--border-color)';
        const h5 = parentBtn.querySelector('h5');
        if (h5) h5.style.color = t1 ? 'var(--color-accent)' : 'var(--color-primary)';
      }

      mainApp.showToast(t1 ? "¡Paso 1 completado!" : "Paso 1 desmarcado.", "info");
    });

    // Dynamic search filtering
    searchInput?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (!query) {
        // Restore active tab
        updateTabContent();
        return;
      }

      // Filter in all sections for matches
      let resultsHTML = '<div style="display: flex; flex-direction: column; gap: 16px;">';
      let matchCount = 0;

      // Search inside the FAQ and Modules texts
      const allSearchable = [
        { q: "cuit clave fiscal contador estudio", title: "¿Necesito la clave de todos mis clientes?", desc: "No, la delegación impositiva permite que uses únicamente tu clave fiscal de contador." },
        { q: "delegacion arca relacion", title: "¿Cómo funciona la delegación en ARCA?", desc: "El cliente final entra por única vez a ARCA y delega servicios como Libro de IVA Digital a tu CUIT de estudio." },
        { q: "iva simple f2051 formula", title: "IVA Simple Formulario 2051", desc: "Modulo normativo adaptado al nuevo régimen simplificado. Cruza las actividades declaradas y bloquea liquidación si hay desvíos mayores a $1." },
        { q: "retenciones percepciones sircreb sire", title: "Retenciones y Percepciones - Conciliación 3 fuentes", desc: "Cruza libro diario, SIRE y extracto bancario (SIRCREB) para no perder crédito impositivo." },
        { q: "rt 54 contable balance existencia", title: "Norma Técnica RT 54 Contable", desc: "Panel de balance exprés para micro y pequeñas entidades. Existencia inicial = Inventario × factor de 1.2x. Fórmula: CV = EI + C - EF." },
        { q: "whatsapp celular portal foto ocr", title: "Portal de Clientes & Whatsapp Contable", desc: "El cliente saca foto al ticket de compra, el motor OCR inteligente extrae los datos y lo importa sin intervención manual." }
      ];

      allSearchable.forEach(item => {
        if (item.q.includes(query) || item.title.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query)) {
          matchCount++;
          resultsHTML += `
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 16px; background: #fff; cursor: pointer; transition: all 0.2s;" onclick="window.location.hash='#/studio/ayuda'">
              <h4 style="font-size: 13.5px; font-weight: 700; color: #4f46e5; margin-bottom: 6px;">${item.title}</h4>
              <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin: 0;">${item.desc}</p>
            </div>
          `;
        }
      });

      resultsHTML += '</div>';

      if (matchCount === 0) {
        if (container) {
          container.innerHTML = `
            <div style="text-align: center; padding: 48px 0; color: var(--text-secondary);">
              <i data-lucide="alert-circle" style="width: 40px; height: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
              <h4 style="font-size: 14px; font-weight: 750;">No se encontraron resultados</h4>
              <p style="font-size: 12px; margin-top: 4px;">Probá con otros términos como "cuit", "delegación", "iva", "rt 54" o "whatsapp".</p>
            </div>
          `;
          if (window.lucide) window.lucide.createIcons({ root: container });
        }
      } else {
        if (cardTitle) {
          cardTitle.innerHTML = `<i data-lucide="search" style="color: var(--color-accent);"></i> Resultados de la búsqueda (${matchCount})`;
        }
        if (container) {
          container.innerHTML = resultsHTML;
        }
      }
    });
  } catch (error) {
    console.error("Error in initAyuda:", error);
    mainApp.showToast("Error al inicializar la sección de ayuda: " + error.message, "error");
  }
}
