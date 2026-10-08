import { describe, it, expect } from 'vitest';
import forge from 'node-forge';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseXml, find, buildTRA, firmarTRA, generarCSR, infoCertificado, parseLoginCms,
  padronEnvelope, parsePadron, prepararFactura, solicitarCaeBody, parseSolicitarCae,
  parseUltimoAutorizado, parsePuntosVenta, horaArgentina
} from '../supabase/functions/arca/core.js';

// Certificado autofirmado para probar la firma (en ARCA lo emite la AC de ARCA)
function certDePrueba(keyPem) {
  const key = forge.pki.privateKeyFromPem(keyPem);
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.setRsaPublicKey(key.n, key.e);
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 2 * 365 * 864e5);
  const attrs = [{ name: 'commonName', value: 'prueba' }, { name: 'serialNumber', value: 'CUIT 20123456786' }];
  cert.setSubject(attrs);
  cert.setIssuer([{ name: 'commonName', value: 'Computadores Test' }]);
  cert.sign(key, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

const { csrPem, keyPem } = generarCSR(forge, { cuit: '20-12345678-6', organizacion: 'Estudio Contable Neuquén', alias: 'Soluciones Contables' });
const certPem = certDePrueba(keyPem);

describe('CSR para ARCA', () => {
  it('tiene subject con C=AR, O, CN y serialNumber CUIT', () => {
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    expect(csr.verify()).toBe(true);
    const f = (n) => csr.subject.getField(n).value;
    expect(f('C')).toBe('AR');
    expect(f('O')).toBe('Estudio Contable Neuquen');
    expect(f('CN')).toBe('Soluciones Contables');
    expect(csr.subject.getField({ name: 'serialNumber' }).value).toBe('CUIT 20123456786');
    expect(csr.publicKey.n.bitLength()).toBe(2048);
  });
  it('rechaza CUIT inválido', () => {
    expect(() => generarCSR(forge, { cuit: '123', organizacion: 'x', alias: 'y' })).toThrow();
  });
});

describe('Certificado', () => {
  it('lee vigencia, CUIT y verifica que coincida con la clave', () => {
    const info = infoCertificado(forge, certPem, keyPem);
    expect(info.cuit).toBe('20123456786');
    expect(info.coincideClave).toBe(true);
    expect(info.emisor).toBe('Computadores Test');
    const otra = generarCSR(forge, { cuit: '20123456786', organizacion: 'x', alias: 'y' }).keyPem;
    expect(infoCertificado(forge, certPem, otra).coincideClave).toBe(false);
  });
  it('rechaza texto que no es certificado', () => {
    expect(() => infoCertificado(forge, 'hola')).toThrow(/certificado/);
  });
});

describe('WSAA', () => {
  it('TRA con ventana de ±10 minutos en hora argentina', () => {
    const ahora = new Date('2026-10-07T15:00:00Z');
    const tra = buildTRA('wsfe', ahora);
    expect(tra).toContain('<service>wsfe</service>');
    expect(tra).toContain('<generationTime>2026-10-07T11:50:00-03:00</generationTime>');
    expect(tra).toContain('<expirationTime>2026-10-07T12:10:00-03:00</expirationTime>');
    expect(horaArgentina(ahora)).toBe('2026-10-07T12:00:00-03:00');
  });

  it('firma CMS válida (verificada con OpenSSL) y con el TRA adentro', () => {
    const tra = buildTRA('wsfe');
    const cms = firmarTRA(forge, tra, certPem, keyPem);
    const dir = mkdtempSync(join(tmpdir(), 'arca-'));
    writeFileSync(join(dir, 'cms.der'), Buffer.from(cms, 'base64'));
    writeFileSync(join(dir, 'cert.pem'), certPem);
    const out = execFileSync('openssl', ['cms', '-verify', '-inform', 'DER', '-in', join(dir, 'cms.der'), '-noverify', '-certfile', join(dir, 'cert.pem')], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    expect(out).toBe(tra);
  });

  it('lee el ticket de acceso de la respuesta', () => {
    const ta = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><loginTicketResponse version="1.0"><header><source>CN=wsaahomo</source><destination>SERIALNUMBER=CUIT 20123456786</destination><uniqueId>1</uniqueId><generationTime>2026-10-07T10:00:00.000-03:00</generationTime><expirationTime>2026-10-07T22:00:00.000-03:00</expirationTime></header><credentials><token>PD94bWwg</token><sign>abc+/=</sign></credentials></loginTicketResponse>';
    const esc = ta.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const soap = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><loginCmsResponse xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov"><loginCmsReturn>${esc}</loginCmsReturn></loginCmsResponse></soapenv:Body></soapenv:Envelope>`;
    const r = parseLoginCms(soap);
    expect(r.token).toBe('PD94bWwg');
    expect(r.sign).toBe('abc+/=');
    expect(r.expira).toBe('2026-10-08T01:00:00.000Z');
  });

  it('traduce los errores de WSAA', () => {
    const fault = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultcode xmlns:ns1="http://xml.apache.org/axis/">ns1:coe.alreadyAuthenticated</faultcode><faultstring>El CEE ya posee un TA valido para el acceso al WSN solicitado</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>';
    expect(() => parseLoginCms(fault)).toThrow(/ticket de acceso vigente/);
  });
});

describe('Padrón A5', () => {
  it('arma el pedido con token, sign y CUITs limpios', () => {
    const x = padronEnvelope({ token: 'T<', sign: 'S', cuitRepresentada: '20-12345678-6', idPersona: '30-71928371-9' });
    expect(x).toContain('<token>T&lt;</token>');
    expect(x).toContain('<cuitRepresentada>20123456786</cuitRepresentada>');
    expect(x).toContain('<idPersona>30719283719</idPersona>');
  });
  it('normaliza responsable inscripto con domicilio y actividades', () => {
    const xml = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:getPersona_v2Response xmlns:ns2="http://a5.soap.ws.server.puc.sr/"><personaReturn>
      <datosGenerales><domicilioFiscal><codPostal>8300</codPostal><descripcionProvincia>NEUQUEN</descripcionProvincia><direccion>AV ARGENTINA 100</direccion><localidad>NEUQUEN</localidad></domicilioFiscal><estadoClave>ACTIVO</estadoClave><idPersona>30719283719</idPersona><razonSocial>METALURGICA ANDINA SA</razonSocial><tipoPersona>JURIDICA</tipoPersona></datosGenerales>
      <datosRegimenGeneral><actividad><descripcionActividad>FABRICACION DE PRODUCTOS METALICOS</descripcionActividad><idActividad>259999</idActividad><orden>1</orden></actividad><impuesto><descripcionImpuesto>GANANCIAS SOCIEDADES</descripcionImpuesto><idImpuesto>10</idImpuesto></impuesto><impuesto><descripcionImpuesto>IVA</descripcionImpuesto><idImpuesto>30</idImpuesto></impuesto></datosRegimenGeneral>
    </personaReturn></ns2:getPersona_v2Response></soap:Body></soap:Envelope>`;
    const p = parsePadron(xml);
    expect(p.nombre).toBe('METALURGICA ANDINA SA');
    expect(p.condicionIva).toBe('Responsable Inscripto');
    expect(p.estadoClave).toBe('ACTIVO');
    expect(p.domicilio.provincia).toBe('NEUQUEN');
    expect(p.actividades[0].id).toBe('259999');
  });
  it('detecta monotributo y su categoría', () => {
    const xml = `<Envelope><Body><getPersona_v2Response><personaReturn><datosGenerales><apellido>PEREZ</apellido><nombre>CARLOS</nombre><estadoClave>ACTIVO</estadoClave><idPersona>20358492014</idPersona></datosGenerales><datosMonotributo><categoriaMonotributo><descripcionCategoria>D LOCACIONES DE SERVICIO</descripcionCategoria><idCategoria>23</idCategoria></categoriaMonotributo><impuesto><idImpuesto>20</idImpuesto></impuesto></datosMonotributo></personaReturn></getPersona_v2Response></Body></Envelope>`;
    const p = parsePadron(xml);
    expect(p.nombre).toBe('PEREZ CARLOS');
    expect(p.condicionIva).toBe('Monotributo - Cat D');
  });
});

describe('WSFEv1', () => {
  const auth = { token: 'T', sign: 'S', cuit: '20-12345678-6' };

  it('Factura B a consumidor final: IVA 21% discriminado', () => {
    const f = prepararFactura({ cbteTipo: 6, concepto: 1, docTipo: 99, docNro: 0, condicionIvaReceptor: 5, fecha: '2026-10-07', neto: 1234.56, alicuota: 21 });
    expect(f.iva).toBe(259.26);
    expect(f.total).toBe(1493.82);
    const body = parseXml(`<r>${solicitarCaeBody(auth, 3, 151, f)}</r>`);
    expect(find(body, 'CbteDesde')).toBe('151');
    expect(find(body, 'PtoVta')).toBe('3');
    expect(find(body, 'CbteFch')).toBe('20261007');
    expect(find(body, 'ImpTotal')).toBe('1493.82');
    expect(find(body, 'ImpIVA')).toBe('259.26');
    expect(find(body, 'AlicIva').Id).toBe('5');
    expect(find(body, 'CondicionIVAReceptorId')).toBe('5');
    expect(find(body, 'Cuit')).toBe('20123456786');
  });

  it('Factura C (monotributo): sin IVA ni bloque de alícuotas', () => {
    const f = prepararFactura({ cbteTipo: 11, concepto: 2, docTipo: 99, condicionIvaReceptor: 5, neto: 5000, servDesde: '2026-10-01', servHasta: '2026-10-31', vtoPago: '2026-11-10' });
    expect(f.iva).toBe(0);
    expect(f.total).toBe(5000);
    const xml = solicitarCaeBody(auth, 1, 1, f);
    expect(xml).not.toContain('<ar:Iva>');
    expect(xml).toContain('<ar:FchServDesde>20261001</ar:FchServDesde>');
  });

  it('valida datos obligatorios', () => {
    expect(() => prepararFactura({ cbteTipo: 1, docTipo: 99, neto: 100, alicuota: 21 })).toThrow(/Factura A requiere CUIT/);
    expect(() => prepararFactura({ cbteTipo: 6, neto: 0, alicuota: 21 })).toThrow(/mayor a cero/);
    expect(() => prepararFactura({ cbteTipo: 6, concepto: 2, neto: 10, alicuota: 21 })).toThrow(/servicios/);
    expect(() => prepararFactura({ cbteTipo: 99, neto: 10 })).toThrow(/no soportado/);
  });

  it('lee CAE aprobado y rechazos con observaciones', () => {
    const ok = '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult><FeCabResp><Resultado>A</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><Resultado>A</Resultado><CAE>76123456789012</CAE><CAEFchVto>20261017</CAEFchVto></FECAEDetResponse></FeDetResp></FECAESolicitarResult></FECAESolicitarResponse></soap:Body></soap:Envelope>';
    expect(parseSolicitarCae(ok)).toMatchObject({ resultado: 'A', cae: '76123456789012', caeVto: '2026-10-17' });
    const rech = '<Envelope><Body><FECAESolicitarResponse><FECAESolicitarResult><FeCabResp><Resultado>R</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><Resultado>R</Resultado><Observaciones><Obs><Code>10016</Code><Msg>El numero no es el proximo</Msg></Obs></Observaciones></FECAEDetResponse></FeDetResp><Errors><Err><Code>600</Code><Msg>Error</Msg></Err></Errors></FECAESolicitarResult></FECAESolicitarResponse></Body></Envelope>';
    const r = parseSolicitarCae(rech);
    expect(r.resultado).toBe('R');
    expect(r.observaciones[0]).toContain('10016');
    expect(r.errores[0]).toContain('600');
  });

  it('último autorizado y puntos de venta', () => {
    expect(parseUltimoAutorizado('<E><B><FECompUltimoAutorizadoResult><PtoVta>3</PtoVta><CbteTipo>6</CbteTipo><CbteNro>150</CbteNro></FECompUltimoAutorizadoResult></B></E>')).toBe(150);
    const pv = parsePuntosVenta('<E><FEParamGetPtosVentaResult><ResultGet><PtoVenta><Nro>3</Nro><EmisionTipo>CAE - RECE</EmisionTipo><Bloqueado>N</Bloqueado><FchBaja>NULL</FchBaja></PtoVenta></ResultGet></FEParamGetPtosVentaResult></E>');
    expect(pv).toEqual([{ numero: 3, tipo: 'CAE - RECE', bloqueado: false, baja: null }]);
    expect(parsePuntosVenta('<E><FEParamGetPtosVentaResult><Errors><Err><Code>602</Code><Msg>Sin Resultados</Msg></Err></Errors></FEParamGetPtosVentaResult></E>')).toEqual([]);
  });
});
