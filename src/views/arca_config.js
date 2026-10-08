/* -------------------------------------------------------------
   Configuracion > Conexion con ARCA: el sistema genera la clave privada y la
   solicitud de certificado (CSR); el estudio la pega en ARCA con su Clave
   Fiscal, descarga el certificado y lo carga aca.
   ------------------------------------------------------------- */
import { arca, AMBIENTE_LABEL } from '../arca.js';
import { sanitizeInput as esc, validarCUIT } from '../utils.js';

const PASOS = {
  homologacion: `
    <ol style="font-size:12px;line-height:1.6;color:var(--text-secondary);padding-left:18px;margin:8px 0;">
      <li>Ingresá a <strong>arca.gob.ar</strong> con tu Clave Fiscal y abrí el servicio <strong>WSASS – Autogestión Certificados Homologación</strong> (si no aparece, adherilo desde <em>Administrador de Relaciones de Clave Fiscal</em>).</li>
      <li>En <em>Nuevo Certificado</em>, poné un nombre (el alias de abajo) y pegá la solicitud CSR. Tocá <em>Crear DN y obtener certificado</em>.</li>
      <li>Copiá el certificado que te muestra WSASS y pegalo acá abajo.</li>
      <li>En WSASS → <em>Crear autorización a servicio</em>: autorizá ese certificado para <code>wsfe</code> (factura electrónica) y <code>ws_sr_padron_a5</code> (consulta de padrón), con tu CUIT como representado.</li>
    </ol>`,
  produccion: `
    <ol style="font-size:12px;line-height:1.6;color:var(--text-secondary);padding-left:18px;margin:8px 0;">
      <li>Con tu Clave Fiscal, abrí <strong>Administración de Certificados Digitales</strong> → <em>Agregar alias</em> → subí la solicitud (archivo .csr) y descargá el certificado (.crt).</li>
      <li>Cargá ese certificado acá abajo.</li>
      <li>En <strong>Administrador de Relaciones de Clave Fiscal</strong> asociá el certificado (computador fiscal) a los servicios <em>Facturación Electrónica</em> y <em>Consulta de Padrón A5</em>.</li>
      <li>Para facturar en nombre de un cliente, el cliente delega el servicio <em>Facturación Electrónica</em> al CUIT del estudio y el estudio lo asocia a su certificado. El punto de venta del cliente tiene que ser de tipo <em>Web Services</em>.</li>
    </ol>`
};

export function renderArcaPanel() {
  return `
  <div class="card" id="arca-panel">
    <div class="card-header">
      <h3><i data-lucide="shield-check" style="color: var(--color-accent);"></i> Conexión con ARCA</h3>
    </div>
    <div class="card-body">
      <p class="text-secondary" style="font-size:12.5px;line-height:1.5;margin:0 0 12px;">
        El sistema genera tu clave privada y la guarda cifrada en el servidor: nunca se descarga ni se muestra. Vos solo pegás la solicitud en ARCA y cargás el certificado que te devuelve.
        Empezá por <strong>homologación</strong> (pruebas sin validez fiscal) y pasá a producción cuando funcione.
      </p>
      <div style="display:flex;gap:6px;margin-bottom:14px;">
        <button class="btn btn-sm btn-primary arca-tab" data-amb="homologacion">Homologación</button>
        <button class="btn btn-sm btn-outline arca-tab" data-amb="produccion">Producción</button>
      </div>
      <div id="arca-panel-body"><p class="text-secondary" style="font-size:12px;">Cargando estado…</p></div>
    </div>
  </div>`;
}

const fmtFecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '—');

function vistaAmbiente(amb, cred) {
  const input = 'width:100%;border:1px solid var(--border-color);border-radius:6px;padding:8px 10px;font-size:12.5px;box-sizing:border-box;';
  if (!cred) {
    return `
      <p style="font-size:12.5px;margin:0 0 8px;"><strong>Paso 1.</strong> Generá la solicitud de certificado para ${esc(AMBIENTE_LABEL[amb])}.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label style="font-size:11px;font-weight:700;">CUIT del estudio (titular del certificado)</label><input id="arca-cuit" style="${input}" placeholder="20-12345678-6" maxlength="13"></div>
        <div><label style="font-size:11px;font-weight:700;">Alias del certificado</label><input id="arca-alias" style="${input}" value="solucionescontables" maxlength="40"></div>
      </div>
      <button class="btn btn-primary btn-sm" id="arca-generar" style="margin-top:12px;"><i data-lucide="key-round"></i> Generar solicitud (CSR)</button>`;
  }
  if (!cred.tieneCertificado) {
    return `
      <p style="font-size:12.5px;margin:0 0 6px;"><strong>Paso 2.</strong> Solicitud generada para el CUIT <strong>${esc(cred.cuit)}</strong> (alias <code>${esc(cred.alias)}</code>). Llevala a ARCA:</p>
      ${PASOS[amb]}
      <textarea readonly id="arca-csr" style="${input}font-family:monospace;font-size:10.5px;height:110px;">${esc(cred.csr)}</textarea>
      <div style="display:flex;gap:8px;margin:6px 0 14px;">
        <button class="btn btn-outline btn-sm" id="arca-copiar-csr"><i data-lucide="copy"></i> Copiar</button>
        <button class="btn btn-outline btn-sm" id="arca-bajar-csr"><i data-lucide="download"></i> Descargar .csr</button>
      </div>
      <p style="font-size:12.5px;margin:0 0 6px;"><strong>Paso 3.</strong> Pegá el certificado que te dio ARCA (o elegí el archivo .crt):</p>
      <textarea id="arca-cert" style="${input}font-family:monospace;font-size:10.5px;height:90px;" placeholder="-----BEGIN CERTIFICATE-----"></textarea>
      <div style="display:flex;gap:8px;margin-top:6px;align-items:center;flex-wrap:wrap;">
        <input type="file" id="arca-cert-file" accept=".crt,.pem,.cer,.txt" style="font-size:11.5px;">
        <button class="btn btn-primary btn-sm" id="arca-cargar"><i data-lucide="upload"></i> Cargar certificado</button>
        <button class="btn btn-outline btn-sm" id="arca-borrar" style="color:#ef4444;">Empezar de nuevo</button>
      </div>`;
  }
  const vencido = new Date(cred.cert_hasta).getTime() < Date.now();
  const proximo = !vencido && new Date(cred.cert_hasta).getTime() - Date.now() < 30 * 864e5;
  return `
    <div style="background:${vencido ? '#fef2f2' : 'rgba(34,197,94,0.05)'};border:1px solid ${vencido ? '#fecaca' : 'rgba(34,197,94,0.25)'};border-radius:8px;padding:12px 14px;font-size:12.5px;line-height:1.6;">
      <strong>${vencido ? 'Certificado vencido' : 'Certificado cargado'}</strong> · ${esc(AMBIENTE_LABEL[amb])}<br>
      CUIT ${esc(cred.cuit)} · alias <code>${esc(cred.alias)}</code> · emisor ${esc(cred.cert_emisor || '—')}<br>
      Vigente del ${fmtFecha(cred.cert_desde)} al <strong>${fmtFecha(cred.cert_hasta)}</strong>${proximo ? ' <span style="color:#b45309;">(vence pronto: generá uno nuevo)</span>' : ''}
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" id="arca-probar-wsfe"><i data-lucide="plug"></i> Probar factura electrónica</button>
      <button class="btn btn-outline btn-sm" id="arca-probar-padron"><i data-lucide="search"></i> Probar padrón</button>
      <button class="btn btn-outline btn-sm" id="arca-regenerar">Renovar certificado</button>
      <button class="btn btn-outline btn-sm" id="arca-borrar" style="color:#ef4444;">Desconectar</button>
    </div>
    <div id="arca-resultado" style="font-size:12px;margin-top:10px;"></div>`;
}

export async function initArcaPanel(mainApp) {
  const body = document.getElementById('arca-panel-body');
  if (!body) return;
  let ambiente = 'homologacion';
  let estado = [];

  const pintar = () => {
    document.querySelectorAll('.arca-tab').forEach((b) => {
      b.classList.toggle('btn-primary', b.dataset.amb === ambiente);
      b.classList.toggle('btn-outline', b.dataset.amb !== ambiente);
    });
    const cred = estado.find((c) => c.ambiente === ambiente) || null;
    body.innerHTML = vistaAmbiente(ambiente, cred);
    if (window.lucide) window.lucide.createIcons({ root: body });
    enlazar(cred);
  };

  const cargar = async () => {
    try { estado = await arca('estado'); } catch (e) { body.innerHTML = `<p style="color:#b91c1c;font-size:12px;">${esc(e.message)}</p>`; return; }
    pintar();
  };

  const conBoton = async (btn, fn) => {
    const txt = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'Procesando…';
    try { await fn(); } catch (e) { mainApp.showToast(e.message, 'error'); } finally { btn.disabled = false; btn.innerHTML = txt; }
  };

  const enlazar = (cred) => {
    const $ = (id) => document.getElementById(id);
    $('arca-generar')?.addEventListener('click', (e) => conBoton(e.currentTarget, async () => {
      const cuit = $('arca-cuit').value.trim();
      if (!validarCUIT(cuit)) throw new Error('El CUIT no es válido (dígito verificador).');
      await arca('generar_csr', { ambiente, cuit, alias: $('arca-alias').value.trim() });
      mainApp.showToast('Solicitud generada. Seguí los pasos para obtener el certificado.', 'success');
      await cargar();
    }));
    $('arca-copiar-csr')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(cred.csr); mainApp.showToast('Solicitud copiada.', 'success'); }
      catch (e) { $('arca-csr').select(); mainApp.showToast('Copiala con Ctrl/Cmd + C.', 'info'); }
    });
    $('arca-bajar-csr')?.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([cred.csr], { type: 'application/pkcs10' }));
      a.download = `${cred.alias || 'solicitud'}-${ambiente}.csr`;
      document.body.appendChild(a); a.click(); a.remove();
    });
    $('arca-cert-file')?.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (f && f.size < 20000) $('arca-cert').value = await f.text();
    });
    $('arca-cargar')?.addEventListener('click', (e) => conBoton(e.currentTarget, async () => {
      const pem = $('arca-cert').value.trim();
      if (!pem.includes('BEGIN CERTIFICATE')) throw new Error('Pegá el certificado completo, desde -----BEGIN CERTIFICATE-----.');
      const r = await arca('cargar_certificado', { ambiente, certificado: pem });
      mainApp.showToast(`Certificado cargado (vence el ${fmtFecha(r.hasta)}). Probá la conexión.`, 'success');
      await cargar();
    }));
    $('arca-borrar')?.addEventListener('click', (e) => {
      if (!window.confirm('Se borra la clave privada y el certificado de este ambiente. ¿Continuar?')) return;
      conBoton(e.currentTarget, async () => { await arca('borrar_credenciales', { ambiente }); await cargar(); });
    });
    $('arca-regenerar')?.addEventListener('click', (e) => {
      if (!window.confirm('Se genera una clave y solicitud nuevas; el certificado actual deja de usarse hasta que cargues el nuevo. ¿Continuar?')) return;
      conBoton(e.currentTarget, async () => { await arca('generar_csr', { ambiente, cuit: cred.cuit, alias: cred.alias }); await cargar(); });
    });
    const probar = (servicio) => (e) => conBoton(e.currentTarget, async () => {
      const out = $('arca-resultado');
      try {
        const r = await arca('probar', { ambiente, servicio });
        out.innerHTML = `<span style="color:#15803d;">✓ Conectado a ARCA (${esc(servicio === 'padron' ? 'padrón' : 'factura electrónica')}). Ticket de acceso vigente hasta ${esc(new Date(r.expira).toLocaleString('es-AR'))}.</span>`;
      } catch (err) {
        out.innerHTML = `<span style="color:#b91c1c;">✗ ${esc(err.message)}</span>`;
      }
    });
    $('arca-probar-wsfe')?.addEventListener('click', probar('wsfe'));
    $('arca-probar-padron')?.addEventListener('click', probar('padron'));
  };

  document.querySelectorAll('.arca-tab').forEach((b) => b.addEventListener('click', () => { ambiente = b.dataset.amb; pintar(); }));
  await cargar();
}
