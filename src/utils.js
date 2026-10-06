/* -------------------------------------------------------------
   VMP Studio Contable — Shared Utilities
   ------------------------------------------------------------- */

// ═══════════════════════════════════════════════════════════════
// SECURITY UTILITIES — cybersecurity-sc skill (REQ-9, REQ-10)
// ═══════════════════════════════════════════════════════════════

/**
 * Escapa caracteres HTML peligrosos para prevenir XSS.
 * SIEMPRE usar cuando se interpolen datos de usuario en innerHTML.
 * @param {string|number|null|undefined} str
 * @returns {string} Texto con entidades HTML escapadas
 */
export function sanitizeInput(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitiza campos de exportación CSV/TXT para prevenir CSV injection.
 * Los prefijos peligrosos (=, +, -, @, TAB, CR) se neutralizan con apóstrofe.
 * @param {string|number|null|undefined} str
 * @returns {string}
 */
export function sanitizeCSV(str) {
  if (str === null || str === undefined) return '';
  const s = String(str).trim();
  // Neutralizar prefijos de fórmula de Excel (EDGE-5)
  if (/^[=+\-@\t\r\n|]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

// ═══════════════════════════════════════════════════════════════


/**
 * Formatea un número como moneda argentina.
 * @param {number} n
 * @param {number} decimals
 * @returns {string}
 */
export function fmt(n, decimals = 2) {
  if (typeof n !== 'number' || isNaN(n)) return '0,00';
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) como DD/MM/YYYY.
 * @param {string} isoDate
 * @returns {string}
 */
export function fmtDate(isoDate) {
  if (!isoDate) return '';
  return isoDate.split('-').reverse().join('/');
}

/**
 * Retorna el último dígito de un CUIT limpio.
 * @param {string} cuit  Formato XX-XXXXXXXX-X o XXXXXXXXXXX
 * @returns {number}
 */
export function cuitLastDigit(cuit) {
  const clean = cuit.replace(/-/g, '');
  return parseInt(clean.slice(-1), 10);
}

/**
 * Valida un CUIT/CUIL argentino mediante algoritmo Módulo 11.
 * @param {string} cuit
 * @returns {boolean}
 */
export function validarCUIT(cuit) {
  const clean = cuit.replace(/[^0-9]/g, '');
  if (clean.length !== 11) return false;
  
  const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean[i], 10) * factors[i];
  }
  
  let calculated = 11 - (sum % 11);
  if (calculated === 11) calculated = 0;
  if (calculated === 10) calculated = 9;
  
  const digit = parseInt(clean[10], 10);
  return calculated === digit;
}


/**
 * Calendario de vencimientos ARCA según terminación de CUIT.
 * Devuelve los días de vencimiento del mes siguiente para cada obligación.
 * @param {string} cuit
 * @returns {Object}
 */
export function getVencimientos(cuit) {
  const term = cuitLastDigit(cuit);
  const ivaMap = {
    0: { dia: 18, alt: 20 }, 1: { dia: 18, alt: 20 },
    2: { dia: 19, alt: 21 }, 3: { dia: 19, alt: 21 },
    4: { dia: 20, alt: 22 }, 5: { dia: 20, alt: 22 },
    6: { dia: 21, alt: 23 }, 7: { dia: 21, alt: 23 },
    8: { dia: 22, alt: 24 }, 9: { dia: 22, alt: 24 },
  };
  const autonomosMap = {
    0: { dia: 5 }, 1: { dia: 5 }, 2: { dia: 5 }, 3: { dia: 5 },
    4: { dia: 6 }, 5: { dia: 6 }, 6: { dia: 6 },
    7: { dia: 7 }, 8: { dia: 7 }, 9: { dia: 7 },
  };
  const sussMap = {
    0: { dia: 9 }, 1: { dia: 9 }, 2: { dia: 9 }, 3: { dia: 9 },
    4: { dia: 10 }, 5: { dia: 10 }, 6: { dia: 10 },
    7: { dia: 13 }, 8: { dia: 13 }, 9: { dia: 13 },
  };
  return {
    iva: ivaMap[term] || { dia: 20, alt: 22 },
    autonomos: autonomosMap[term] || { dia: 6 },
    suss: sussMap[term] || { dia: 10 },
    casasParticulares: { dia: 10 },
    monotributo: { dia: 20 },
  };
}

/**
 * Determina la categoría RT 54 en base a ingresos anuales.
 * Umbrales base oct-2022 reexpresados por coeficiente inflacionario.
 * El coeficiente se actualiza manualmente por ejercicio.
 * @param {number} ingresosAnuales  Moneda homogénea reexpresada.
 * @returns {'pequena'|'mediana'|'restante'}
 */
export const RT54_COEF = 18.4; // Coeficiente inflacionario acumulado base oct/22
export const RT54_BASE_MEDIANA  = 650_000_000;   // Base oct 2022
export const RT54_BASE_RESTANTE = 3_250_000_000; // Base oct 2022

export function categorizarRT54(ingresosAnuales) {
  const umbralMediana  = RT54_BASE_MEDIANA  * RT54_COEF;
  const umbralRestante = RT54_BASE_RESTANTE * RT54_COEF;
  if (ingresosAnuales <= umbralMediana)  return 'pequena';
  if (ingresosAnuales <= umbralRestante) return 'mediana';
  return 'restante';
}

/**
 * Descarga un archivo de texto en el navegador.
 * @param {string} filename
 * @param {string} content
 * @param {string} mimeType
 */
export function downloadFile(filename, content, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Renderiza una capa de previsualización bloqueada para venta/marketing (Sales Teaser).
 * @param {string} childHTML El contenido HTML original a empañar.
 * @param {string} title Título del beneficio premium.
 * @param {string} description Descripción corta del valor del módulo.
 * @returns {string} HTML con el overlay y desenfoque aplicados.
 */
export function renderPremiumTeaser(childHTML, title, description) {
  // Si el administrador activó la licencia temporalmente para revisión
  const isUnlocked = localStorage.getItem('vmp_premium_unlocked') === 'true';
  if (isUnlocked) {
    return childHTML;
  }

  return `
  <div class="locked-container" style="width: 100%; min-height: 520px; display: flex; flex-direction: column;">
    <div class="locked-blur" style="flex-grow: 1;">
      ${childHTML}
    </div>
    <div class="premium-lock-overlay">
      <div class="premium-lock-card">
        <div class="premium-lock-icon" data-premium-unlock style="cursor: pointer;" title="Acceso de Administración">
          <i data-lucide="lock" style="width: 24px; height: 24px;"></i>
        </div>
        <h3 style="font-size: 17px; font-weight: 800; color: var(--text-primary); margin: 0;">${title}</h3>
        <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; margin: 0; max-width: 360px;">
          ${description}
        </p>
        <div style="background: rgba(13, 148, 136, 0.03); border: 1px solid rgba(13, 148, 136, 0.12); padding: 12px; border-radius: 6px; width: 100%; text-align: left; font-size: 11px; line-height: 1.4; color: var(--text-secondary);">
          💡 <strong>Módulo Premium:</strong> Esta herramienta avanzada está disponible únicamente para clientes con licencia activa de **Soluciones Contables**.
        </div>
        <button class="btn btn-primary" onclick="alert('Soluciones Contables\\n\\n📞 WhatsApp: +54 299 673-1487\\n✉️ Email: administracion@vmp-edtech.com')" style="width: 100%; background: var(--color-accent); border-color: var(--color-accent); font-weight: 700; margin-top: 4px; padding: 10px; border-radius: 6px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i data-lucide="phone" style="width: 16px; height: 16px;"></i> Contactar para Activar Licencia
        </button>
      </div>
    </div>
  </div>
  `;
}

/**
 * Descarga el IPC mensual desde la API de ArgentinaDatos y compila la serie de índices históricos
 * acumulados en localStorage.
 * @returns {Promise<Object>} Diccionario { "YYYY-MM": valorIndex }
 */
export async function fetchAndCompileIPC() {
  const url = "https://api.argentinadatos.com/v1/finanzas/indices/inflacion";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Datos inválidos devueltos por la API");
  }

  // Ordenar cronológicamente (ascendente)
  const sorted = [...data].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const indices = {};
  
  // Buscar el índice correspondiente a Diciembre 2025 para usar como ancla de 1500.0
  const dec2025Index = sorted.findIndex(item => item.fecha.startsWith("2025-12"));
  
  if (dec2025Index !== -1) {
    const baseVal = 1500.0;
    const baseKey = sorted[dec2025Index].fecha.substring(0, 7);
    indices[baseKey] = baseVal;
    
    // Compilar hacia adelante (forward compounding)
    for (let i = dec2025Index + 1; i < sorted.length; i++) {
      const prevKey = sorted[i - 1].fecha.substring(0, 7);
      const currKey = sorted[i].fecha.substring(0, 7);
      const rate = sorted[i].valor;
      indices[currKey] = indices[prevKey] * (1 + rate / 100);
    }
    
    // Compilar hacia atrás (backward compounding)
    for (let i = dec2025Index - 1; i >= 0; i--) {
      const nextKey = sorted[i + 1].fecha.substring(0, 7);
      const currKey = sorted[i].fecha.substring(0, 7);
      const rateNext = sorted[i + 1].valor;
      indices[currKey] = indices[nextKey] / (1 + rateNext / 100);
    }
  } else {
    // Si no encuentra Diciembre 2025, empieza desde el primero con base 100.0
    let currentVal = 100.0;
    if (sorted.length > 0) {
      const firstKey = sorted[0].fecha.substring(0, 7);
      indices[firstKey] = currentVal;
      for (let i = 1; i < sorted.length; i++) {
        const prevKey = sorted[i - 1].fecha.substring(0, 7);
        const currKey = sorted[i].fecha.substring(0, 7);
        const rate = sorted[i].valor;
        indices[currKey] = indices[prevKey] * (1 + rate / 100);
      }
    }
  }
  
  localStorage.setItem("vmp_ipc_indices", JSON.stringify(indices));
  return indices;
}

