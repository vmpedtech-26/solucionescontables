/* -------------------------------------------------------------
   VMP Studio Contable - Resilient Offline-First Sync Database
   ------------------------------------------------------------- */
import { supabase, isSupabaseConfigured, getEstudioId } from './supabase.js';

const DEFAULT_COMPANIES = [
  {
    id: "co-1",
    razon_social: "Transportes Patagónicos S.A.",
    cuit: "30-58472910-9",
    condicion_iva: "Responsable Inscripto",
    tipo: "SRL",
    actividad: "Servicios de Logística y Distribución",
    inicio_actividades: "2018-03-10",
    color: "#0d9488",
    // Convenio Multilateral (IIBB): opera en más de una jurisdicción, por lo que
    // no tributa Ingresos Brutos en régimen local sino distribuido por
    // Coeficiente Unificado (RG CM 03/04) entre las provincias donde factura y gasta.
    jurisdicciones: [
      { provincia: "Neuquén", pctIngresos: 45, pctGastos: 50, alicuotaIIBB: 4.0 },
      { provincia: "Río Negro", pctIngresos: 35, pctGastos: 30, alicuotaIIBB: 3.5 },
      { provincia: "La Pampa", pctIngresos: 20, pctGastos: 20, alicuotaIIBB: 3.0 }
    ]
  },
  {
    id: "co-2",
    razon_social: "TecnoDesarrollos Sur",
    cuit: "20-35849201-4",
    condicion_iva: "Monotributo - Cat H",
    tipo: "Unipersonal",
    actividad: "Desarrollo de Software y Consultoría",
    inicio_actividades: "2021-06-01",
    color: "#52525B"
  },
  {
    id: "co-3",
    razon_social: "Alimentos del Valle S.R.L.",
    cuit: "30-71938495-2",
    condicion_iva: "Responsable Inscripto",
    tipo: "SRL",
    actividad: "Venta Mayorista de Alimentos",
    inicio_actividades: "2015-11-15",
    color: "#16A34A"
  }
];

// Placeholder neutro para el layout cuando una sesion real todavia no tiene
// ninguna empresa cargada (nunca se muestra una empresa demo en modo real).
const EMPTY_COMPANY = {
  id: "", razon_social: "Sin empresa seleccionada", cuit: "-", color: "#94a3b8",
  condicion_iva: "Responsable Inscripto", tipo: "", actividad: "", inicio_actividades: "2000-01-01"
};

const DEFAULT_TRANSACTIONS = {
  "co-1": {
    ventas: [
      { id: "v-1", fecha: "2026-05-20", cliente: "Cervecería Austral", cuit: "30-77443322-9", tipo_comprobante: "Factura A", numero: "0003-00000845", neto: 250000, iva: 52500, total: 302500 },
      { id: "v-2", fecha: "2026-05-18", cliente: "Distribuidora del Neuquén", cuit: "30-55998877-1", tipo_comprobante: "Factura A", numero: "0003-00000846", neto: 480000, iva: 100800, total: 580800 },
      { id: "v-3", fecha: "2026-05-15", cliente: "Consumidor Final", cuit: "00-00000000-0", tipo_comprobante: "Factura B", numero: "0003-00000102", neto: 45000, iva: 9450, total: 54450 },
      // Transporte de pasajeros de larga distancia (>100km): EXENTO de IVA por
      // Art. 7, inc. h, apartado 13 de la Ley de IVA — no es una venta gravada
      // a tasa 0, es una exención real que obliga a prorratear el crédito fiscal
      // de los gastos de uso común (combustible, mantenimiento) entre esta
      // actividad exenta y el transporte de cargas, que sí está gravado.
      { id: "v-8", fecha: "2026-05-27", cliente: "Terminal de Ómnibus Neuquén", cuit: "30-63025874-1", tipo_comprobante: "Factura A", numero: "0003-00000847", neto: 325000, iva: 0, total: 325000, exento: true }
    ],
    compras: [
      { id: "c-1", fecha: "2026-05-22", proveedor: "Combustibles YPF", cuit: "30-50001234-9", tipo_comprobante: "Factura A", numero: "4820-00239481", neto: 180000, iva: 37800, total: 217800, es_activo: false, categoria: "Combustibles" },
      { id: "c-2", fecha: "2026-05-14", proveedor: "Repuestos Comahue", cuit: "30-61928374-2", tipo_comprobante: "Factura A", numero: "0002-00001294", neto: 95000, iva: 19950, total: 114950, es_activo: false, categoria: "Mantenimiento" }
    ]
  },
  "co-2": {
    ventas: [
      { id: "v-4", fecha: "2026-05-24", cliente: "Sinergia Group LLC", cuit: "00-00000000-0", tipo_comprobante: "Factura E (Export.)", numero: "0001-00000012", neto: 1200000, iva: 0, total: 1200000 },
      { id: "v-5", fecha: "2026-05-10", cliente: "Empresa Local S.A.", cuit: "30-11223344-5", tipo_comprobante: "Factura C", numero: "0001-00000045", neto: 350000, iva: 0, total: 350000 }
    ],
    compras: [
      { id: "c-3", fecha: "2026-05-19", proveedor: "Servicios Cloud AWS", cuit: "30-88998899-2", tipo_comprobante: "Factura B", numero: "0934-09827361", neto: 85000, iva: 17850, total: 102850, es_activo: false, categoria: "Tecnología" }
    ]
  },
  "co-3": {
    ventas: [
      // Alícuota 10,5% (canasta básica, venta mayorista) vs 21% (mercadería general) —
      // un distribuidor de alimentos real factura a ambas tasas, no a una sola.
      { id: "v-6", fecha: "2026-05-25", cliente: "Supermercados Todo", cuit: "30-44556677-2", tipo_comprobante: "Factura A", numero: "0001-00004829", neto: 700000, iva: 73500, total: 773500 },
      { id: "v-7", fecha: "2026-05-22", cliente: "Despensa El Sol", cuit: "20-22119988-3", tipo_comprobante: "Factura B", numero: "0001-00002194", neto: 300000, iva: 63000, total: 363000 }
    ],
    compras: [
      { id: "c-4", fecha: "2026-05-18", proveedor: "Molinos Rio de la Plata", cuit: "30-50000543-1", tipo_comprobante: "Factura A", numero: "0104-00092834", neto: 540000, iva: 113400, total: 653400, es_activo: false, categoria: "Materia Prima" }
    ]
  }
};

// -------------------------------------------------------------
// 1. MOTORES DE AUDITORÍA Y ESTADO DE SINCRONIZACIÓN (OUTBOX ENGINE)
// -------------------------------------------------------------
let isSyncingInProgress = false;
let reintentoSync = null;
let listenersRed = false;
let ultimoPull = 0;
let syncStatusCallbacks = [];

export function subscribeSyncStatus(callback) {
  syncStatusCallbacks.push(callback);
  callback(getSyncStatus());
  return () => {
    syncStatusCallbacks = syncStatusCallbacks.filter(c => c !== callback);
  };
}

function updateSyncStatus(status) {
  syncStatusCallbacks.forEach(cb => cb(status));
  window.dispatchEvent(new CustomEvent('vmp_sync_status_change', { detail: status }));
}

export function getSyncStatus() {
  if (!navigator.onLine) {
    return 'offline';
  }
  const queue = getSyncQueue();
  if (queue.length === 0) {
    return 'synced';
  }
  const hasPersistentError = queue.some(item => item.retries >= 5);
  if (hasPersistentError) {
    return 'error';
  }
  return isSyncingInProgress ? 'syncing' : 'pending';
}

function getSyncQueue() {
  try {
    const raw = localStorage.getItem("vmp_studio_sync_queue");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveSyncQueue(queue) {
  localStorage.setItem("vmp_studio_sync_queue", JSON.stringify(queue));
  updateSyncStatus(getSyncStatus());
}

export function enqueueSyncTask(action, payload) {
  const queue = getSyncQueue();
  const task = {
    id: "task-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
    action,
    payload,
    retries: 0,
    timestamp: Date.now()
  };
  queue.push(task);
  saveSyncQueue(queue);
  
  if (isSupabaseConfigured) {
    processSyncQueue();
  }
}

export async function processSyncQueue() {
  if (isSyncingInProgress) return;
  if (!isSupabaseConfigured) return;
  if (!navigator.onLine) {
    updateSyncStatus('offline');
    return;
  }

  const queue = getSyncQueue();
  if (queue.length === 0) {
    updateSyncStatus('synced');
    return;
  }

  isSyncingInProgress = true;
  updateSyncStatus('syncing');
  console.log(`Sync Engine: Procesando Cola Outbox (${queue.length} tareas pendientes)`);

  // La cola se relee de localStorage en cada paso y las tareas se quitan por id:
  // lo que se encole mientras hay un envio en curso no se pisa.
  const quitarTarea = (id) => saveSyncQueue(getSyncQueue().filter((t) => t.id !== id));
  let task;
  while ((task = getSyncQueue()[0])) {
    if (!navigator.onLine) {
      updateSyncStatus('offline');
      break;
    }

    try {
      if (task.action === 'save_company') {
        await pushCompanyToSupabase(task.payload.company, task.payload.isNew);
      } else if (task.action === 'insert_transaction') {
        await pushTransactionToSupabase(task.payload.companyId, task.payload.type, task.payload.item);
      } else {
        console.warn("Sync Engine: Acción de tarea desconocida:", task.action);
      }
      quitarTarea(task.id);
    } catch (err) {
      console.error(`Sync Engine: Falló la tarea ${task.id}:`, err);
      const retries = (task.retries || 0) + 1;

      if (retries >= 5) {
        // Una tarea que falla siempre (ej. CUIT invalido) no puede frenar al
        // resto: se aparta en vmp_sync_failed y la cola sigue.
        console.error(`Sync Engine: Tarea ${task.id} descartada tras 5 intentos.`);
        try {
          const fallidas = JSON.parse(localStorage.getItem('vmp_sync_failed') || '[]');
          fallidas.push({ ...task, retries, error: String(err?.message || err) });
          localStorage.setItem('vmp_sync_failed', JSON.stringify(fallidas.slice(-200)));
        } catch (e) { /* almacenamiento lleno: se descarta igual */ }
        quitarTarea(task.id);
        updateSyncStatus('error');
        continue;
      }

      saveSyncQueue(getSyncQueue().map((t) => (t.id === task.id ? { ...t, retries } : t)));
      const backoff = Math.min(30000, Math.pow(2, retries) * 1000);
      console.log(`Sync Engine: Reintento programado en ${backoff}ms`);
      // Un solo reintento pendiente a la vez
      clearTimeout(reintentoSync);
      reintentoSync = setTimeout(processSyncQueue, backoff);

      isSyncingInProgress = false;
      return;
    }
  }

  isSyncingInProgress = false;
  updateSyncStatus(getSyncStatus());
}

/**
 * Borra del navegador los datos del estudio (empresas, comprobantes, cola,
 * claves) al cerrar sesion o eliminar la cuenta. Antes intenta enviar lo
 * pendiente para no perder cargas hechas sin conexion.
 */
export async function limpiarDatosLocales() {
  if (isSupabaseConfigured && supabase && getSyncQueue().length) {
    try { await processSyncQueue(); } catch (e) { /* lo que quede se descarta */ }
  }
  Object.keys(localStorage)
    .filter((k) => k.startsWith('vmp_') && k !== 'vmp_supabase_url' && k !== 'vmp_supabase_anon_key')
    .forEach((k) => localStorage.removeItem(k));
  ultimoPull = 0;
}

// -------------------------------------------------------------
// 2. INICIALIZACIÓN Y SINCRONIZACIÓN DE PULL (DESDE LA NUBE)
// -------------------------------------------------------------
export function initMockDB() {
  // Con backend real nunca se siembran empresas/comprobantes demo: la unica
  // fuente de verdad es Supabase y el cache local arranca vacio.
  const realMode = isSupabaseConfigured && !!supabase;
  if (!localStorage.getItem("vmp_studio_companies")) {
    localStorage.setItem("vmp_studio_companies", JSON.stringify(realMode ? [] : DEFAULT_COMPANIES));
  }
  if (!localStorage.getItem("vmp_studio_transactions")) {
    localStorage.setItem("vmp_studio_transactions", JSON.stringify(realMode ? {} : DEFAULT_TRANSACTIONS));
  }
  if (!localStorage.getItem("vmp_studio_active_co")) {
    localStorage.setItem("vmp_studio_active_co", realMode ? "" : "co-1");
  }
  if (!localStorage.getItem("vmp_studio_sync_queue")) {
    localStorage.setItem("vmp_studio_sync_queue", "[]");
  }

  // initMockDB corre en cada lectura: los listeners se registran una sola vez
  // y la descarga desde Supabase se limita a una cada 30 s.
  if (listenersRed) {
    if (isSupabaseConfigured && Date.now() - ultimoPull > 30000) { ultimoPull = Date.now(); pullFromSupabase(); }
    return;
  }
  listenersRed = true;
  ultimoPull = Date.now();

  // Vincular eventos globales de red para sincronización resiliente
  window.addEventListener('online', () => {
    console.log("Sync Engine: Dispositivo online. Reanudando sincronización...");
    processSyncQueue();
  });
  window.addEventListener('offline', () => {
    console.log("Sync Engine: Dispositivo offline. Sincronización en pausa.");
    updateSyncStatus('offline');
  });

  if (isSupabaseConfigured) {
    pullFromSupabase();
    processSyncQueue();
  }
}

async function pullFromSupabase() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    console.log("Sync Engine: Descargando datos actualizados de Supabase...");

    const { data: dbCompanies, error: coError } = await supabase
      .from('empresas')
      .select('*')
      .eq('estudio_id', (await getEstudioId()) || user.id);

    if (coError) throw coError;

    if (dbCompanies && dbCompanies.length === 0) {
      // Sin empresas en la nube: no se conserva el cache de otra sesion
      localStorage.setItem("vmp_studio_companies", "[]");
      localStorage.setItem("vmp_studio_transactions", "{}");
    } else if (dbCompanies && dbCompanies.length > 0) {
      localStorage.setItem("vmp_studio_companies", JSON.stringify(dbCompanies));
      
      const coIds = dbCompanies.map(c => c.id);
      const { data: dbTxs, error: txError } = await supabase
        .from('transacciones')
        .select('*')
        .in('empresa_id', coIds);

      if (txError) throw txError;

      const transactionsMap = {};
      coIds.forEach(id => {
        transactionsMap[id] = { ventas: [], compras: [] };
      });

      if (dbTxs) {
        dbTxs.forEach(t => {
          const typeKey = t.tipo;
          if (transactionsMap[t.empresa_id]) {
            transactionsMap[t.empresa_id][typeKey].push({
              ...t,
              neto: Number(t.neto),
              iva: Number(t.iva),
              total: Number(t.total)
            });
          }
        });
      }

      // Lo cargado localmente que todavia esta en la cola no se pierde
      getSyncQueue().filter((task) => task.action === 'insert_transaction').forEach(({ payload }) => {
        const lista = transactionsMap[payload.companyId]?.[payload.type];
        if (lista && !lista.some((x) => x.id === payload.item.id)) lista.unshift(payload.item);
      });

      localStorage.setItem("vmp_studio_transactions", JSON.stringify(transactionsMap));
      console.log("Sync Engine: Pull y refresco local exitoso!");
    }
  } catch (err) {
    console.error("Sync Engine: Error en pull de Supabase:", err);
  }
}

// -------------------------------------------------------------
// 3. OPERACIONES CRUD CON RESPUESTA DE UI INMEDIATA (OPTIMISTA)
// -------------------------------------------------------------
export function getCompanies() {
  initMockDB();
  try {
    const raw = localStorage.getItem("vmp_studio_companies");
    const data = JSON.parse(raw);
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (e) {
    console.error("Error al leer empresas locales:", e);
  }
  // Con backend real nunca se muestran las empresas demo
  return (isSupabaseConfigured && supabase) ? [] : DEFAULT_COMPANIES;
}

export function saveCompany(company) {
  const cos = getCompanies();
  let isNew = false;
  
  if (company.id) {
    const idx = cos.findIndex(c => c.id === company.id);
    if (idx !== -1) cos[idx] = company;
  } else {
    isNew = true;
    company.id = "co-" + crypto.randomUUID();
    cos.push(company);
    
    try {
      const txs = JSON.parse(localStorage.getItem("vmp_studio_transactions")) || {};
      txs[company.id] = { ventas: [], compras: [] };
      localStorage.setItem("vmp_studio_transactions", JSON.stringify(txs));
    } catch (e) {
      console.error("Error inicializando mapa transaccional local:", e);
    }
  }
  
  localStorage.setItem("vmp_studio_companies", JSON.stringify(cos));

  // Encolar de forma resiliente la tarea en background sync
  enqueueSyncTask('save_company', { company, isNew });

  window.dispatchEvent(new CustomEvent('vmp_db_updated', { detail: { companyId: company.id, type: 'company', item: company } }));

  return company;
}

// -------------------------------------------------------------
// 3b. CAPA ASÍNCRONA REAL (Supabase como fuente de verdad) — Capa 1 de
// migración: solo empresas y transacciones. El resto de las vistas sigue
// usando las funciones sync de arriba sin cambios hasta la próxima capa.
// -------------------------------------------------------------
export async function getCompaniesAsync() {
  if (!isSupabaseConfigured || !supabase) return getCompanies();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return getCompanies();

    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .eq('estudio_id', (await getEstudioId()) || user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    localStorage.setItem("vmp_studio_companies", JSON.stringify(data));
    return data;
  } catch (e) {
    console.error("Error trayendo empresas de Supabase:", e);
    return getCompanies();
  }
}

/**
 * Elimina una empresa del estudio. Con Supabase, la base borra en cascada todos
 * sus registros; los archivos de Storage se borran aparte (no cascadean).
 */
export async function deleteCompanyAsync(companyId) {
  if (!companyId) throw new Error('Empresa inválida.');
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: archivos } = await supabase.storage.from('comprobantes').list(companyId, { limit: 1000 });
      const rutas = (archivos || []).map((f) => `${companyId}/${f.name}`);
      for (let i = 0; i < rutas.length; i += 100) {
        await supabase.storage.from('comprobantes').remove(rutas.slice(i, i + 100));
      }
    } catch (e) {
      console.error('No se pudieron borrar los archivos de la empresa:', e);
    }
    const { error } = await supabase.from('empresas').delete().eq('id', companyId);
    if (error) throw error;
  }
  const cos = (getCompanies() || []).filter((c) => c.id !== companyId);
  localStorage.setItem('vmp_studio_companies', JSON.stringify(cos));
  try {
    const txs = JSON.parse(localStorage.getItem('vmp_studio_transactions')) || {};
    delete txs[companyId];
    localStorage.setItem('vmp_studio_transactions', JSON.stringify(txs));
  } catch (e) { /* cache local opcional */ }
  if (localStorage.getItem('vmp_studio_active_co') === companyId) {
    localStorage.setItem('vmp_studio_active_co', cos[0]?.id || '');
  }
  window.dispatchEvent(new CustomEvent('vmp_db_updated', { detail: { companyId, type: 'company_deleted' } }));
}

export async function saveCompanyAsync(company) {
  if (!isSupabaseConfigured || !supabase) return saveCompany(company);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado.');

  const isNew = !company.id;
  if (isNew) company.id = "co-" + crypto.randomUUID();

  const payload = {
    id: company.id,
    estudio_id: (await getEstudioId()) || user.id,
    razon_social: company.razon_social,
    cuit: company.cuit,
    tipo: company.tipo,
    condicion_iva: company.condicion_iva,
    actividad: company.actividad || '',
    inicio_actividades: company.inicio_actividades,
    color: company.color,
    delegation_active: company.delegation_active || false
  };
  if (company.domicilio) payload.domicilio = String(company.domicilio).slice(0, 200);
  if (company.iibb) payload.iibb = String(company.iibb).slice(0, 30);

  const { data, error } = await supabase.from('empresas').upsert(payload).select().single();
  if (error) throw error;

  const cos = getCompanies().filter(c => c.id !== data.id);
  cos.push(data);
  localStorage.setItem("vmp_studio_companies", JSON.stringify(cos));

  if (isNew) {
    try {
      const txs = JSON.parse(localStorage.getItem("vmp_studio_transactions")) || {};
      txs[data.id] = { ventas: [], compras: [] };
      localStorage.setItem("vmp_studio_transactions", JSON.stringify(txs));
    } catch (e) {
      console.error("Error inicializando mapa transaccional local:", e);
    }
  }

  window.dispatchEvent(new CustomEvent('vmp_db_updated', { detail: { companyId: data.id, type: 'company', item: data } }));

  return data;
}

export async function getActiveCompanyAsync() {
  if (!isSupabaseConfigured || !supabase) return getActiveCompany();

  const cos = await getCompaniesAsync();
  const id = getActiveCompanyId();
  let found = cos.find(c => c.id === id);

  if (!found && cos.length > 0) {
    found = cos[0];
    setActiveCompanyId(found.id);
  }

  // null es un resultado válido: un estudio real recién registrado empieza
  // sin ninguna empresa cargada (a diferencia del sandbox, que siempre trae
  // "co-1" sembrado). Los callers de esta función deben contemplar ese caso.
  return found || null;
}

// Actualiza columnas puntuales de una empresa (flags de estado fiscal: IVA
// validado, F.2051 presentado, inputs de RT 54, etc.) sin pasar por el
// upsert completo de saveCompanyAsync. `fields` usa los nombres de columna
// reales de la tabla "empresas" (snake_case).
export async function updateEmpresaFieldsAsync(companyId, fields) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('empresas').update(fields).eq('id', companyId);
    if (error) throw error;
    return;
  }
  const cos = getCompanies();
  const idx = cos.findIndex(c => c.id === companyId);
  if (idx !== -1) {
    cos[idx] = { ...cos[idx], ...fields };
    localStorage.setItem("vmp_studio_companies", JSON.stringify(cos));
  }
}

// Deja en el cache local solo la empresa vinculada al cliente final logueado,
// para que el layout (que lee el cache de forma sincrona) no muestre otra.
export async function syncClienteCompanyCache() {
  const cliente = await getClienteFinalAsync();
  if (!cliente) return null;
  const { data } = await supabase.from('empresas').select('*').eq('id', cliente.empresa_id).single();
  if (!data) return null;
  localStorage.setItem("vmp_studio_companies", JSON.stringify([data]));
  localStorage.setItem("vmp_studio_active_co", data.id);
  return data;
}

// Lee la fila del estudio logueado (perfil ARCA, checklist de onboarding).
// Devuelve null en modo sandbox o si todavía no hay sesión real.
export async function getEstudioAsync() {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('estudios').select('*').eq('id', (await getEstudioId()) || user.id).single();
  if (error) return null;
  return data;
}

// Lee el vínculo cliente-final del usuario logueado (empresa_id concreto).
// Devuelve null en modo sandbox, si no hay sesión, o si la cuenta no es un
// cliente final (es un estudio, o una cuenta huérfana sin vínculo).
export async function getClienteFinalAsync() {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('clientes_finales').select('*').eq('id', user.id).single();
  if (error) return null;
  return data;
}

// Actualiza columnas puntuales del estudio logueado (arca_model_type,
// onboarding_*, etc.), análogo a updateEmpresaFieldsAsync pero a nivel estudio.
export async function updateEstudioFieldsAsync(fields) {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('estudios').update(fields).eq('id', (await getEstudioId()) || user.id);
  if (error) throw error;
}

async function pushCompanyToSupabase(company, isNew) {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  const studioId = (await getEstudioId()) || (user ? user.id : '00000000-0000-0000-0000-000000000000');

  const payload = {
    id: company.id,
    estudio_id: studioId,
    razon_social: company.razon_social,
    cuit: company.cuit,
    tipo: company.tipo,
    condicion_iva: company.condicion_iva,
    actividad: company.actividad || '',
    inicio_actividades: company.inicio_actividades,
    color: company.color,
    delegation_active: company.delegation_active || false
  };

  const { error } = await supabase.from('empresas').upsert(payload);
  if (error) throw error;
}

export function getActiveCompanyId() {
  initMockDB();
  return localStorage.getItem("vmp_studio_active_co") || ((isSupabaseConfigured && supabase) ? '' : 'co-1');
}

export function getActiveCompany() {
  try {
    const id = getActiveCompanyId();
    const cos = getCompanies();
    const found = cos.find(c => c.id === id);
    if (found) return found;
    
    if (cos.length > 0) {
      localStorage.setItem("vmp_studio_active_co", cos[0].id);
      return cos[0];
    }
  } catch (e) {
    console.error("Error cargando empresa activa, reintentando...", e);
  }
  if (isSupabaseConfigured && supabase) return EMPTY_COMPANY;
  return DEFAULT_COMPANIES[0];
}

export function setActiveCompanyId(id) {
  localStorage.setItem("vmp_studio_active_co", id);
  window.dispatchEvent(new CustomEvent('vmp_db_updated', { detail: { companyId: id, type: 'active_company' } }));
}

export function getTransactions(companyId) {
  initMockDB();
  try {
    const raw = localStorage.getItem("vmp_studio_transactions");
    const txs = JSON.parse(raw);
    if (txs && txs[companyId]) {
      return txs[companyId];
    }
  } catch (e) {
    console.error("Error al parsear transacciones de localStorage:", e);
  }
  if (isSupabaseConfigured && supabase) return { ventas: [], compras: [] };
  return DEFAULT_TRANSACTIONS[companyId] || { ventas: [], compras: [] };
}

export function addTransaction(companyId, type, item) {
  const txs = JSON.parse(localStorage.getItem("vmp_studio_transactions"));
  if (!txs[companyId]) txs[companyId] = { ventas: [], compras: [] };
  
  if (!item.id) {
    item.id = (type === "ventas" ? "v-" : "c-") + Date.now() + Math.floor(Math.random() * 1000);
  }
  
  // Evitar duplicados
  const exists = txs[companyId][type].some(tx => tx.id === item.id || (tx.numero === item.numero && tx.fecha === item.fecha));
  if (exists) {
    console.warn("DB local: Comprobante duplicado omitido:", item.numero);
    return item;
  }

  txs[companyId][type].unshift(item);
  localStorage.setItem("vmp_studio_transactions", JSON.stringify(txs));

  // Registrar encolamiento seguro de sincronización en background
  enqueueSyncTask('insert_transaction', { companyId, type, item });

  window.dispatchEvent(new CustomEvent('vmp_db_updated', { detail: { companyId, type, item } }));

  return item;
}

async function pushTransactionToSupabase(companyId, type, item) {
  if (!supabase) return;
  const payload = {
    id: item.id,
    empresa_id: companyId,
    tipo: type,
    fecha: item.fecha,
    tipo_comprobante: item.tipo_comprobante,
    numero: item.numero,
    proveedor: item.proveedor || null,
    cliente: item.cliente || null,
    cuit: item.cuit,
    neto: item.neto,
    iva: item.iva,
    total: item.total,
    es_activo: item.es_activo || false,
    categoria: item.categoria || 'General',
    exento: !!item.exento
  };
  conCamposExtra(payload, item);

  const { error } = await insertarTransaccion(payload);
  // 23505: ya se habia insertado en un intento anterior cuya respuesta se perdio
  if (error && error.code !== '23505') throw error;
}

// Campos de la migracion 2026-10-31 (alicuotas, exentos, no gravados, otros
// tributos, comprobante asociado): solo se envian si vienen cargados y, si la
// base todavia no tiene esas columnas, se reintenta sin ellos.
const CAMPOS_EXTRA = ['alicuotas', 'importe_exento', 'importe_no_gravado', 'otros_tributos', 'cbte_asoc'];
function conCamposExtra(payload, item) {
  CAMPOS_EXTRA.forEach((k) => {
    const v = item[k];
    if (v !== undefined && v !== null && v !== 0 && v !== '' && !(Array.isArray(v) && !v.length)) payload[k] = v;
  });
  return payload;
}
async function insertarTransaccion(payload, conSelect = false) {
  const ejecutar = (p) => (conSelect ? supabase.from('transacciones').insert(p).select().single() : supabase.from('transacciones').insert(p));
  let res = await ejecutar(payload);
  const faltaColumna = res.error && (res.error.code === 'PGRST204' || res.error.code === '42703');
  if (faltaColumna && CAMPOS_EXTRA.some((k) => k in payload)) {
    const reducido = { ...payload };
    CAMPOS_EXTRA.forEach((k) => delete reducido[k]);
    res = await ejecutar(reducido);
  }
  return res;
}

export async function getTransactionsAsync(companyId) {
  if (!isSupabaseConfigured || !supabase) return getTransactions(companyId);

  try {
    const { data, error } = await supabase
      .from('transacciones')
      .select('*')
      .eq('empresa_id', companyId)
      .order('fecha', { ascending: false });

    if (error) throw error;

    const result = { ventas: [], compras: [] };
    data.forEach(t => {
      result[t.tipo].push({
        ...t,
        // PostgREST devuelve las columnas NUMERIC como strings, no numbers.
        neto: Number(t.neto),
        iva: Number(t.iva),
        total: Number(t.total)
      });
    });

    const allTxs = JSON.parse(localStorage.getItem("vmp_studio_transactions") || '{}');
    allTxs[companyId] = result;
    localStorage.setItem("vmp_studio_transactions", JSON.stringify(allTxs));

    return result;
  } catch (e) {
    console.error("Error trayendo transacciones de Supabase:", e);
    return getTransactions(companyId);
  }
}

// opciones.silencioso: no avisa a la UI (las importaciones masivas redibujan una sola vez)
export async function addTransactionAsync(companyId, type, item, opciones = {}) {
  if (!isSupabaseConfigured || !supabase) return addTransaction(companyId, type, item);

  if (!item.id) {
    item.id = (type === "ventas" ? "v-" : "c-") + Date.now() + Math.floor(Math.random() * 1000);
  }

  const payload = {
    id: item.id,
    empresa_id: companyId,
    tipo: type,
    fecha: item.fecha,
    tipo_comprobante: item.tipo_comprobante,
    numero: item.numero,
    proveedor: item.proveedor || null,
    cliente: item.cliente || null,
    cuit: item.cuit,
    neto: item.neto,
    iva: item.iva,
    total: item.total,
    es_activo: item.es_activo || false,
    categoria: item.categoria || 'General',
    exento: !!item.exento
  };
  conCamposExtra(payload, item);

  const { data, error } = await insertarTransaccion(payload, true);
  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya existe un comprobante con ese número para este punto de venta.');
    }
    throw error;
  }

  const result = { ...data, neto: Number(data.neto), iva: Number(data.iva), total: Number(data.total) };

  const allTxs = JSON.parse(localStorage.getItem("vmp_studio_transactions") || '{}');
  if (!allTxs[companyId]) allTxs[companyId] = { ventas: [], compras: [] };
  allTxs[companyId][type].unshift(result);
  localStorage.setItem("vmp_studio_transactions", JSON.stringify(allTxs));

  if (!opciones.silencioso) window.dispatchEvent(new CustomEvent('vmp_db_updated', { detail: { companyId, type, item: result } }));

  return result;
}
