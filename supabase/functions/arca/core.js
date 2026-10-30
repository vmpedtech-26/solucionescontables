/* -------------------------------------------------------------
   Nucleo ARCA (ex AFIP): sin dependencias de runtime. Corre igual en la Edge
   Function (Deno) y en los tests (Node). Las funciones criptograficas reciben
   `forge` (node-forge) por parametro.

   Servicios:
   - WSAA (LoginCms): ticket de acceso firmado con CMS/PKCS#7, valido 12 hs.
   - WSFEv1: factura electronica (CAE).
   - ws_sr_padron_a5: consulta de datos de un CUIT.
   ------------------------------------------------------------- */

export const ENDPOINTS = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    padron: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5'
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
    padron: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5'
  }
};

export const SERVICIOS = { wsfe: 'wsfe', padron: 'ws_sr_padron_a5' };

// -------------------------------------------------------------
// Utilidades XML
// -------------------------------------------------------------
export const xmlEscape = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const decodeEntities = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, '&');

/**
 * Parser XML minimo: devuelve un objeto con los nombres de etiqueta sin prefijo
 * de namespace. Etiquetas repetidas -> array; etiquetas solo con texto -> string.
 * Ignora atributos (los servicios de ARCA no los usan para datos).
 */
export function parseXml(xml) {
  const stack = [{ name: '#root', obj: {}, text: '' }];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/\s*([^\s>]+)\s*>|<\s*([^\s/>!?]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  const local = (n) => n.includes(':') ? n.split(':').pop() : n;
  const add = (parent, name, value) => {
    if (Object.prototype.hasOwnProperty.call(parent.obj, name)) {
      const cur = parent.obj[name];
      parent.obj[name] = Array.isArray(cur) ? [...cur, value] : [cur, value];
    } else parent.obj[name] = value;
  };
  let m;
  while ((m = re.exec(xml)) !== null) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2] !== undefined) {
      if (stack.length === 1) continue;
      const node = stack.pop();
      const value = Object.keys(node.obj).length ? node.obj : decodeEntities(node.text.trim());
      add(stack[stack.length - 1], node.name, value);
    } else if (m[3] !== undefined) {
      const name = local(m[3]);
      if (m[5] === '/') add(top, name, '');
      else stack.push({ name, obj: {}, text: '' });
    } else if (m[6] !== undefined) top.text += m[6];
  }
  return stack[0].obj;
}

/** Busca la primera ocurrencia de una etiqueta a cualquier profundidad. */
export function find(obj, name) {
  if (obj === null || typeof obj !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, name)) return obj[name];
  for (const v of Object.values(obj)) {
    const items = Array.isArray(v) ? v : [v];
    for (const it of items) {
      const r = find(it, name);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}

export const asArray = (v) => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v]);

/** Error SOAP (soap:Fault) si lo hay, como { code, message }. */
export function soapFault(xml) {
  const doc = typeof xml === 'string' ? parseXml(xml) : xml;
  const f = find(doc, 'Fault');
  if (!f) return null;
  return { code: String(f.faultcode ?? f.Code ?? ''), message: String(f.faultstring ?? f.Reason ?? 'Error SOAP') };
}

// -------------------------------------------------------------
// WSAA
// -------------------------------------------------------------
/** Fecha en hora argentina (UTC-3) con offset explicito: 2026-10-07T10:00:00-03:00 */
export function horaArgentina(date) {
  const d = new Date(date.getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 19) + '-03:00';
}

export function buildTRA(servicio, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - 10 * 60 * 1000);
  const hasta = new Date(ahora.getTime() + 10 * 60 * 1000);
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<loginTicketRequest version="1.0"><header>' +
    `<uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId>` +
    `<generationTime>${horaArgentina(desde)}</generationTime>` +
    `<expirationTime>${horaArgentina(hasta)}</expirationTime>` +
    `</header><service>${xmlEscape(servicio)}</service></loginTicketRequest>`;
}

/** Firma el TRA como CMS SignedData (contenido incluido), en base64. */
export function firmarTRA(forge, tra, certPem, keyPem) {
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() }
    ]
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

export function loginCmsEnvelope(cmsBase64) {
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">' +
    `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cmsBase64}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
}

/** Devuelve { token, sign, expira } o lanza Error con el mensaje de ARCA. */
export function parseLoginCms(xml) {
  const fault = soapFault(xml);
  if (fault) {
    const err = new Error(traducirErrorWSAA(fault));
    err.code = fault.code;
    throw err;
  }
  const ret = find(parseXml(xml), 'loginCmsReturn');
  if (!ret) throw new Error('Respuesta de WSAA sin ticket de acceso.');
  const ta = typeof ret === 'string' ? parseXml(ret) : ret;
  const token = find(ta, 'token');
  const sign = find(ta, 'sign');
  const expira = find(ta, 'expirationTime');
  if (!token || !sign) throw new Error('El ticket de acceso de WSAA no trae token/sign.');
  return { token, sign, expira: new Date(expira).toISOString() };
}

export function traducirErrorWSAA({ code, message }) {
  const c = String(code).split(':').pop();
  const msgs = {
    'coe.alreadyAuthenticated': 'ARCA ya emitió un ticket de acceso vigente para este certificado y servicio. Esperá unos minutos y reintentá.',
    'cms.cert.blacklist': 'ARCA no reconoce el certificado (no lo emitió ARCA, es de otro ambiente o fue revocado).',
    'cms.cert.untrusted':'ARCA no reconoce el certificado: verificá que lo hayas generado en el ambiente correcto (homologación o producción).',
    'cms.cert.expired': 'El certificado está vencido. Generá uno nuevo.',
    'cms.cert.invalid': 'El certificado no es válido.',
    'cms.sign.invalid': 'La firma no coincide con el certificado: la clave privada no corresponde a este certificado.',
    'xml.source.invalid': 'ARCA rechazó la solicitud de acceso (formato inválido).',
    'coe.notAuthorized': 'El certificado no tiene autorizado este servicio. En ARCA, asociá el servicio al certificado (Administrador de Relaciones o WSASS en homologación).',
    'ns1:cms.cert.notFound': 'Certificado no encontrado en ARCA.'
  };
  return msgs[c] || `ARCA (WSAA): ${message}`;
}

// -------------------------------------------------------------
// Certificados y CSR
// -------------------------------------------------------------
const ascii = (s, max) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9 .,-]/g, '').trim().slice(0, max);

/** Genera clave RSA 2048 y CSR con el formato que pide ARCA. */
export function generarCSR(forge, { cuit, organizacion, alias }) {
  const limpio = String(cuit).replace(/\D/g, '');
  if (!/^\d{11}$/.test(limpio)) throw new Error('CUIT inválido.');
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([
    { name: 'countryName', value: 'AR' },
    { name: 'organizationName', value: ascii(organizacion, 60) || 'Estudio' },
    { name: 'commonName', value: ascii(alias, 60) || 'solucionescontables' },
    { name: 'serialNumber', value: `CUIT ${limpio}` }
  ]);
  csr.sign(keys.privateKey, forge.md.sha256.create());
  return {
    csrPem: forge.pki.certificationRequestToPem(csr),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey)
  };
}

/** Datos del certificado y si corresponde a la clave privada. */
export function infoCertificado(forge, certPem, keyPem = null) {
  let cert;
  try { cert = forge.pki.certificateFromPem(certPem); } catch (e) { throw new Error('El archivo no es un certificado PEM válido (.crt).'); }
  const attr = (list, n) => (list.getField(n) || list.getField({ name: n }) || {}).value || '';
  const serial = attr(cert.subject, 'serialNumber');
  const out = {
    desde: cert.validity.notBefore.toISOString(),
    hasta: cert.validity.notAfter.toISOString(),
    cuit: (serial.match(/\d{11}/) || [''])[0],
    alias: attr(cert.subject, 'CN'),
    emisor: attr(cert.issuer, 'CN'),
    coincideClave: null
  };
  if (keyPem) {
    const key = forge.pki.privateKeyFromPem(keyPem);
    out.coincideClave = cert.publicKey.n.toString(16) === key.n.toString(16);
  }
  return out;
}

// -------------------------------------------------------------
// Padron A5
// -------------------------------------------------------------
export function padronEnvelope({ token, sign, cuitRepresentada, idPersona }) {
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr/">' +
    '<soapenv:Header/><soapenv:Body><a5:getPersona_v2>' +
    `<token>${xmlEscape(token)}</token><sign>${xmlEscape(sign)}</sign>` +
    `<cuitRepresentada>${String(cuitRepresentada).replace(/\D/g, '')}</cuitRepresentada>` +
    `<idPersona>${String(idPersona).replace(/\D/g, '')}</idPersona>` +
    '</a5:getPersona_v2></soapenv:Body></soapenv:Envelope>';
}

/** Normaliza la respuesta del padron a lo que usa la app. */
export function parsePadron(xml) {
  const fault = soapFault(xml);
  if (fault) throw new Error(/no existe/i.test(fault.message) ? 'El CUIT no existe en el padrón de ARCA.' : `ARCA (padrón): ${fault.message}`);
  const p = find(parseXml(xml), 'personaReturn');
  if (!p) throw new Error('El padrón no devolvió datos para ese CUIT.');
  const dg = p.datosGenerales || {};
  const dom = dg.domicilioFiscal || {};
  const rg = p.datosRegimenGeneral || {};
  const mono = p.datosMonotributo || null;
  const impuestos = asArray(rg.impuesto).map((i) => ({ id: Number(i.idImpuesto), descripcion: i.descripcionImpuesto }));
  const actividades = asArray(rg.actividad || mono?.actividadMonotributista).map((a) => ({
    id: a.idActividad, descripcion: a.descripcionActividad, orden: Number(a.orden || 0)
  }));
  let condicionIva = 'Sin determinar';
  if (mono && (mono.categoriaMonotributo || asArray(mono.impuesto).length)) {
    const desc = String(mono.categoriaMonotributo?.descripcionCategoria || '');
    const letra = (desc.match(/\b([A-K])\b/) || [])[1];
    condicionIva = letra ? `Monotributo - Cat ${letra}` : 'Monotributo';
  } else if (impuestos.some((i) => i.id === 30)) condicionIva = 'Responsable Inscripto';
  else if (impuestos.some((i) => i.id === 32)) condicionIva = 'Exento';
  const errores = [
    ...asArray(p.errorConstancia?.error),
    ...asArray(p.errorRegimenGeneral?.error),
    ...asArray(p.errorMonotributo?.error)
  ].map(String);
  return {
    cuit: String(dg.idPersona || ''),
    nombre: dg.razonSocial || [dg.apellido, dg.nombre].filter(Boolean).join(' '),
    tipoPersona: dg.tipoPersona || '',
    estadoClave: dg.estadoClave || '',
    domicilio: {
      direccion: dom.direccion || '',
      localidad: dom.localidad || '',
      provincia: dom.descripcionProvincia || '',
      codigoPostal: dom.codPostal || ''
    },
    condicionIva,
    impuestos,
    actividades,
    errores
  };
}

// -------------------------------------------------------------
// WSFEv1 (factura electronica)
// -------------------------------------------------------------
export const TIPOS_CBTE = {
  1: 'Factura A', 2: 'Nota de Débito A', 3: 'Nota de Crédito A',
  6: 'Factura B', 7: 'Nota de Débito B', 8: 'Nota de Crédito B',
  11: 'Factura C', 12: 'Nota de Débito C', 13: 'Nota de Crédito C'
};
const CLASE_CBTE = { 1: 'A', 2: 'A', 3: 'A', 6: 'B', 7: 'B', 8: 'B', 11: 'C', 12: 'C', 13: 'C' };
const ES_NOTA = [2, 3, 7, 8, 12, 13];
export const ALICUOTAS_WSFE = { 0: 3, 10.5: 4, 21: 5, 27: 6, 5: 8, 2.5: 9 };
export const CONDICION_IVA_RECEPTOR = { 1: 'IVA Responsable Inscripto', 4: 'IVA Sujeto Exento', 5: 'Consumidor Final', 6: 'Responsable Monotributo', 7: 'Sujeto No Categorizado', 8: 'Proveedor del Exterior', 9: 'Cliente del Exterior', 10: 'IVA Liberado – Ley 19.640', 13: 'Monotributista Social', 15: 'IVA No Alcanzado', 16: 'Monotributo Trabajador Independiente Promovido' };
// Condiciones del receptor admitidas por clase de comprobante (RG 5616)
const CONDICIONES_POR_CLASE = { A: [1, 6, 13, 16], B: [4, 5, 7, 8, 9, 10, 15] };

/** Fecha de hoy en Argentina (YYYY-MM-DD); toISOString daria el dia UTC. */
export const hoyAR = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d);

function fechaValida(iso, campo) {
  const s = String(iso ?? '');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!d || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new Error(`${campo}: fecha inválida (usar AAAA-MM-DD).`);
  return s;
}

export function wsfeEnvelope(metodo, cuerpo) {
  return '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">' +
    `<soap:Body><ar:${metodo}>${cuerpo}</ar:${metodo}></soap:Body></soap:Envelope>`;
}

export const wsfeSoapAction = (metodo) => `http://ar.gov.afip.dif.FEV1/${metodo}`;

export function wsfeAuth({ token, sign, cuit }) {
  return `<ar:Auth><ar:Token>${xmlEscape(token)}</ar:Token><ar:Sign>${xmlEscape(sign)}</ar:Sign><ar:Cuit>${String(cuit).replace(/\D/g, '')}</ar:Cuit></ar:Auth>`;
}

/** Errores de negocio de WSFE (<Errors><Err>) como lista de "codigo: mensaje". */
export function wsfeErrores(result) {
  return asArray(result?.Errors?.Err).map((e) => `${e.Code}: ${e.Msg}`);
}

export function ultimoAutorizadoBody(auth, ptoVta, cbteTipo) {
  return wsfeAuth(auth) + `<ar:PtoVta>${Number(ptoVta)}</ar:PtoVta><ar:CbteTipo>${Number(cbteTipo)}</ar:CbteTipo>`;
}

export function parseUltimoAutorizado(xml) {
  const fault = soapFault(xml);
  if (fault) throw new Error(`ARCA (WSFE): ${fault.message}`);
  const r = find(parseXml(xml), 'FECompUltimoAutorizadoResult');
  const errs = wsfeErrores(r);
  if (errs.length) throw new Error(`ARCA (WSFE): ${errs.join(' | ')}`);
  return Number(r?.CbteNro || 0);
}

const yyyymmdd = (iso) => String(iso).slice(0, 10).replace(/-/g, '');
const imp = (n) => (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Valida y calcula importes de un comprobante (factura, nota de debito o de credito).
 * datos: { cbteTipo, concepto, docTipo, docNro, condicionIvaReceptor, fecha,
 *          items: [{ neto, alicuota }] (o neto + alicuota para una sola alicuota),
 *          exento, noGravado, servDesde, servHasta, vtoPago,
 *          cbtesAsoc: [{ tipo, ptoVta, nro, fecha }] | periodoAsoc: { desde, hasta } }
 * Clase C: no discrimina IVA (todo el importe va como neto).
 */
export function prepararFactura(datos) {
  const cbteTipo = Number(datos.cbteTipo);
  if (!TIPOS_CBTE[cbteTipo]) throw new Error('Tipo de comprobante no soportado.');
  const clase = CLASE_CBTE[cbteTipo];
  const esC = clase === 'C';
  const concepto = Number(datos.concepto || 1);
  if (![1, 2, 3].includes(concepto)) throw new Error('Concepto inválido (1 productos, 2 servicios, 3 ambos).');

  // Items por alicuota: se agrupan por tasa (ARCA admite una linea por alicuota)
  const crudos = Array.isArray(datos.items) && datos.items.length ? datos.items : [{ neto: datos.neto, alicuota: datos.alicuota }];
  if (crudos.length > 20) throw new Error('Demasiados renglones de importe.');
  const porTasa = new Map();
  for (const it of crudos) {
    const neto = r2(it.neto);
    if (!(neto >= 0) || !Number.isFinite(neto)) throw new Error('Los importes no pueden ser negativos.');
    if (neto === 0) continue;
    const alicuota = esC ? 0 : Number(it.alicuota);
    if (!esC && !(alicuota in ALICUOTAS_WSFE)) throw new Error('Alícuota de IVA inválida.');
    porTasa.set(alicuota, r2((porTasa.get(alicuota) || 0) + neto));
  }
  const alicuotas = esC ? [] : [...porTasa].map(([alicuota, base]) => ({ alicuota, id: ALICUOTAS_WSFE[alicuota], base, importe: r2(base * alicuota / 100) }));
  const neto = r2([...porTasa.values()].reduce((a, b) => a + b, 0));
  const iva = r2(alicuotas.reduce((a, x) => a + x.importe, 0));
  const exento = esC ? 0 : r2(datos.exento || 0);
  const noGravado = esC ? 0 : r2(datos.noGravado || 0);
  if (exento < 0 || noGravado < 0) throw new Error('Los importes no pueden ser negativos.');
  const total = r2(neto + iva + exento + noGravado);
  if (!(total > 0)) throw new Error('El importe del comprobante debe ser mayor a cero.');
  const alicuota = alicuotas.length === 1 ? alicuotas[0].alicuota : (alicuotas.length ? null : 0);

  const docTipo = Number(datos.docTipo || 99);
  const docNro = String(datos.docNro || '0').replace(/\D/g, '') || '0';
  if (![80, 86, 96, 99].includes(docTipo)) throw new Error('Tipo de documento del receptor inválido.');
  if (docTipo === 80 && docNro.length !== 11) throw new Error('El CUIT del receptor debe tener 11 dígitos.');
  if (docTipo === 96 && !/^\d{7,8}$/.test(docNro)) throw new Error('El DNI del receptor debe tener 7 u 8 dígitos.');
  if (clase === 'A' && docTipo !== 80) throw new Error('Los comprobantes A requieren CUIT del receptor.');
  const condicionIvaReceptor = Number(datos.condicionIvaReceptor || 5);
  if (!CONDICION_IVA_RECEPTOR[condicionIvaReceptor]) throw new Error('Condición frente al IVA del receptor inválida.');
  if (clase !== 'C' && !CONDICIONES_POR_CLASE[clase].includes(condicionIvaReceptor)) {
    throw new Error(`Un comprobante ${clase} no se puede emitir a un receptor "${CONDICION_IVA_RECEPTOR[condicionIvaReceptor]}".`);
  }
  const fecha = datos.fecha ? fechaValida(datos.fecha, 'Fecha') : hoyAR();
  if (concepto !== 1) {
    if (!datos.servDesde || !datos.servHasta || !datos.vtoPago) throw new Error('Para servicios hay que indicar período facturado y vencimiento de pago.');
    fechaValida(datos.servDesde, 'Servicio desde'); fechaValida(datos.servHasta, 'Servicio hasta'); fechaValida(datos.vtoPago, 'Vencimiento de pago');
    if (datos.servHasta < datos.servDesde) throw new Error('El período facturado termina antes de empezar.');
    if (datos.vtoPago < fecha) throw new Error('El vencimiento de pago no puede ser anterior a la fecha de la factura.');
  }

  // Notas de credito y debito: comprobante asociado (o periodo) obligatorio
  let cbtesAsoc = [];
  let periodoAsoc = null;
  if (ES_NOTA.includes(cbteTipo)) {
    cbtesAsoc = (Array.isArray(datos.cbtesAsoc) ? datos.cbtesAsoc : []).slice(0, 10).map((c) => {
      const tipo = Number(c.tipo); const ptoVta = Number(c.ptoVta); const nro = Number(c.nro);
      if (CLASE_CBTE[tipo] !== clase) throw new Error(`El comprobante asociado debe ser de clase ${clase}.`);
      if (!(ptoVta >= 1 && ptoVta <= 99998) || !(nro >= 1 && nro <= 99999999)) throw new Error('Punto de venta o número del comprobante asociado inválido.');
      const f = c.fecha ? fechaValida(c.fecha, 'Fecha del comprobante asociado') : null;
      if (f && f > fecha) throw new Error('El comprobante asociado no puede ser posterior a la nota.');
      return { tipo, ptoVta, nro, fecha: f };
    });
    if (!cbtesAsoc.length && datos.periodoAsoc?.desde && datos.periodoAsoc?.hasta) {
      periodoAsoc = { desde: fechaValida(datos.periodoAsoc.desde, 'Período desde'), hasta: fechaValida(datos.periodoAsoc.hasta, 'Período hasta') };
      if (periodoAsoc.hasta < periodoAsoc.desde) throw new Error('El período asociado termina antes de empezar.');
    }
    if (!cbtesAsoc.length && !periodoAsoc) throw new Error('Indicá la factura a la que corresponde la nota (o el período que ajusta).');
  }

  return { cbteTipo, clase, concepto, esC, neto, alicuota, alicuotas, iva, exento, noGravado, total, docTipo, docNro, condicionIvaReceptor, fecha,
    servDesde: datos.servDesde, servHasta: datos.servHasta, vtoPago: datos.vtoPago, cbtesAsoc, periodoAsoc };
}

/** cuitEmisor: CUIT propio, se informa en cada comprobante asociado. */
export function solicitarCaeBody(auth, ptoVta, numero, f, cuitEmisor = auth.cuit) {
  const servicios = f.concepto !== 1
    ? `<ar:FchServDesde>${yyyymmdd(f.servDesde)}</ar:FchServDesde><ar:FchServHasta>${yyyymmdd(f.servHasta)}</ar:FchServHasta><ar:FchVtoPago>${yyyymmdd(f.vtoPago)}</ar:FchVtoPago>`
    : '';
  const alicuotas = f.alicuotas || (f.esC ? [] : [{ id: ALICUOTAS_WSFE[f.alicuota], base: f.neto, importe: f.iva }]);
  const ivaBlock = !f.esC && f.neto > 0
    ? '<ar:Iva>' + alicuotas.map((a) => `<ar:AlicIva><ar:Id>${a.id}</ar:Id><ar:BaseImp>${imp(a.base)}</ar:BaseImp><ar:Importe>${imp(a.importe)}</ar:Importe></ar:AlicIva>`).join('') + '</ar:Iva>'
    : '';
  const asociados = (f.cbtesAsoc || []).length
    ? '<ar:CbtesAsoc>' + f.cbtesAsoc.map((c) => '<ar:CbteAsoc>' +
        `<ar:Tipo>${Number(c.tipo)}</ar:Tipo><ar:PtoVta>${Number(c.ptoVta)}</ar:PtoVta><ar:Nro>${Number(c.nro)}</ar:Nro>` +
        `<ar:Cuit>${String(cuitEmisor).replace(/\D/g, '')}</ar:Cuit>` +
        (c.fecha ? `<ar:CbteFch>${yyyymmdd(c.fecha)}</ar:CbteFch>` : '') +
        '</ar:CbteAsoc>').join('') + '</ar:CbtesAsoc>'
    : '';
  const periodo = f.periodoAsoc
    ? `<ar:PeriodoAsoc><ar:FchDesde>${yyyymmdd(f.periodoAsoc.desde)}</ar:FchDesde><ar:FchHasta>${yyyymmdd(f.periodoAsoc.hasta)}</ar:FchHasta></ar:PeriodoAsoc>`
    : '';
  return wsfeAuth(auth) +
    '<ar:FeCAEReq>' +
    `<ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${Number(ptoVta)}</ar:PtoVta><ar:CbteTipo>${f.cbteTipo}</ar:CbteTipo></ar:FeCabReq>` +
    '<ar:FeDetReq><ar:FECAEDetRequest>' +
    `<ar:Concepto>${f.concepto}</ar:Concepto><ar:DocTipo>${f.docTipo}</ar:DocTipo><ar:DocNro>${f.docNro}</ar:DocNro>` +
    `<ar:CbteDesde>${numero}</ar:CbteDesde><ar:CbteHasta>${numero}</ar:CbteHasta><ar:CbteFch>${yyyymmdd(f.fecha)}</ar:CbteFch>` +
    `<ar:ImpTotal>${imp(f.total)}</ar:ImpTotal><ar:ImpTotConc>${imp(f.noGravado || 0)}</ar:ImpTotConc><ar:ImpNeto>${imp(f.neto)}</ar:ImpNeto>` +
    `<ar:ImpOpEx>${imp(f.exento || 0)}</ar:ImpOpEx><ar:ImpTrib>0.00</ar:ImpTrib><ar:ImpIVA>${imp(f.iva)}</ar:ImpIVA>` +
    servicios +
    '<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>' +
    `<ar:CondicionIVAReceptorId>${f.condicionIvaReceptor}</ar:CondicionIVAReceptorId>` +
    asociados + ivaBlock + periodo +
    '</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>';
}

/** { resultado: 'A'|'R'|'P', cae, caeVto, observaciones[], errores[] } */
export function parseSolicitarCae(xml) {
  const fault = soapFault(xml);
  if (fault) throw new Error(`ARCA (WSFE): ${fault.message}`);
  const r = find(parseXml(xml), 'FECAESolicitarResult');
  if (!r) throw new Error('Respuesta de WSFE sin resultado.');
  const det = asArray(r.FeDetResp?.FECAEDetResponse)[0] || {};
  const vto = String(det.CAEFchVto || '');
  return {
    resultado: det.Resultado || r.FeCabResp?.Resultado || 'R',
    cae: det.CAE || '',
    caeVto: vto.length === 8 ? `${vto.slice(0, 4)}-${vto.slice(4, 6)}-${vto.slice(6, 8)}` : '',
    observaciones: asArray(det.Observaciones?.Obs).map((o) => `${o.Code}: ${o.Msg}`),
    errores: wsfeErrores(r)
  };
}

export function parsePuntosVenta(xml) {
  const fault = soapFault(xml);
  if (fault) throw new Error(`ARCA (WSFE): ${fault.message}`);
  const r = find(parseXml(xml), 'FEParamGetPtosVentaResult');
  const errs = wsfeErrores(r);
  // 602: "Sin resultados" -> no hay puntos de venta web services dados de alta
  if (errs.length && !errs.every((e) => e.startsWith('602'))) throw new Error(`ARCA (WSFE): ${errs.join(' | ')}`);
  return asArray(r?.ResultGet?.PtoVenta).map((p) => ({
    numero: Number(p.Nro), tipo: p.EmisionTipo, bloqueado: p.Bloqueado === 'S', baja: p.FchBaja && p.FchBaja !== 'NULL' ? p.FchBaja : null
  }));
}

export function parseDummy(xml) {
  const r = find(parseXml(xml), 'FEDummyResult') || {};
  return { app: r.AppServer, db: r.DbServer, auth: r.AuthServer };
}
