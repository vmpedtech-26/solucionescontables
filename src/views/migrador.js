/* -------------------------------------------------------------
   Migrador de sistemas: importa clientes (empresas) y comprobantes
   desde planillas de Tango, Bejerman, Holistor o Excel guardadas como
   CSV. Detecta columnas, deja corregir el mapeo, valida cada fila y no
   repite lo que ya esta cargado.
   ------------------------------------------------------------- */
import { getCompaniesAsync, saveCompanyAsync, addTransactionAsync, getTransactionsAsync } from '../db/mockdb.js';
import { CAMPOS, leerTabla, autoMapear, convertirEmpresa, convertirComprobante, claveComprobante } from '../domain/migrador.js';
import { sanitizeInput as esc, fmt } from '../utils.js';

const CONDICIONES = ['Responsable Inscripto', 'Monotributo - Cat A', 'Exento'];
const TIPOS = ['SRL', 'SA', 'SAS', 'Unipersonal', 'Sucesion Indivisa'];
const COLORES = ['#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#4f46e5'];

const estado = { resultado: '', destino: 'empresas', empresaId: '', libro: 'ventas', tabla: null, mapa: {}, archivo: '', defaults: { condicion_iva: 'Responsable Inscripto', tipo: '' } };

export function renderMigrador() {
  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Migrador de sistemas</h1>
      <p class="view-subtitle">Traé tus clientes y comprobantes desde Tango, Bejerman, Holistor o cualquier planilla de Excel.</p>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px;">
    <div class="card-header"><h3><i data-lucide="list-checks"></i> 1. Qué vas a importar</h3></div>
    <div class="card-body" style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <label class="mig-op" style="display:flex;gap:8px;align-items:center;border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;cursor:pointer;font-size:13px;">
          <input type="radio" name="mig-destino" value="empresas"> <span><strong>Clientes del estudio</strong><br><small style="color:var(--text-secondary);">Razón social, CUIT, condición de IVA…</small></span></label>
        <label class="mig-op" style="display:flex;gap:8px;align-items:center;border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;cursor:pointer;font-size:13px;">
          <input type="radio" name="mig-destino" value="comprobantes"> <span><strong>Comprobantes de un cliente</strong><br><small style="color:var(--text-secondary);">Libro de ventas o de compras</small></span></label>
      </div>
      <div id="mig-dest-comp" style="display:none;gap:10px;flex-wrap:wrap;">
        <div class="form-group" style="margin:0;"><label class="form-label" for="mig-empresa">Cliente</label><select class="form-select" id="mig-empresa"></select></div>
        <div class="form-group" style="margin:0;"><label class="form-label" for="mig-libro">Libro</label>
          <select class="form-select" id="mig-libro"><option value="ventas">Ventas (emitidos)</option><option value="compras">Compras (recibidos)</option></select></div>
      </div>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px;">
    <div class="card-header"><h3><i data-lucide="upload-cloud"></i> 2. Archivo</h3></div>
    <div class="card-body">
      <label for="mig-archivo" style="display:flex;flex-direction:column;align-items:center;gap:8px;border:2px dashed var(--border-color);border-radius:12px;padding:28px;cursor:pointer;text-align:center;">
        <i data-lucide="file-spreadsheet" style="width:28px;height:28px;color:var(--color-accent);"></i>
        <strong id="mig-archivo-nombre" style="font-size:14px;">Elegí el archivo CSV o TXT</strong>
        <span style="font-size:12px;color:var(--text-secondary);">Separado por punto y coma, coma o tabulación. Si lo tenés en Excel: Archivo → Guardar como → CSV.</span>
        <input type="file" id="mig-archivo" accept=".csv,.txt,text/csv,text/plain" style="display:none;">
      </label>
      <details style="margin-top:12px;font-size:12.5px;color:var(--text-secondary);">
        <summary style="cursor:pointer;font-weight:600;">Cómo exportar desde cada sistema</summary>
        <ul style="margin:8px 0 0;padding-left:18px;line-height:1.6;">
          <li><strong>Tango Gestión:</strong> Clientes → Consulta → exportar a Excel; Subdiario de IVA Ventas/Compras → exportar a Excel. Después guardalo como CSV.</li>
          <li><strong>Bejerman:</strong> Listados → Clientes / Libro IVA → salida a archivo (Excel o texto delimitado).</li>
          <li><strong>Holistor:</strong> Sujetos → exportar; IVA → Libro IVA → exportar a planilla.</li>
          <li><strong>Planilla propia:</strong> una fila por cliente o comprobante, con títulos en la primera fila.</li>
        </ul>
      </details>
    </div>
  </div>

  <div id="mig-paso3" style="display:none;">
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><h3><i data-lucide="columns-3"></i> 3. Columnas</h3><span id="mig-sep" style="font-size:12px;color:var(--text-secondary);"></span></div>
      <div class="card-body">
        <p style="font-size:12.5px;color:var(--text-secondary);margin:0 0 12px;">Las detectamos solas. Corregí las que no correspondan.</p>
        <div id="mig-mapa" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;"></div>
        <div id="mig-defaults" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--border-color);gap:12px;flex-wrap:wrap;">
          <div class="form-group" style="margin:0;"><label class="form-label" for="mig-def-iva">Condición de IVA si no viene</label>
            <select class="form-select" id="mig-def-iva">${CONDICIONES.map((c) => `<option>${c}</option>`).join('')}</select></div>
          <div class="form-group" style="margin:0;"><label class="form-label" for="mig-def-tipo">Tipo societario si no se deduce</label>
            <select class="form-select" id="mig-def-tipo"><option value="">SRL</option>${TIPOS.filter((t) => t !== 'SRL').map((t) => `<option>${t}</option>`).join('')}</select></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3><i data-lucide="scan-search"></i> 4. Revisión</h3>
        <button class="btn btn-primary btn-sm" id="mig-importar"><i data-lucide="download"></i> Importar</button></div>
      <div class="card-body">
        <div id="mig-resumen" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;"></div>
        <div id="mig-resultado"></div>
        <div style="overflow-x:auto;"><table class="table" style="font-size:12px;min-width:640px;"><thead id="mig-thead"></thead><tbody id="mig-tbody"></tbody></table></div>
        <p id="mig-mas" style="font-size:12px;color:var(--text-secondary);"></p>
      </div>
    </div>
  </div>`;
}

export async function initMigrador(mainApp) {
  const root = document.getElementById('view-root');
  const $ = (s) => root.querySelector(s);
  let empresas = await getCompaniesAsync();
  let existentes = new Set();
  let filasConvertidas = [];

  $('#mig-empresa').innerHTML = empresas.length
    ? empresas.map((e) => `<option value="${esc(e.id)}">${esc(e.razon_social)}</option>`).join('')
    : '<option value="">Primero importá o cargá clientes</option>';
  if (!estado.empresaId && empresas[0]) estado.empresaId = empresas[0].id;
  $('#mig-empresa').value = estado.empresaId;
  $('#mig-libro').value = estado.libro;
  root.querySelector(`input[name=mig-destino][value=${estado.destino}]`).checked = true;

  const pintarDestino = () => {
    $('#mig-dest-comp').style.display = estado.destino === 'comprobantes' ? 'flex' : 'none';
    $('#mig-defaults').style.display = estado.destino === 'empresas' ? 'flex' : 'none';
    root.querySelectorAll('.mig-op').forEach((l) => { l.style.borderColor = l.querySelector('input').checked ? 'var(--color-accent)' : 'var(--border-color)'; });
  };

  const cargarExistentes = async () => {
    if (estado.destino === 'empresas') {
      empresas = await getCompaniesAsync();
      existentes = new Set(empresas.map((e) => String(e.cuit).replace(/\D/g, '')));
    } else if (estado.empresaId) {
      const txs = await getTransactionsAsync(estado.empresaId);
      existentes = new Set((txs?.[estado.libro] || []).map(claveComprobante));
    } else existentes = new Set();
  };

  const clave = (v) => (estado.destino === 'empresas' ? String(v.cuit).replace(/\D/g, '') : claveComprobante(v));

  const convertir = () => {
    const vistos = new Set();
    filasConvertidas = estado.tabla.filas.map((fila, i) => {
      const r = estado.destino === 'empresas'
        ? convertirEmpresa(fila, estado.mapa, { condicion_iva: estado.defaults.condicion_iva, tipo: estado.defaults.tipo || 'SRL' })
        : convertirComprobante(fila, estado.mapa);
      const k = clave(r.valor);
      r.fila = i + 1;
      r.duplicado = !r.errores.length && (existentes.has(k) ? 'ya cargado' : vistos.has(k) ? 'repetido en el archivo' : '');
      if (!r.errores.length) vistos.add(k);
      return r;
    });
  };

  const pintarMapa = () => {
    const opciones = `<option value="-1">— No está —</option>${estado.tabla.encabezados.map((e, i) => `<option value="${i}">${esc(e || `Columna ${i + 1}`)}</option>`).join('')}`;
    $('#mig-mapa').innerHTML = CAMPOS[estado.destino].map((c) => `
      <div class="form-group" style="margin:0;"><label class="form-label" for="mig-c-${c.id}">${esc(c.nombre)}${c.requerido ? ' *' : ''}</label>
        <select class="form-select mig-col" id="mig-c-${c.id}" data-campo="${c.id}" style="${c.requerido && estado.mapa[c.id] < 0 ? 'border-color:#ef4444;' : ''}">${opciones}</select></div>`).join('');
    root.querySelectorAll('.mig-col').forEach((s) => {
      s.value = String(estado.mapa[s.dataset.campo] ?? -1);
      s.addEventListener('change', () => { estado.mapa[s.dataset.campo] = Number(s.value); pintarMapa(); revisar(); });
    });
  };

  const revisar = () => {
    convertir();
    const faltan = CAMPOS[estado.destino].filter((c) => c.requerido && estado.mapa[c.id] < 0).map((c) => c.nombre);
    const ok = filasConvertidas.filter((r) => !r.errores.length && !r.duplicado);
    const conError = filasConvertidas.filter((r) => r.errores.length);
    const dup = filasConvertidas.filter((r) => r.duplicado);
    const conAviso = ok.filter((r) => r.avisos.length);
    const chip = (n, txt, color) => `<span style="padding:6px 12px;border-radius:999px;font-size:12.5px;font-weight:600;background:${color}14;color:${color};border:1px solid ${color}40;">${n} ${txt}</span>`;
    $('#mig-resumen').innerHTML = faltan.length
      ? `<span style="color:#dc2626;font-size:13px;font-weight:600;">Falta elegir: ${esc(faltan.join(', '))}</span>`
      : chip(ok.length, 'listos para importar', '#16a34a') + chip(conAviso.length, 'con avisos', '#d97706') + chip(conError.length, 'con errores (no se importan)', '#dc2626') + chip(dup.length, 'ya cargados o repetidos', '#64748b');
    const btn = $('#mig-importar');
    btn.disabled = !!faltan.length || !ok.length || (estado.destino === 'comprobantes' && !estado.empresaId);

    const cols = estado.destino === 'empresas'
      ? [['razon_social', 'Razón social'], ['cuit', 'CUIT'], ['condicion_iva', 'IVA'], ['tipo', 'Tipo'], ['inicio_actividades', 'Inicio']]
      : [['fecha', 'Fecha'], ['tipo_comprobante', 'Tipo'], ['numero', 'Número'], ['nombre', 'Cliente / proveedor'], ['cuit', 'CUIT'], ['neto', 'Neto'], ['iva', 'IVA'], ['total', 'Total']];
    const num = new Set(['neto', 'iva', 'total']);
    $('#mig-thead').innerHTML = `<tr><th>Fila</th>${cols.map(([, t]) => `<th class="${num.has(t.toLowerCase()) ? 'text-right' : ''}">${t}</th>`).join('')}<th>Estado</th></tr>`;
    const mostrar = filasConvertidas.slice(0, 100);
    $('#mig-tbody').innerHTML = mostrar.map((r) => `<tr style="${r.errores.length ? 'background:#fef2f2;' : r.duplicado ? 'opacity:.55;' : ''}">
      <td>${r.fila}</td>
      ${cols.map(([k]) => `<td class="${num.has(k) ? 'text-right' : ''}">${num.has(k) ? fmt(r.valor[k]) : esc(r.valor[k] ?? '')}</td>`).join('')}
      <td style="font-size:11.5px;">${r.errores.length ? `<span style="color:#dc2626;">${esc(r.errores.join('; '))}</span>`
        : r.duplicado ? esc(r.duplicado) : r.avisos.length ? `<span style="color:#b45309;">${esc(r.avisos.join('; '))}</span>` : '<span style="color:#16a34a;">OK</span>'}</td></tr>`).join('');
    $('#mig-mas').textContent = filasConvertidas.length > 100 ? `Se muestran las primeras 100 de ${filasConvertidas.length} filas.` : '';
  };

  const decodificar = (buf) => {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { return new TextDecoder('windows-1252').decode(buf); } // Tango y Bejerman exportan en ANSI
  };

  const procesarArchivo = async (archivo) => {
    if (!archivo) return;
    if (archivo.size > 15 * 1024 * 1024) { mainApp.showToast('El archivo supera 15 MB. Dividilo por año.', 'error'); return; }
    if (/\.xlsx?$/i.test(archivo.name)) { mainApp.showToast('Guardá la planilla como CSV (Archivo → Guardar como → CSV) y subí ese archivo.', 'error'); return; }
    try {
      estado.tabla = leerTabla(decodificar(await archivo.arrayBuffer()));
    } catch (e) { mainApp.showToast(e.message, 'error'); return; }
    if (!estado.tabla.filas.length) { mainApp.showToast('El archivo no tiene filas de datos.', 'error'); return; }
    estado.archivo = archivo.name;
    estado.mapa = autoMapear(estado.tabla.encabezados, estado.destino);
    $('#mig-archivo-nombre').textContent = `${archivo.name} · ${estado.tabla.filas.length} filas`;
    $('#mig-sep').textContent = `Separador: ${{ ';': 'punto y coma', ',': 'coma', '\t': 'tabulación' }[estado.tabla.separador]}`;
    $('#mig-paso3').style.display = 'block';
    estado.resultado = '';
    $('#mig-resultado').innerHTML = '';
    await cargarExistentes();
    pintarMapa();
    revisar();
    if (window.lucide) window.lucide.createIcons({ root });
  };

  const rehacer = async () => {
    pintarDestino();
    if (!estado.tabla) return;
    estado.mapa = autoMapear(estado.tabla.encabezados, estado.destino);
    await cargarExistentes();
    pintarMapa();
    revisar();
  };

  root.querySelectorAll('input[name=mig-destino]').forEach((r) => r.addEventListener('change', () => { estado.destino = r.value; rehacer(); }));
  $('#mig-empresa').addEventListener('change', (e) => { estado.empresaId = e.target.value; rehacer(); });
  $('#mig-libro').addEventListener('change', (e) => { estado.libro = e.target.value; rehacer(); });
  $('#mig-def-iva').addEventListener('change', (e) => { estado.defaults.condicion_iva = e.target.value; if (estado.tabla) revisar(); });
  $('#mig-def-tipo').addEventListener('change', (e) => { estado.defaults.tipo = e.target.value; if (estado.tabla) revisar(); });
  $('#mig-archivo').addEventListener('change', (e) => procesarArchivo(e.target.files[0]));

  $('#mig-importar').addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    const lote = filasConvertidas.filter((r) => !r.errores.length && !r.duplicado);
    const destino = estado.destino === 'empresas' ? `${lote.length} clientes` : `${lote.length} comprobantes de ${estado.libro} en ${empresas.find((e) => e.id === estado.empresaId)?.razon_social || ''}`;
    if (!window.confirm(`Se van a importar ${destino}. ¿Continuar?`)) return;
    boton.disabled = true;
    const errores = [];
    let ok = 0;
    for (const [n, r] of lote.entries()) {
      boton.textContent = `Importando ${n + 1} de ${lote.length}…`;
      try {
        if (estado.destino === 'empresas') {
          await saveCompanyAsync({ ...r.valor, color: COLORES[n % COLORES.length] });
        } else {
          const { nombre, ...tx } = r.valor;
          await addTransactionAsync(estado.empresaId, estado.libro, { ...tx, [estado.libro === 'ventas' ? 'cliente' : 'proveedor']: nombre || null }, { silencioso: true });
        }
        ok++;
      } catch (e) {
        errores.push(`Fila ${r.fila}: ${/ya existe/i.test(e.message) ? 'ya estaba cargado' : e.message}`);
      }
    }
    boton.innerHTML = '<i data-lucide="download"></i> Importar';
    if (window.lucide) window.lucide.createIcons({ root: boton });
    estado.resultado = `<div style="margin-bottom:12px;padding:12px 14px;border-radius:8px;font-size:12.5px;line-height:1.5;background:${errores.length ? '#fff7ed' : '#f0fdf4'};">
      <strong>Se importaron ${ok} de ${lote.length}.</strong>${errores.length ? `<br>${errores.slice(0, 20).map(esc).join('<br>')}${errores.length > 20 ? `<br>…y ${errores.length - 20} más.` : ''}` : ''}</div>`;
    // Guardar empresas re-dibuja la pantalla: el resultado queda en el estado
    if ($('#mig-resultado')) $('#mig-resultado').innerHTML = estado.resultado;
    window.dispatchEvent(new CustomEvent('vmp_db_updated', { detail: { companyId: estado.empresaId, type: estado.destino } }));
    mainApp.showToast(`Importación terminada: ${ok} de ${lote.length}.`, errores.length ? 'warning' : 'success');
    await cargarExistentes();
    revisar();
    if (estado.destino === 'empresas') {
      empresas = await getCompaniesAsync();
      $('#mig-empresa').innerHTML = empresas.map((e) => `<option value="${esc(e.id)}">${esc(e.razon_social)}</option>`).join('');
      if (!estado.empresaId && empresas[0]) estado.empresaId = empresas[0].id;
      $('#mig-empresa').value = estado.empresaId;
    }
  });

  pintarDestino();
  if (estado.tabla) { await cargarExistentes(); pintarMapa(); revisar(); $('#mig-paso3').style.display = 'block'; $('#mig-resultado').innerHTML = estado.resultado || ''; $('#mig-archivo-nombre').textContent = `${estado.archivo} · ${estado.tabla.filas.length} filas`; }
}
