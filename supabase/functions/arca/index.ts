// Edge Function "arca": unico punto de contacto con los web services de ARCA.
// Despliegue: archivos index.ts + core.js, con "Verify JWT" desactivado (la
// sesion del usuario se valida aca adentro con auth.getUser).
import forge from "npm:node-forge@1.3.1";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as core from "./core.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  (() => { try { return Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"))[0] as string; } catch { return ""; } })();
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const ORIGENES = ["https://solucionescontables.site", "https://www.solucionescontables.site", "http://localhost:3000", "http://localhost:5173"];
const cors = (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGENES.includes(origin) ? origin : ORIGENES[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

class ErrorUsuario extends Error {
  status: number;
  constructor(msg: string, status = 400) { super(msg); this.status = status; }
}

const AMBIENTES = ["homologacion", "produccion"];
const ambienteValido = (a: unknown) => {
  if (!AMBIENTES.includes(String(a))) throw new ErrorUsuario("Ambiente inválido.");
  return String(a) as "homologacion" | "produccion";
};

async function soap(url: string, body: string, soapAction = "") {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: soapAction },
      body,
      signal: ctrl.signal,
    });
    return await r.text();
  } catch (e) {
    throw new ErrorUsuario(`No se pudo conectar con ARCA (${String(e).slice(0, 80)}). Reintentá en unos minutos.`, 502);
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------
// Contexto: quien llama y sobre que estudio / empresa puede operar
// ---------------------------------------------------------------
async function usuario(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new ErrorUsuario("Sesión requerida.", 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new ErrorUsuario("Sesión inválida o vencida. Volvé a ingresar.", 401);
  const uid = data.user.id;
  const { data: est } = await admin.from("estudios").select("id, razon_social").eq("id", uid).maybeSingle();
  if (est) return { uid, rol: "estudio" as const, estudio: est };
  const { data: cli } = await admin.from("clientes_finales").select("empresa_id").eq("id", uid).maybeSingle();
  if (cli) return { uid, rol: "cliente" as const, empresaCliente: cli.empresa_id as string };
  throw new ErrorUsuario("Tu cuenta no tiene permisos para operar con ARCA.", 403);
}

type Ctx = Awaited<ReturnType<typeof usuario>>;

function soloEstudio(ctx: Ctx) {
  if (ctx.rol !== "estudio") throw new ErrorUsuario("Solo el estudio contable puede hacer esta operación.", 403);
  return ctx.uid;
}

async function empresaAutorizada(ctx: Ctx, empresaId: string) {
  const { data: emp } = await admin.from("empresas").select("id, estudio_id, razon_social, cuit, condicion_iva").eq("id", empresaId).maybeSingle();
  if (!emp) throw new ErrorUsuario("Empresa no encontrada.", 404);
  if (ctx.rol === "estudio" && emp.estudio_id !== ctx.uid) throw new ErrorUsuario("Empresa no encontrada.", 404);
  if (ctx.rol === "cliente" && ctx.empresaCliente !== emp.id) throw new ErrorUsuario("Empresa no encontrada.", 404);
  return emp;
}

// ---------------------------------------------------------------
// Credenciales y ticket de acceso (WSAA)
// ---------------------------------------------------------------
async function credenciales(estudioId: string, ambiente: string) {
  const { data } = await admin.from("arca_credenciales").select("*").eq("estudio_id", estudioId).eq("ambiente", ambiente).maybeSingle();
  if (!data?.certificado || !data?.clave_secret_id) {
    throw new ErrorUsuario(`El estudio todavía no cargó su certificado de ARCA para ${ambiente === "produccion" ? "producción" : "homologación"} (Configuración → Conexión con ARCA).`, 412);
  }
  const { data: keyPem, error } = await admin.rpc("arca_leer_clave", { p_secret: data.clave_secret_id });
  if (error || !keyPem) throw new ErrorUsuario("No se pudo leer la clave privada del certificado.", 500);
  return { ...data, keyPem: keyPem as string };
}

async function ticket(estudioId: string, ambiente: "homologacion" | "produccion", servicio: string) {
  const { data: cache } = await admin.from("arca_tickets").select("*")
    .eq("estudio_id", estudioId).eq("ambiente", ambiente).eq("servicio", servicio).maybeSingle();
  if (cache && new Date(cache.expira).getTime() - Date.now() > 5 * 60 * 1000) {
    return { token: cache.token, sign: cache.sign, expira: cache.expira, cuit: (await credencialCuit(estudioId, ambiente)) };
  }
  const cred = await credenciales(estudioId, ambiente);
  const cms = core.firmarTRA(forge, core.buildTRA(servicio), cred.certificado, cred.keyPem);
  const xml = await soap(core.ENDPOINTS[ambiente].wsaa, core.loginCmsEnvelope(cms));
  let ta;
  try { ta = core.parseLoginCms(xml); } catch (e) { throw new ErrorUsuario((e as Error).message, 502); }
  await admin.from("arca_tickets").upsert({ estudio_id: estudioId, ambiente, servicio, token: ta.token, sign: ta.sign, expira: ta.expira });
  return { ...ta, cuit: cred.cuit };
}

async function credencialCuit(estudioId: string, ambiente: string) {
  const { data } = await admin.from("arca_credenciales").select("cuit").eq("estudio_id", estudioId).eq("ambiente", ambiente).maybeSingle();
  return data?.cuit as string;
}

async function ambienteDeEstudio(estudioId: string, pedido?: unknown) {
  if (pedido) return ambienteValido(pedido);
  const { data } = await admin.from("arca_credenciales").select("ambiente, certificado").eq("estudio_id", estudioId);
  const conCert = (data || []).filter((c) => c.certificado).map((c) => c.ambiente);
  if (conCert.includes("produccion")) return "produccion";
  if (conCert.includes("homologacion")) return "homologacion";
  throw new ErrorUsuario("El estudio todavía no conectó su certificado de ARCA.", 412);
}

// ---------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------
const acciones: Record<string, (ctx: Ctx, p: Record<string, unknown>) => Promise<unknown>> = {
  async estado(ctx) {
    const estudioId = soloEstudio(ctx);
    const { data } = await admin.from("arca_credenciales")
      .select("ambiente, cuit, alias, csr, cert_desde, cert_hasta, cert_emisor, certificado")
      .eq("estudio_id", estudioId);
    return (data || []).map((c) => ({ ...c, certificado: undefined, tieneCertificado: !!c.certificado }));
  },

  async generar_csr(ctx, p) {
    const estudioId = soloEstudio(ctx);
    const ambiente = ambienteValido(p.ambiente);
    const cuit = String(p.cuit || "").replace(/\D/g, "");
    if (!/^\d{11}$/.test(cuit)) throw new ErrorUsuario("CUIT del estudio inválido.");
    const alias = String(p.alias || "solucionescontables").slice(0, 60);
    const { csrPem, keyPem } = core.generarCSR(forge, { cuit, organizacion: ctx.estudio?.razon_social, alias });
    const { data: secretId, error } = await admin.rpc("arca_guardar_clave", { p_estudio: estudioId, p_ambiente: ambiente, p_pem: keyPem });
    if (error) throw new ErrorUsuario("No se pudo guardar la clave privada de forma segura.", 500);
    const { error: e2 } = await admin.from("arca_credenciales").upsert({
      estudio_id: estudioId, ambiente, cuit, alias, csr: csrPem, certificado: null,
      cert_desde: null, cert_hasta: null, cert_emisor: null, clave_secret_id: secretId, actualizado: new Date().toISOString(),
    });
    if (e2) throw new ErrorUsuario("No se pudo registrar la solicitud.", 500);
    await admin.from("arca_tickets").delete().eq("estudio_id", estudioId).eq("ambiente", ambiente);
    return { csr: csrPem };
  },

  async cargar_certificado(ctx, p) {
    const estudioId = soloEstudio(ctx);
    const ambiente = ambienteValido(p.ambiente);
    const pem = String(p.certificado || "").trim();
    if (pem.length > 8000) throw new ErrorUsuario("El archivo es demasiado grande para ser un certificado.");
    const { data: cred } = await admin.from("arca_credenciales").select("*").eq("estudio_id", estudioId).eq("ambiente", ambiente).maybeSingle();
    if (!cred?.clave_secret_id) throw new ErrorUsuario("Primero generá la solicitud de certificado (CSR) en este ambiente.");
    const { data: keyPem } = await admin.rpc("arca_leer_clave", { p_secret: cred.clave_secret_id });
    let info;
    try { info = core.infoCertificado(forge, pem, keyPem as string); } catch (e) { throw new ErrorUsuario((e as Error).message); }
    if (!info.coincideClave) throw new ErrorUsuario("Este certificado no corresponde a la última solicitud (CSR) generada en este ambiente.");
    if (new Date(info.hasta).getTime() < Date.now()) throw new ErrorUsuario("El certificado está vencido.");
    if (info.cuit && info.cuit !== cred.cuit) throw new ErrorUsuario(`El certificado es del CUIT ${info.cuit}, no del ${cred.cuit}.`);
    await admin.from("arca_credenciales").update({
      certificado: pem, cert_desde: info.desde, cert_hasta: info.hasta, cert_emisor: info.emisor, actualizado: new Date().toISOString(),
    }).eq("estudio_id", estudioId).eq("ambiente", ambiente);
    await admin.from("arca_tickets").delete().eq("estudio_id", estudioId).eq("ambiente", ambiente);
    return { desde: info.desde, hasta: info.hasta, emisor: info.emisor };
  },

  async borrar_credenciales(ctx, p) {
    const estudioId = soloEstudio(ctx);
    const ambiente = ambienteValido(p.ambiente);
    await admin.from("arca_tickets").delete().eq("estudio_id", estudioId).eq("ambiente", ambiente);
    await admin.from("arca_credenciales").delete().eq("estudio_id", estudioId).eq("ambiente", ambiente);
    return { ok: true };
  },

  async probar(ctx, p) {
    const estudioId = soloEstudio(ctx);
    const ambiente = ambienteValido(p.ambiente);
    const servicio = p.servicio === "padron" ? core.SERVICIOS.padron : core.SERVICIOS.wsfe;
    const ta = await ticket(estudioId, ambiente, servicio);
    const dummy = core.parseDummy(await soap(core.ENDPOINTS[ambiente].wsfe, core.wsfeEnvelope("FEDummy", ""), core.wsfeSoapAction("FEDummy")));
    return { ok: true, servicio, expira: ta.expira, wsfe: dummy };
  },

  async padron(ctx, p) {
    const estudioId = soloEstudio(ctx);
    const ambiente = await ambienteDeEstudio(estudioId, p.ambiente);
    const idPersona = String(p.cuit || "").replace(/\D/g, "");
    if (!/^\d{11}$/.test(idPersona)) throw new ErrorUsuario("CUIT inválido.");
    const ta = await ticket(estudioId, ambiente, core.SERVICIOS.padron);
    const xml = await soap(core.ENDPOINTS[ambiente].padron, core.padronEnvelope({ token: ta.token, sign: ta.sign, cuitRepresentada: ta.cuit, idPersona }));
    try { return { ambiente, ...core.parsePadron(xml) }; } catch (e) { throw new ErrorUsuario((e as Error).message, 422); }
  },

  async puntos_venta(ctx, p) {
    const emp = await empresaAutorizada(ctx, String(p.empresa_id || ""));
    const ambiente = await ambienteDeEstudio(emp.estudio_id, p.ambiente);
    const ta = await ticket(emp.estudio_id, ambiente, core.SERVICIOS.wsfe);
    const xml = await soap(core.ENDPOINTS[ambiente].wsfe,
      core.wsfeEnvelope("FEParamGetPtosVenta", core.wsfeAuth({ token: ta.token, sign: ta.sign, cuit: emp.cuit })),
      core.wsfeSoapAction("FEParamGetPtosVenta"));
    try { return { ambiente, puntos: core.parsePuntosVenta(xml) }; } catch (e) { throw new ErrorUsuario((e as Error).message, 422); }
  },

  async emitir(ctx, p) {
    const emp = await empresaAutorizada(ctx, String(p.empresa_id || ""));
    const ambiente = await ambienteDeEstudio(emp.estudio_id, p.ambiente);
    const ptoVta = Number(p.pto_vta);
    if (!(ptoVta >= 1 && ptoVta <= 99998)) throw new ErrorUsuario("Punto de venta inválido.");
    let f;
    try { f = core.prepararFactura(p as Record<string, unknown>); } catch (e) { throw new ErrorUsuario((e as Error).message); }
    const esMono = String(emp.condicion_iva || "").toLowerCase().includes("monotributo");
    if (esMono && !f.esC) throw new ErrorUsuario("Un monotributista solo emite comprobantes clase C.");
    if (!esMono && f.esC) throw new ErrorUsuario("Un responsable inscripto no emite comprobantes clase C.");

    const ta = await ticket(emp.estudio_id, ambiente, core.SERVICIOS.wsfe);
    const auth = { token: ta.token, sign: ta.sign, cuit: emp.cuit };
    let resultado, numero = 0;
    for (let intento = 0; intento < 2; intento++) {
      const ultXml = await soap(core.ENDPOINTS[ambiente].wsfe,
        core.wsfeEnvelope("FECompUltimoAutorizado", core.ultimoAutorizadoBody(auth, ptoVta, f.cbteTipo)),
        core.wsfeSoapAction("FECompUltimoAutorizado"));
      try { numero = core.parseUltimoAutorizado(ultXml) + 1; } catch (e) { throw new ErrorUsuario((e as Error).message, 422); }
      const xml = await soap(core.ENDPOINTS[ambiente].wsfe,
        core.wsfeEnvelope("FECAESolicitar", core.solicitarCaeBody(auth, ptoVta, numero, f)),
        core.wsfeSoapAction("FECAESolicitar"));
      try { resultado = core.parseSolicitarCae(xml); } catch (e) { throw new ErrorUsuario((e as Error).message, 422); }
      // 10016: el numero ya lo tomo otra emision concurrente -> reintento una vez
      const carrera = [...resultado.observaciones, ...resultado.errores].some((m) => m.startsWith("10016"));
      if (!(resultado.resultado !== "A" && carrera)) break;
    }
    const numeroTxt = `${String(ptoVta).padStart(5, "0")}-${String(numero).padStart(8, "0")}`;
    const tipoTxt = core.TIPOS_CBTE[f.cbteTipo as keyof typeof core.TIPOS_CBTE];
    let registrado = false;
    // Solo produccion entra al Libro IVA: homologacion no tiene validez fiscal.
    if (resultado!.resultado === "A" && ambiente === "produccion") {
      const { error } = await admin.from("transacciones").insert({
        id: `v-cae-${resultado!.cae}`, empresa_id: emp.id, tipo: "ventas", fecha: f.fecha,
        tipo_comprobante: tipoTxt, numero: numeroTxt,
        cliente: String(p.receptor_nombre || (f.docTipo === 99 ? "Consumidor Final" : "")).slice(0, 160),
        cuit: f.docTipo === 80 ? `${f.docNro.slice(0, 2)}-${f.docNro.slice(2, 10)}-${f.docNro.slice(10)}` : "",
        neto: f.neto, iva: f.iva, total: f.total, cae: resultado!.cae, cae_vto: resultado!.caeVto,
      });
      registrado = !error;
      if (error) console.error("No se pudo registrar la venta emitida:", error.message);
    }
    return { ambiente, ...resultado!, numero: numeroTxt, tipo: tipoTxt, neto: f.neto, iva: f.iva, total: f.total, registrado };
  },
};

Deno.serve(async (req) => {
  const headers = { ...cors(req), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405, headers });
  try {
    const body = await req.json().catch(() => ({}));
    const accion = acciones[String(body.accion || "")];
    if (!accion) throw new ErrorUsuario("Acción desconocida.");
    const ctx = await usuario(req);
    const data = await accion(ctx, body);
    return new Response(JSON.stringify({ data }), { headers });
  } catch (e) {
    const status = e instanceof ErrorUsuario ? e.status : 500;
    if (status === 500) console.error(e);
    const msg = e instanceof ErrorUsuario ? e.message : "Error interno al operar con ARCA.";
    return new Response(JSON.stringify({ error: msg }), { status, headers });
  }
});
