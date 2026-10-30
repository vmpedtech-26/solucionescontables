// Edge Function "leer-comprobante": lee con IA la foto o el PDF de un
// comprobante que ya esta en el bucket "comprobantes" y devuelve sus datos
// para revisar y cargar al libro.
// Despliegue: archivos index.ts + lectura.js, con "Verify JWT" desactivado
// (la sesion se valida aca). Secreto requerido: ANTHROPIC_API_KEY.
// Permisos: el archivo se descarga con la sesion del usuario, asi que las
// politicas de Storage deciden si puede leerlo (estudio o cliente de esa empresa).
import Anthropic from "npm:@anthropic-ai/sdk@^1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ESQUEMA, INSTRUCCIONES, TIPOS_ARCHIVO, bloqueArchivo, normalizar } from "./lectura.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODELO = "claude-opus-5-5";
const MAX_IMAGEN = 3_700_000; // ~5 MB en base64, el limite de la API por imagen
const MAX_PDF = 20_000_000;

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

function base64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function leer(req: Request) {
  if (!API_KEY) throw new ErrorUsuario("La lectura con IA todavía no está activada en este servidor.", 503);
  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) throw new ErrorUsuario("Sesión requerida.", 401);
  const db = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u, error: eu } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (eu || !u?.user) throw new ErrorUsuario("Sesión inválida o vencida. Volvé a ingresar.", 401);

  const { path } = await req.json().catch(() => ({}));
  if (typeof path !== "string" || !/^[\w-]+\/[^/]{1,200}$/.test(path) || path.includes("..")) throw new ErrorUsuario("Archivo inválido.");
  const ext = path.split(".").pop()!.toLowerCase();
  const mediaType = TIPOS_ARCHIVO[ext as keyof typeof TIPOS_ARCHIVO];
  if (!mediaType) throw new ErrorUsuario("Formato no soportado: subí una foto (JPG, PNG, WEBP) o un PDF.");

  // La empresa y el archivo se leen con la sesion del usuario (RLS)
  const empresaId = path.split("/")[0];
  const { data: empresa } = await db.from("empresas").select("id, cuit").eq("id", empresaId).maybeSingle();
  const { data: archivo, error: ea } = await db.storage.from("comprobantes").download(path);
  if (ea || !archivo) throw new ErrorUsuario("No tenés acceso a ese archivo o ya no existe.", 403);
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (bytes.length > (mediaType === "application/pdf" ? MAX_PDF : MAX_IMAGEN)) {
    throw new ErrorUsuario(mediaType === "application/pdf" ? "El PDF supera 20 MB." : "La imagen supera 3,7 MB: sacá la foto con menos resolución.");
  }

  const client = new Anthropic({ apiKey: API_KEY, timeout: 90_000, maxRetries: 2 });
  let respuesta;
  try {
    respuesta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 8000,
      system: INSTRUCCIONES,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      messages: [{
        role: "user",
        content: [bloqueArchivo(mediaType, base64(bytes)), { type: "text", text: "Leé este comprobante." }],
      }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new ErrorUsuario("Hay muchas lecturas en curso. Probá en un minuto.", 429);
    if (e instanceof Anthropic.BadRequestError) throw new ErrorUsuario("El archivo no se pudo procesar (¿está dañado o protegido con contraseña?).");
    if (e instanceof Anthropic.APIConnectionError) throw new ErrorUsuario("No se pudo contactar al servicio de lectura. Reintentá.", 502);
    throw e;
  }
  if (respuesta.stop_reason === "refusal") throw new ErrorUsuario("El servicio no pudo leer este archivo. Cargalo a mano.", 422);
  if (respuesta.stop_reason === "max_tokens") throw new ErrorUsuario("La lectura quedó incompleta. Reintentá.", 502);
  const texto = respuesta.content.find((b) => b.type === "text");
  let lectura;
  try { lectura = JSON.parse(texto && "text" in texto ? texto.text : ""); }
  catch { throw new ErrorUsuario("La lectura no devolvió datos válidos. Reintentá o cargalo a mano.", 502); }
  return normalizar(lectura, empresa?.cuit || "");
}

Deno.serve(async (req) => {
  const h = { ...cors(req), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Método no permitido." }), { status: 405, headers: h });
  try {
    return new Response(JSON.stringify({ data: await leer(req) }), { headers: h });
  } catch (e) {
    const status = e instanceof ErrorUsuario ? e.status : 500;
    if (status === 500) console.error("leer-comprobante:", e);
    const msg = e instanceof ErrorUsuario ? e.message : "Error interno al leer el comprobante.";
    return new Response(JSON.stringify({ error: msg }), { status, headers: h });
  }
});
